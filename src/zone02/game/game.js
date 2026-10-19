// 마피아 게임 한 판 (12명: 사람 1 + AI 11, 직업 12개). 규칙: docs/게임규칙_v0.2_12인.md
//  낮(자유 이동) → 투표(원탁 12석 소집·토론·투표·처형) → 밤(능력 사용, 마피아는 평소 시민인 척하다 도구를 주우면 "정하림"으로 변신해 사냥, 끝나면 다시 시민 복장) → 아침(결과) → 반복
// 서버 없이 이 브라우저 안에서 AI 가 나머지를 연기한다. 서버가 생기면 판정/기록(g.records, g.prints)을 서버로 옮긴다.
import * as THREE from 'three';
import { poseModel, buildModel, advancePhase } from '../character.js';
import { resolveCircle } from '../collide.js';
import { SEATS } from '../meeting.js';
import { PLAY_ZONES, pathPoints, randomPoint, zoneIdAt, zoneName, hops, setNavCollider } from './nav.js';
import { Prints, bloodDecal, setBloodNight, TOOLS, buildToolPickup, applyHunterLook, removeHunterLook, makeLabel, startFall, updateFall, resetFall, makeGhost } from './fx.js';
import { createUI } from './ui.js';
import { ROLES, ROLE_ORDER, TEAM_NAME } from './roles.js';
import { Mind } from './mind.js';
import * as sfx from './audio.js';
import { iga, eul, eun, ro, rnd, pick, shuffle, joinNames } from './kr.js';

const CFG = { dayTime: 60, talkTime: 38, voteTime: 20, nightTime: 90, wound: 5, killDist: 1.25, huntMax: 55 };
const SPEED = { hunter: 4.4, flee: 4.3, wander: 2.4, follow: 3.4, humanWalk: 4.0, humanRun: 5.4 };
const STAMINA_MAX = 4.0, STAMINA_REGEN = 0.5;
const TC = { x: 10, z: 14 };
const EXEC_SPOT = { x: 10, z: 20.3 };
const T_EXEC = { walkEnd: 3.6, fall: 5.6, end: 8.4 };
const NAMES = ['나', '서윤', '지호', '민재', '하린', '도윤', '예린', '시우', '수아', '현우', '유나', '준서'];
const COLORS = ['#8fe3ff', '#ffb3c6', '#ffd98a', '#b8f2a8', '#d2b8ff', '#ffc08a', '#9ee6d2', '#f2a0a0', '#a8c4ff', '#e6e08a', '#f0a8e0', '#b0d8a0'];
const PERSONA = '정하림';
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const dist2 = (a, b) => Math.hypot(a.b.x - b.b.x, a.b.z - b.b.z);

export class Game {
  constructor({ scene, camera, hero, meeting, world, setNight, getNight, toast, renderer }) {
    Object.assign(this, { scene, camera, hero, meeting, world, setNight, getNight: getNight ?? (() => 0), toast, renderer });
    this.col = world.colliders; setNavCollider(this.col);
    this.ui = createUI();
    this.prints = new Prints(scene);
    this.time = 0; this.active = false; this.phase = 'off'; this.t = 0; this.dayNo = 0; this.nightNo = 0;
    this.pickups = []; this.blood = []; this.ghosts = []; this.photos = []; this.notes = []; this.talkLog = [];
    this.camLook = new THREE.Vector3(); this.perceiveAcc = 0; this.recAcc = 0; this.chatAcc = 0; this.stamina = STAMINA_MAX;
    this.killedByMafia = new Set(); this.deathsTonight = []; this.rec = [];
    this.spot = new THREE.SpotLight(0xffd7a8, 0, 30, 0.32, 0.55, 1.3); this.spot.castShadow = false;
    scene.add(this.spot, this.spot.target);

    // 플레이어 12명: 사람(hero) + AI 11(회의 연출용 NPC)
    this.players = [];
    const mk = (id, body, model, isHuman) => {
      const tag = makeLabel(); tag.position.set(0, 2.2, 0); model.add(tag);
      const bubble = makeLabel({ w: 420, h: 76, scale: [2.3, 0.42] }); bubble.position.set(0, 2.8, 0); bubble.visible = false; model.add(bubble);
      const p = { id, name: NAMES[id], color: COLORS[id], isHuman, role: 'citizen', team: 'citizen', follower: false, alive: true, dead: false, b: body, model, tag, bubble, bubbleT: 0,
        persona: false, forced: false, tool: null, medicine: false, wounded: null, plan: null, fear: null, vote: null, usedShot: false, cannotMed: new Set(),
        bot: isHuman ? null : { path: [], pi: 0, wait: 0, stuck: 0, repath: 0, pause: 0 }, mind: null, lastPrint: { x: body.x, z: body.z, side: 1 }, nightZone: null };
      this.players.push(p); return p;
    };
    this.human = mk(0, hero, hero.model, true);
    meeting.npcs.slice(0, 11).forEach((a, i) => { const p = mk(i + 1, a.t, a.t.model, false); p.mind = new Mind(this, p); });
    this.ui.startButton(true, () => this.showRoleSelect());
    this.prints.colorFn = m => this.printColor(m);
  }

  // ───────── 조회 도구 ─────────
  alive() { return this.players.filter(p => p.alive); }
  byRole(r) { return this.players.find(p => p.role === r && !p.follower); }
  get hunter() { return this.byRole('mafia'); }
  get mafiaP() { return this.byRole('mafia'); }
  isEvil(p) { return p.team !== 'citizen'; }
  note(text) { this.notes.push(text); this.ui.setNotes(this.notes); this.ui.notesVisible(true); }
  zone(p) { return zoneIdAt(p.b.x, p.b.z); }

  // ───────── 시작 ─────────
  showRoleSelect() {
    this.ui.startButton(false);
    const rows = [{ label: '🎲 랜덤', onClick: () => this.begin('random') }, ...ROLE_ORDER.map(r => ({ label: `${ROLES[r].icon} ${ROLES[r].name}`, onClick: () => this.begin(r) }))];
    this.ui.panel({
      title: '🎭 마피아 게임 (12인)', body: '12명이 각자 다른 직업을 가져요. 나 말고 11명은 AI예요.\n낮에 돌아다니며 이야기하고, 투표로 마피아를 찾아내요. 밤에는 직업 능력을 써요.\n어떤 직업으로 해 볼까요?',
      rows, buttons: [{ label: '자유 이동으로', onClick: () => { this.ui.panel(); this.ui.startButton(true, () => this.showRoleSelect()); } }],
    });
  }
  begin(sel) {
    this.reset();
    const roles = shuffle(ROLE_ORDER);
    if (sel !== 'random') { const i = roles.indexOf(sel); [roles[0], roles[i]] = [roles[i], roles[0]]; }
    this.players.forEach((p, i) => { p.role = roles[i]; p.team = ROLES[roles[i]].team; p.follower = false; });
    for (const p of this.players) if (p.mind) { p.mind.reset(); p.mind.setAllies(); }
    this.active = true; this.dayNo = 0; this.nightNo = 0; this.ui.panel(); this.ui.startButton(false);
    this.meeting.state !== 'idle' && this.meeting.stand?.('');
    this.hero.auto = false;
    const h = this.human, R = ROLES[h.role];
    this.note(`당신은 [${R.icon} ${R.name}] (${TEAM_NAME[R.team]}).\n${R.desc}`);
    if (R.team === 'mafia') this.note(`마피아팀 동료: ${this.players.filter(q => q !== h && q.team === 'mafia').map(q => `${q.name}(${ROLES[q.role].name})`).join(', ')}`);
    this.nextDay(true);
  }
  reset() {
    this.prints.clear(); this.killedByMafia.clear(); this.notes = []; this.ui.setNotes([]);
    for (const b of this.blood) this.scene.remove(b); this.blood = [];
    for (const pk of this.pickups) this.scene.remove(pk.mesh); this.pickups = [];
    for (const g of this.ghosts) this.scene.remove(g.mesh); this.ghosts = []; this.photos = []; this.talkLog = []; this.rec = [];
    for (const p of this.players) {
      p.alive = true; p.dead = false; p.persona = false; p.forced = false; p.tool = null; p.medicine = false; p.wounded = null; p.plan = null; p.fear = null; p.vote = null; p.usedShot = false; p.cannotMed = new Set(); p.follower = false;
      p.model.visible = true; resetFall(p.model); removeHunterLook(p.model); p.b.sit = 0; p.b.speed = 0; p.tag.visible = true; p.bubble.visible = false;
      if (!p.isHuman) { p.b.circle.r = 0.3; p.bot.path = []; p.bot.wait = 0; p.bot.pause = 0; }
    }
    this.hero.auto = false; this.hero.walkSpeed = undefined; this.hero.runSpeed = undefined; this.hero.model.visible = true;
    if (this.ghostBody) { this.scene.remove(this.ghostBody); this.ghostBody = null; }
    this.stamina = STAMINA_MAX; this.target = null; this.ex = null; this.spot.intensity = 0; this.talk = null; this.deathsTonight = [];
    this.ui.big(''); this.ui.bars(false); this.ui.setHint(''); this.ui.alert(''); this.ui.progress(null); this.ui.gallery(null);
  }

  // ───────── 외부에서 쓰는 것 ─────────
  heroBusy() {
    if (!this.active) return false;
    const h = this.human; if (!h.alive) return false;
    if (h.wounded) return true;
    return ['toVote', 'talk', 'vote', 'resolve', 'exec', 'toNight', 'pick', 'dawn', 'over'].includes(this.phase);
  }
  filterRun(run, dt) {
    const h = this.human;
    if (!(this.active && this.phase === 'night' && h.alive && !h.persona)) { this.hero.runSpeed = undefined; return run; }
    this.hero.runSpeed = SPEED.humanRun; this.stamina ??= STAMINA_MAX;
    if (run && this.stamina > 0.05) { this.stamina -= dt; return true; }
    this.stamina = Math.min(STAMINA_MAX, this.stamina + dt * STAMINA_REGEN); return false;
  }
  /** 키 입력. 처리했으면 true */
  key(code) {
    if (!this.active) return false;
    const h = this.human;
    if (code === 'KeyJ') { this.ui.toggleNotes(); return true; }
    if (code === 'KeyP') { this.ui.galleryOpen ? this.ui.gallery(null) : this.ui.gallery(this.photos.map(x => ({ img: x.img, caption: x.caption }))); return true; }
    if (!h.alive && code !== 'KeyG') return false;
    if (code === 'Space') { this.action(); return true; }
    if (code === 'KeyC' && h.role === 'reporter' && !h.follower) { this.photoReq = true; return true; }
    if (code === 'KeyV' && h.role === 'police' && !h.follower) { this.blowWhistle(h); return true; }
    if (code === 'KeyG' && h.role === 'medium' && !h.follower && h.alive) { this.talkGhosts(); return true; }
    if (code === 'KeyX' && h.persona) { this.endHunt(h, '도구를 내려놓았다'); return true; }
    return false;
  }
  action() { // Space: 상황에 맞는 행동
    const h = this.human; if (this.phase !== 'night' || h.wounded) return;
    if (h.role === 'mafia' && h.persona) return this.humanAttack();
    if (h.role === 'vigilante' && h.plan?.kind === 'shoot' && !h.usedShot) return this.shoot(h);
  }
  minimapMarks() {
    const marks = [], h = this.human; if (!this.active) return marks;
    if (this.phase === 'night' && h.alive) {
      const pl = h.plan; if (pl && !pl.done && pl.target != null) { const T = this.players[pl.target]; if (T.alive) marks.push({ x: T.b.x, z: T.b.z, c: pl.kind === 'hunt' ? '#ff4040' : '#ffd24a' }); }
      if (h.role === 'mafia' && !h.persona) for (const pk of this.pickups) if (!pk.taken) marks.push({ x: pk.x, z: pk.z, c: '#ffb04a' });
      if (h.role === 'doctor') for (const q of this.players) if (q.wounded) marks.push({ x: q.b.x, z: q.b.z, c: '#6aff9a' });
      const hp = this.hunter; if (!h.persona && hp?.persona && dist2(h, hp) < 12) marks.push({ x: hp.b.x, z: hp.b.z, c: '#ff2020' });
    }
    return marks;
  }
  afterRender(canvas) { // 기자(사람): 사진 요청이 있으면 방금 그린 화면을 찍는다
    if (!this.photoReq) return; this.photoReq = false;
    const h = this.human; if (!h.alive || h.role !== 'reporter' || this.phase === 'off') return;
    if (this.photos.filter(x => x.by === h.id && x.night === this.nightNo).length >= 8) { this.toast('이번 밤에는 필름이 다 떨어졌어요.', 1800); return; }
    const c = document.createElement('canvas'); c.width = 320; c.height = 200; c.getContext('2d').drawImage(canvas, 0, 0, 320, 200);
    this.addPhoto(h, c.toDataURL('image/jpeg', 0.7), this.camera);
  }

  // ───────── 낮 ─────────
  nextDay(first = false) {
    this.dayNo++; this.phase = 'day'; this.t = CFG.dayTime; this.setNight(0);
    for (const p of this.players) { p.vote = null; p.forced = false; if (p.persona) { p.persona = false; p.tool = null; } this.refreshLook(p); if (p.alive) this.updateTag(p); }
    this.hero.walkSpeed = this.hero.runSpeed = undefined;
    if (first) this.scatter();
    for (const p of this.alive()) if (p.mind) p.mind.said.clear();
    this.ui.panel(); this.ui.fade(false); this.ui.big(`${this.dayNo}일차 · 낮`); setTimeout(() => this.ui.big(''), 1800);
    this.ui.setHint(this.human.alive ? '돌아다니며 사람들과 이야기해 보세요. (Enter 로 말하기 · J 수첩)' : '관전 중이에요. 자유롭게 돌아다닐 수 있어요.');
    this.dayBtn(true);
    if (this.human.role === 'detective') this.prints.refresh();
  }
  dayBtn(on) {
    if (!this._dayBtn) { const b = document.createElement('button'); b.className = 'gBtn'; b.textContent = '🗳 지금 투표하기'; b.style.cssText = 'position:fixed;left:16px;top:96px;z-index:7;display:none'; b.onclick = () => { if (this.phase === 'day') this.startVote(); }; document.body.appendChild(b); this._dayBtn = b; }
    this._dayBtn.style.display = on ? 'block' : 'none';
  }
  updateTag(p) {
    const hunter = p.persona || p.forced;
    p.tag.userData.draw(hunter ? PERSONA : p.name, hunter ? { color: '#ffb0b0', bg: 'rgba(60,6,10,0.85)', border: '#ff6060' } : { color: p.color });
    p.tag.visible = p.alive;
  }
  refreshLook(p) { if (p.persona) applyHunterLook(p.model, p.tool); else if (p.forced) applyHunterLook(p.model, null); else removeHunterLook(p.model); this.updateTag(p); }
  say(p, text, opts = {}) {
    this.ui.say(p.name, text, p.color); p.bubble.userData.draw(text.length > 30 ? text.slice(0, 29) + '…' : text, { color: opts.shout ? '#ffd0d0' : '#fff' }); p.bubble.visible = true; p.bubbleT = Math.max(3.4, Math.min(7, text.length * 0.12));
  }
  heardShout(p, zone) { // 비명/외침을 근처 AI·사람이 듣는다
    for (const q of this.alive()) { if (q === p) continue; if (dist2(p, q) < 16) { if (q.mind) q.mind.events.push({ k: 'shout', night: this.nightNo, zone, t: this.time, from: p.id }); else if (q.isHuman) this.ui.setHint(`${zoneName(zone)} 쪽에서 비명이 들렸어요!`); } }
  }
  scatter() {
    const zs = shuffle(PLAY_ZONES);
    this.alive().forEach((p, i) => {
      const pt = randomPoint(this.col, zs[i % zs.length]); this.place(p, pt.x, pt.z, rnd() * 6.283);
      if (p.bot) { p.bot.path = []; p.bot.wait = 0.5 + rnd(); }
    });
    if (this.human.alive) { this.hero.yaw = this.hero.heading + Math.PI; this.hero.camInit = false; this.hero.camIdle = 9; }
  }
  place(p, x, z, heading) { p.b.x = x; p.b.z = z; p.b.heading = heading; p.b.speed = 0; p.b.sit = 0; if (!p.isHuman) { p.b.circle.x = x; p.b.circle.z = z; } p.lastPrint = { x, z, side: 1 }; }

  // ───────── 투표 ─────────
  startVote() { if (this.phase !== 'day') return; this.dayBtn(false); this.ui.setHint(''); this.phase = 'toVote'; this.t = 0.6; this.ui.fade(true); }
  seatAll() {
    const al = this.alive(), n = al.length;
    al.forEach((p, k) => {
      const s = SEATS[Math.round((k * 12) / n) % 12];
      p.b.x = s.x; p.b.z = s.z; p.b.heading = s.face; p.b.sit = 1; p.b.speed = 0; p.wounded = null;
      if (p.bot) { p.b.circle.x = s.x; p.b.circle.z = s.z; }
      p.lastPrint = { x: s.x, z: s.z, side: 1 };
    });
    if (this.human.alive) { this.hero.auto = true; this.hero.yaw = this.hero.heading + Math.PI; this.hero.camInit = false; this.hero.camIdle = 9; }
  }
  startTalk() {
    this.phase = 'talk'; this.t = CFG.talkTime; this.talkLog = [];
    this.talk = { next: 1.2, initial: shuffle(this.alive().filter(p => p.mind)), queue: shuffle(this.alive().filter(p => p.mind)), spoke: new Map() };
    this.ui.fade(false); this.ui.big('투표 시간 · 원탁에 모였다'); setTimeout(() => this.ui.big(''), 1800);
    this.ui.setHint(this.human.alive ? '토론 시간이에요. Enter 로 말해 보세요. (예: "서윤 어젯밤에 어디 있었어?")' : '');
    for (const p of this.alive()) p.mind?.said.clear();
  }
  updateTalk(dt) {
    const T = this.talk; if (!T) return; T.next -= dt; if (T.next > 0) return;
    T.next = 2.0 + rnd() * 0.9;
    // 진행: 모두가 한 번씩 "자기가 본 것"을 말하는 것이 기본. 그 사이사이에 의심받은 사람의 변호, 모순 지적 같은 반응이 끼어든다.
    const aliveAI = this.alive().filter(p => p.mind);
    const reactor = aliveAI.find(p => p.mind.pendingDefend) ?? aliveAI.find(p => p.mind.callouts.length);
    const initialLeft = T.initial.filter(p => p.alive);
    if (reactor && (initialLeft.length === 0 || rnd() < 0.45)) { const st = reactor.mind.nextStatement('talk'); if (st) { this.speak(reactor, st); return; } }
    if (initialLeft.length) {
      const c = initialLeft[0]; T.initial = T.initial.filter(p => p !== c);
      const st = c.mind.nextStatement('initial'); if (st) this.speak(c, st); else T.next = 0.2;
      return;
    }
    // 모두 한 번씩 말한 뒤: 새 의견/지목이 있는 사람이 이어서 말한다
    for (let i = 0; i < aliveAI.length; i++) { const c = T.queue.shift(); if (!c) break; T.queue.push(c); if (!c.alive) continue; const st = c.mind.nextStatement('talk'); if (st && st.act !== 'chat') { this.speak(c, st); return; } }
  }
  speak(p, st, radius = 99) {
    this.say(p, st.text); this.talkLog.push(st);
    for (const q of this.alive()) if (q.mind && q !== p && dist2(p, q) <= radius) q.mind.hear(st);
    if (st.act === 'claim') this.note(`${p.name}: ${st.text}`);
  }
  humanSay(text) { // 사람이 채팅으로 말했다
    const h = this.human; if (!h.alive || !this.active) return false; text = text.trim(); if (!text) return true;
    this.say(h, text);
    const mentioned = this.players.filter(q => q !== h && q.alive && text.includes(q.name));
    const accusing = /(마피아|범인|수상|의심|거짓)/.test(text);
    const st = { by: h.id, night: this.nightNo, act: accusing && mentioned.length ? 'accuse' : 'chat', target: mentioned[0]?.id, reason: '사람의 지목', text };
    this.talkLog.push(st);
    const roleClaim = ROLE_ORDER.find(r => new RegExp(`나\\s*(는|은)?\\s*${ROLES[r].name}`).test(text));
    for (const q of this.alive()) if (q.mind && q !== h) { if (st.act === 'accuse') q.mind.hear(st); if (roleClaim) q.mind.heardClaims.push({ by: h.id, role: roleClaim === 'police' ? 'police' : roleClaim, target: null, result: null, night: this.nightNo }); }
    let delay = 900;
    for (const q of mentioned.slice(0, 2)) { const r = q.mind?.respondToHuman(text); if (r) { setTimeout(() => { if (q.alive) this.speak(q, r, 99); }, delay); delay += 1400; } }
    return true;
  }
  openVote() {
    this.phase = 'vote'; this.t = CFG.voteTime; this.ui.setHint(''); this.talk = null;
    if (!this.human.alive) { this.t = 2; this.ui.setHint('관전 중: AI들이 투표해요.'); return; }
    const others = this.alive().filter(p => !p.isHuman);
    this.ui.panel({
      title: '🗳 누구를 처형할까요?', body: '과반수(생존자의 절반 초과)가 한 명에게 몰리면 처형돼요. 시간이 지나면 기권으로 처리돼요.',
      rows: [...others.map(p => ({ label: p.name, onClick: (btn, row) => { this.human.vote = p.id; [...row.children].forEach(c => c.classList.remove('sel')); btn.classList.add('sel'); } })), { label: '기권', onClick: (btn, row) => { this.human.vote = -1; [...row.children].forEach(c => c.classList.remove('sel')); btn.classList.add('sel'); } }],
      buttons: [{ label: '✔ 투표 확정', onClick: () => { if (this.phase === 'vote') this.t = Math.min(this.t, 0.01); } }],
    });
  }
  resolveVote() {
    this.phase = 'resolve'; this.t = 3.6; this.ui.setHint('');
    const al = this.alive(), tally = {};
    for (const p of al) {
      let v = p.vote;
      if (p.mind) v = p.mind.voteChoice(al);
      if (v == null) v = -1;
      p.voteCast = v; if (v >= 0) tally[v] = (tally[v] ?? 0) + 1;
    }
    let top = null, topN = 0, tie = false;
    for (const [id, n] of Object.entries(tally)) { if (n > topN) { top = +id; topN = n; tie = false; } else if (n === topN) tie = true; }
    const needed = Math.floor(al.length / 2) + 1;
    this.execTarget = topN >= needed && !tie ? this.players[top] : null;
    const lines = al.map(p => `${p.name} → ${p.voteCast >= 0 ? this.players[p.voteCast].name : '기권'}`).join('\n');
    this.ui.panel({ title: this.execTarget ? `⚖ ${this.execTarget.name} 처형 결정 (${topN}표)` : '⚖ 처형 없음', body: lines + (this.execTarget ? '' : `\n(과반수 ${needed}표 미달)`) });
  }
  startExecution(p) {
    this.phase = 'exec'; this.ui.panel(); this.ui.bars(true); this.ui.fade(false); this.ui.setHint(''); p.tag.visible = false;
    this.setNight(1);
    this.ex = { p, t: 0, done: false, fell: false, from: { x: p.b.x, z: p.b.z }, blood: null };
    this.ui.big('처 형', true);
  }
  updateExec(dt) {
    const e = this.ex, p = e.p, v = p.b; e.t += dt; const t = e.t;
    if (t < 0.8) v.sit = 1 - smooth(t / 0.7);
    else if (t < T_EXEC.walkEnd) {
      const k = smooth((t - 0.8) / (T_EXEC.walkEnd - 0.8));
      const nx = e.from.x + (EXEC_SPOT.x - e.from.x) * k, nz = e.from.z + (EXEC_SPOT.z - e.from.z) * k;
      v.speed = k < 0.96 ? 1.9 : 0;
      if (k < 0.96) v.heading += wrap(Math.atan2(nx - v.x, nz - v.z) - v.heading) * 0.25;
      v.x = nx; v.z = nz; v.sit = 0;
    } else if (!e.fell) {
      v.speed = 0; v.heading += wrap(Math.PI - v.heading) * Math.min(1, dt * 5); v.sit = 0;
      p.model.userData.head.rotation.x = 0.55 * smooth((t - T_EXEC.walkEnd) / 1.0); this.ui.big('');
    }
    if (t >= 0.6 && !e.done) { this.spot.intensity = 140 * smooth((t - 0.6) / 1.2); this.spot.position.set(v.x, 6.4, v.z - 1.5); this.spot.target.position.set(v.x, 0.9, v.z); }
    if (t > 0.5) for (const q of this.alive()) if (q !== p) q.b.heading += wrap(Math.atan2(v.x - q.b.x, v.z - q.b.z) - q.b.heading) * Math.min(1, dt * 2.5);
    if (t >= T_EXEC.fall && !e.fell) {
      e.fell = true; this.ui.flash(); startFall(p.model, 0.8); p.model.userData.head.rotation.x = 0;
      e.blood = bloodDecal(this.scene, v.x, v.z - 0.1, 1.9); this.blood.push(e.blood);
      const rn = p.follower ? '사이비 광신도' : ROLES[p.role].name;
      this.ui.big(`${p.name}\n${rn}${p.team === 'mafia' ? '…마피아팀이었다' : p.team === 'cult' ? '…제3세력이었다' : '…시민팀이었다'}`, p.team !== 'citizen');
    }
    if (t >= T_EXEC.end && !e.done) {
      e.done = true; this.ui.big(''); this.ui.bars(false); this.spot.intensity = 0;
      this.die(p, null, 'exec', { silent: true }); p.model.visible = false; if (p.bot) p.b.circle.r = 0;
      if (e.blood) { this.scene.remove(e.blood); this.blood = this.blood.filter(b => b !== e.blood); }
      this.afterDeath('exec');
    }
  }
  afterCamera(camera) {
    if (this.phase !== 'exec' || !this.ex) return;
    const e = this.ex, t = e.t, v = e.p.b;
    if (t < 0.15) return;
    const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    let pos, look;
    if (t < T_EXEC.walkEnd) { pos = lerp3([10, 3.5, 23.2], [10.4, 2.5, 22.3], smooth((t - 0.15) / (T_EXEC.walkEnd - 0.15))); look = [v.x, 1.15, v.z]; }
    else if (t < T_EXEC.fall) { const k = smooth((t - T_EXEC.walkEnd) / (T_EXEC.fall - T_EXEC.walkEnd)); pos = lerp3([8.7, 0.95, 17.6], [9.4, 1.2, 18.9], k); look = [v.x, 1.38, v.z]; }
    else { const k = smooth((t - T_EXEC.fall) / 2.4), s = Math.max(0, 1 - (t - T_EXEC.fall) / 0.7) * 0.07; pos = lerp3([9.4, 1.2, 18.9], [10.2, 2.7, 17.2], k); look = [v.x, 0.25 + 0.5 * (1 - k), v.z]; pos[0] += (rnd() - 0.5) * s; pos[1] += (rnd() - 0.5) * s; }
    camera.position.set(pos[0], pos[1], pos[2]); this.camLook.set(look[0], look[1], look[2]); camera.lookAt(this.camLook);
  }

  // ───────── 밤: 시작 ─────────
  startNight() { this.phase = 'toNight'; this.t = 0.7; this.ui.panel(); this.ui.fade(true); this.dayBtn(false); }
  canAct(p) { // 오늘 밤 대상을 골라야 하는 능력이 있는가
    if (!p.alive || p.follower) return false;
    const R = ROLES[p.role]; if (!R.target) return false;
    if (p.role === 'vigilante' && p.usedShot) return false;
    if (p.role === 'mafia' && !p.alive) return false;
    return true;
  }
  beginNight() {
    this.nightNo++; this.setNight(1);
    this.ui.big(`${this.nightNo}일차 · 밤`); setTimeout(() => this.ui.big(''), 1800);
    this.deathsTonight = []; this.rec.push({}); this.recAcc = 0; this.target = null;
    for (const p of this.alive()) { p.b.sit = 0; p.medicine = false; p.forced = false; p.plan = null; p.fear = null; p.wounded = null; p.attention = null; this.refreshLook(p); }
    this.scatter();
    this.hero.auto = false;
    for (const pk of this.pickups) this.scene.remove(pk.mesh); this.pickups = [];
    for (const [kind, info] of Object.entries(TOOLS)) {
      const pt = randomPoint(this.col, info.zone), mesh = buildToolPickup(kind); mesh.position.set(pt.x, 0, pt.z); this.scene.add(mesh);
      this.pickups.push({ kind, x: pt.x, z: pt.z, mesh, taken: false, zone: info.zone });
    }
    for (const p of this.alive()) { p.hunt = p.role === 'mafia' ? { state: 'blend', t: 0, blendT: 10 + rnd() * 16, target: null, used: false, chase: 0 } : null; if (p.mind) p.plan = this.makePlan(p); }
    this.ui.fade(false);
    const h = this.human;
    if (this.canAct(h)) this.pickTargetUI(); else { this.phase = 'night'; this.t = CFG.nightTime; this.nightHint(); }
  }
  pickTargetUI() {
    const h = this.human, R = ROLES[h.role];
    const titles = { medicine: '💊 누구에게 약을 줄까요?', investigate: '🚔 누구를 조사할까요?', shoot: '🔫 누구를 쏠까요? (한 번뿐)', recruit: '🕯️ 누구를 영입할까요?', hunt: '🔪 누구를 사냥할까요?', spy: '🕶️ 누구의 직업을 알아볼까요?', track: '👣 누구를 추적할까요?' };
    let cands = this.alive().filter(p => p !== h);
    if (h.role === 'doctor') cands = cands.filter(p => !h.cannotMed.has(p.id));
    if (h.role === 'mafia' || h.role === 'spy' || h.role === 'tracker') cands = cands.filter(p => p.team !== 'mafia');
    const rows = cands.map(p => ({ label: p.name, onClick: () => { h.plan = this.newPlan(R.night, p.id); this.ui.panel(); this.phase = 'night'; this.t = CFG.nightTime; this.nightHint(); } }));
    if (R.optional) rows.push({ label: '쏘지 않는다', onClick: () => { h.plan = null; this.ui.panel(); this.phase = 'night'; this.t = CFG.nightTime; this.nightHint(); } });
    this.phase = 'pick'; this.t = CFG.nightTime;
    this.ui.panel({ title: titles[R.night] ?? '대상 선택', body: R.desc, rows });
  }
  nightHint() {
    const h = this.human, R = ROLES[h.role], T = h.plan?.target != null ? this.players[h.plan.target] : null;
    const tips = {
      medicine: `${T?.name}에게 가까이 가서 약을 건네주세요 (2m 안에서 1.5초). 그 사람이 습격당하면 곁에서 치료하세요(5초 안).`,
      investigate: `${T?.name}에게 가까이 가서 3.5초 머물며 조사하세요. 마피아팀이면 호루라기(V)를 불 수 있어요.`,
      recruit: `${T?.name}에게 가까이 가서 3초 머물면 포교돼요.`,
      shoot: `${T?.name}에게 접근해 Space 로 쏘세요 (한 번뿐, 10m 안).`,
      hunt: `도구(🟠 지도)를 주워 ${ro(PERSONA)} 변신한 뒤 ${eul(T?.name ?? "")} 쫓아 Space! 사냥 전에는 시민처럼 행동하세요. (X: 도구 내려놓기)`,
      spy: `${T?.name}의 직업은 아침에 알려 줘요. 밤새 시민인 척 지내세요.`, track: `${T?.name}의 행동은 아침에 알려 줘요. 밤새 시민인 척 지내세요.`,
    };
    const base = tips[h.plan?.kind] ?? (R.night === 'camera' ? 'C 키로 사진을 찍으세요. (P: 사진첩)' : R.night === 'passive' ? R.desc : R.night === 'none' ? '밤이에요. 조심하세요. (Shift 달리기: 체력제)' : '밤이에요.');
    this.ui.setHint(base);
    if (h.team === 'citizen') { this.hero.walkSpeed = SPEED.humanWalk; this.hero.runSpeed = SPEED.humanRun; }
    this.stamina = STAMINA_MAX;
  }
  newPlan(kind, target) { return { kind, target, prog: 0, done: false }; }
  makePlan(p) {
    const g = this, mind = p.mind, others = this.alive().filter(q => q !== p);
    const nonAlly = others.filter(q => !mind.allies.has(q.id));
    const R = ROLES[p.role].night;
    if (p.follower) return null;
    switch (R) {
      case 'hunt': return this.newPlan('hunt', null);
      case 'medicine': { const c = others.filter(q => !p.cannotMed.has(q.id)); if (!c.length) return null;
        const t = c.map(q => ({ q, w: mind.s(q) * 0.7 + (mind.heardClaims.some(x => x.by === q.id && x.role === 'police') ? 0.6 : 0) + rnd() })).sort((a, b) => b.w - a.w)[0].q; return this.newPlan('medicine', t.id); }
      case 'investigate': { const known = new Set([...mind.known].filter(([id, k]) => k.team === 'citizen').map(([id]) => +id)); const c = others.filter(q => !known.has(q.id)); if (!c.length) return null;
        const t = c.map(q => ({ q, w: mind.s(q) + rnd() * 0.5 })).sort((a, b) => b.w - a.w)[0].q; return this.newPlan('investigate', t.id); }
      case 'shoot': { if (p.usedShot || this.dayNo < 2) return null; const t = mind.topSuspect(); if (t && mind.s(t) > 0.6) return this.newPlan('shoot', t.id); return null; }
      case 'recruit': { const c = others.filter(q => !q.follower && q.team !== 'cult'); if (!c.length) return null; const iso = q => -this.alive().filter(o => o !== q && o !== p && dist2(o, q) < 8).length + rnd() * 2; return this.newPlan('recruit', c.map(q => ({ q, w: iso(q) })).sort((a, b) => b.w - a.w)[0].q.id); }
      case 'spy': { if (!nonAlly.length) return null; const t = pick(nonAlly.filter(q => q.team === 'citizen').concat(nonAlly)); return this.newPlan('spy', t.id); }
      case 'track': { if (!nonAlly.length) return null; return this.newPlan('track', pick(nonAlly).id); }
      default: return null;
    }
  }

  // ───────── 밤: 진행 ─────────
  nightTick(dt) {
    this.attackCd = Math.max(0, (this.attackCd ?? 0) - dt);
    // 기록(서버 진실): 2초마다 모든 사람의 위치와 근처 사람
    this.recAcc += dt; if (this.recAcc >= 2) { this.recAcc = 0; const rec = this.rec[this.nightNo - 1]; if (rec) for (const p of this.alive()) { (rec[p.id] ??= []).push({ t: this.time, zone: this.zone(p), x: p.b.x, z: p.b.z, near: this.alive().filter(q => q !== p && dist2(p, q) < 4).map(q => q.id) }); } }
    for (const p of this.alive()) { if (p.wounded) continue; if (p.bot) this.botNight(p, dt); this.runPlan(p, dt); }
    this.woundTick(dt);
    // 사람 마피아: 도구 근처에 가면 줍고 "정하림"으로 변신
    const hm = this.human;
    if (hm.alive && hm.role === 'mafia' && !hm.persona && !hm.wounded && hm.plan && !hm.plan.done) {
      for (const pk of this.pickups) if (!pk.taken && Math.hypot(pk.x - hm.b.x, pk.z - hm.b.z) < 1.2) { this.pickTool(hm, pk); this.hero.walkSpeed = this.hero.runSpeed = SPEED.hunter; break; }
    }
    // 사람이 시민이 아닐 때 진행 막대/힌트
    const h = this.human; let prog = null;
    if (h.alive && h.plan && !h.plan.done && h.plan.prog > 0 && ['medicine', 'investigate', 'recruit'].includes(h.plan.kind)) prog = [{ medicine: '약을 건네는 중…', investigate: '조사 중…', recruit: '포교 중…' }[h.plan.kind], h.plan.prog / h.plan.need];
    if (h.wounded) prog = ['치료받지 못하면 사망!', 1 - h.wounded.t / CFG.wound];
    this.ui.progress(prog?.[0] ?? null, prog?.[1]); if (!prog) this.ui.progress(null);
    if (this.phase === 'night' && this.t <= 0) this.finishNight();
  }
  planNeed(kind) { return { medicine: 1.5, investigate: 3.5, recruit: 4.5 }[kind] ?? 0; }
  runPlan(p, dt) { // 능력 진행(사람/AI 공통): 대상에게 가까이 있으면 진행
    const pl = p.plan; if (!pl || pl.done || pl.target == null) return;
    const T = this.players[pl.target];
    if (!T.alive && pl.kind !== 'spy' && pl.kind !== 'track') { pl.done = true; return; }
    pl.need = pl.need ?? this.planNeed(pl.kind);
    const d = dist2(p, T);
    if (pl.kind === 'medicine') { if (d < 2.0) { pl.prog += dt; if (pl.prog >= pl.need) { pl.done = true; T.medicine = true; this.privateNote(p, `${T.name}에게 약을 줬다. 습격당하면 한 번 살아난다.`); if (T.isHuman) this.note('누군가 당신에게 약을 건넸다. (한 번 살 수 있다)'); } } else pl.prog = Math.max(0, pl.prog - dt * 0.5); }
    else if (pl.kind === 'investigate') { if (d < 2.5) { pl.prog += dt; if (pl.prog >= pl.need) { pl.done = true; this.finishInvestigate(p, T); } } else pl.prog = Math.max(0, pl.prog - dt * 0.4); }
    else if (pl.kind === 'recruit') { if (d < 2.0) { pl.prog += dt; if (pl.prog >= pl.need) { pl.done = true; this.finishRecruit(p, T); } } else pl.prog = Math.max(0, pl.prog - dt * 0.4); }
    else if (pl.kind === 'shoot' && p.bot && d < 8 && !p.usedShot) this.shoot(p);
  }
  privateNote(p, text) { if (p.isHuman) this.note(text); else if (p.mind) p.mind.results.push({ k: 'note', night: this.nightNo, text }); }
  finishInvestigate(p, T) {
    const mafiaTeam = T.team === 'mafia';
    if (p.mind) p.mind.results.push({ k: 'police', night: this.nightNo, target: T.id, result: mafiaTeam ? 'mafia' : 'citizen' });
    if (mafiaTeam) { p.mind?.known.set(T.id, { team: 'mafia', by: p.id }); p.mind?.bump(T, 1); T.forced = true; this.refreshLook(T); }
    else p.mind?.known.set(T.id, { team: 'citizen', by: p.id });
    if (p.isHuman) { this.note(`[조사] ${T.name}: ${mafiaTeam ? '마피아팀! (강제로 마피아 복장이 됐다 — V 로 호루라기)' : '시민팀 (수상한 점 없음)'}`); this.toast(mafiaTeam ? `${T.name}은(는) 마피아팀이에요! V 키로 호루라기를 불 수 있어요.` : `${T.name}은(는) 시민팀이에요.`, 4500); sfx.ding(); }
  }
  finishRecruit(p, T) {
    if (T.role === 'mafia' || T.follower || T.team === 'cult') { this.privateNote(p, `${T.name} 영입 실패 (영입할 수 없는 사람이었다).`); return; }
    if (!T.isHuman && rnd() < 0.35) { this.privateNote(p, `${eun(T.name)} 포교를 거부했다. (영입 실패)`); return; } // 설득되지 않는 사람도 있다
    this.recruitPending = this.recruitPending ?? []; this.recruitPending.push({ by: p.id, id: T.id });
    this.privateNote(p, `${T.name}을(를) 포교했다. (아침에 광신도가 된다)`);
  }
  /** 모든 능력 판정을 한꺼번에: 습격, 치료, 군인 */
  lethalHit(victim, attacker, cause) {
    if (!victim.alive || victim.wounded) return 'ignored';
    if (victim.medicine) { // 약
      victim.medicine = false; const doc = this.byRole('doctor'); if (doc) { doc.cannotMed.add(victim.id); this.privateNote(doc, `${victim.name}이(가) 습격당했지만 내 약 덕분에 살았다! (이 사람에게는 다시 약을 줄 수 없다)`); doc.mind?.results.push({ k: 'saved', night: this.nightNo, target: victim.id }); }
      if (victim.isHuman) { this.note('습격당했지만 약을 먹고 살아났다!'); this.ui.alert('약 덕분에 살아났다!'); setTimeout(() => this.ui.alert(''), 2500); }
      this.ui.system(`${victim.name}이(가) 습격당했지만 살아남았다…`);
      return 'saved';
    }
    victim.wounded = { t: CFG.wound, by: attacker, cause, heal: 0 }; victim.b.speed = 0; victim.fear = null;
    startFall(victim.model, 0.5); this.blood.push(bloodDecal(this.scene, victim.b.x, victim.b.z + 0.15, 1.6));
    if (cause === 'mafia') { this.killedByMafia.add(victim.id); this.prints.refresh(); }
    if (victim.isHuman) { this.ui.alert('습격당했다! 의사가 5초 안에 치료하지 않으면 죽는다'); }
    return 'wounded';
  }
  woundTick(dt) {
    for (const w of this.players) {
      if (!w.wounded || !w.alive) continue;
      const W = w.wounded; W.t -= dt;
      const doc = this.players.find(d => d.role === 'doctor' && !d.follower && d.alive && !d.wounded && dist2(d, w) < 2.6);
      if (doc) W.heal += dt; else W.heal = Math.max(0, W.heal - dt * 0.5);
      if (W.heal >= 1.0) { // 치료 성공
        w.wounded = null; resetFall(w.model); this.privateNote(w, `의사가 치료해 줘서 살았다!`); this.privateNote(doc, `${w.name}을(를) 치료해서 살렸다!`); doc.mind?.results.push({ k: 'saved', night: this.nightNo, target: w.id });
        if (w.isHuman) { this.ui.alert('의사가 치료해 줬다! 살았다'); setTimeout(() => this.ui.alert(''), 2500); }
        this.ui.system(`${w.name}이(가) 치료받고 살아났다.`); continue;
      }
      if (W.t <= 0) this.die(w, W.by, W.cause);
    }
  }
  die(p, by, cause, opts = {}) {
    if (!p.alive) return;
    p.alive = false; p.dead = true; p.wounded = null; p.b.speed = 0; p.deathZone = this.zone(p); p.deathCause = cause; p.deathBy = by?.id ?? null;
    if (!(cause === 'exec')) { /* 시신은 그 자리에 남는다 */ }
    if (p.persona || p.forced) { p.persona = false; p.forced = false; removeHunterLook(p.model); }
    p.tag.visible = false; p.bubble.visible = false;
    if (p.isHuman) { if (!opts.silent) { const gb = buildModel(); gb.rotation.order = 'YXZ'; gb.position.set(p.b.x, 0.13, p.b.z); gb.rotation.set(-1.5, p.b.heading, 0); this.scene.add(gb); this.ghostBody = gb; } this.hero.model.visible = false; }
    this.spawnGhost(p);
    this.deathsTonight.push({ p, by, cause });
    if (cause === 'mafia') this.killedByMafia.add(p.id);
    if (cause !== 'exec') this.ui.system(`${p.name}이(가) 숨졌다.`);
    // 군인: 마피아/자경단원에게 죽으면 죽인 사람도 함께 죽는다
    if (p.role === 'soldier' && !p.follower && (cause === 'mafia' || cause === 'gun') && by && by.alive) { this.ui.system(`군인 ${p.name}과(와) 함께 ${by.name}도 숨졌다!`); this.die(by, null, 'soldier'); }
    this.prints.refresh();
  }
  spawnGhost(p) {
    const mesh = makeGhost(); mesh.position.set(p.b.x, 0.5, p.b.z); mesh.rotation.y = p.b.heading; mesh.visible = false; this.scene.add(mesh);
    this.ghosts.push({ p, mesh, ph: rnd() * 6.28, x: p.b.x, z: p.b.z });
  }
  talkGhosts() { // 영매: 유령과 대화
    const gs = this.ghosts; if (!gs.length) { this.toast('아직 죽은 사람이 없어요.', 2500); return; }
    this.ui.panel({ title: '🔮 유령과 대화', body: '누구와 이야기할까요?', rows: gs.map(g => ({ label: g.p.name, onClick: () => { const info = this.ghostInfo(g.p); this.ui.panel(); this.say(g.p, info); this.note(`[영매] ${g.p.name}(유령): ${info}`); } })), buttons: [{ label: '닫기', onClick: () => this.ui.panel() }] });
  }
  ghostInfo(p) {
    const lines = [], m = p.mind;
    if (p.deathCause === 'exec') return `나는 투표로 처형당했어. 내 직업은 ${p.follower ? '사이비 광신도' : ROLES[p.role].name}였어.${p.team === 'mafia' ? ' 그래, 나는 마피아팀이었어.' : ' 나는 마피아가 아니었어.'}`;
    if (p.deathCause === 'mafia') { const hp = this.hunter; lines.push(`나는 ${zoneName(p.deathZone)}에서 가면 쓴 "${PERSONA}"에게 습격당했어. 얼굴은 못 봤어. 도구는 ${TOOLS[this.lastTool ?? hp?.tool]?.name ?? '흉기'}였어.`); }
    else if (p.deathCause === 'gun') lines.push(`나는 ${zoneName(p.deathZone)}에서 총에 맞았어.`);
    else if (p.deathCause === 'soldier') lines.push(`나는 군인과 함께 죽었어. 내가 군인을 해쳤거든.`);
    if (m) { const met = [...m.hist].filter(([id, a]) => a.some(h => h.night === this.nightNo)).map(([id]) => this.players[id].name); if (met.length) lines.push(`죽기 전에 ${joinNames(met.slice(0, 4))}을(를) 봤어.`); }
    return lines.join(' ') || '기억이 흐릿해…';
  }
  shoot(p) {
    if (p.usedShot || !p.plan || p.plan.kind !== 'shoot') return; const T = this.players[p.plan.target]; if (!T?.alive) return;
    if (dist2(p, T) > 10.5) { if (p.isHuman) this.ui.setHint('너무 멀어요! 10m 안으로 접근하세요.'); return; }
    p.usedShot = true; p.plan.done = true; sfx.gunshot(); this.ui.flash();
    for (const q of this.alive()) if (q.mind) q.mind.events.push({ k: 'gunshot', night: this.nightNo, zone: this.zone(p), t: this.time });
    this.ui.system('총소리가 울렸다!'); this.lethalHit(T, p, 'gun'); p.mind?.results.push({ k: 'shot', night: this.nightNo, target: T.id });
  }
  blowWhistle(p) { // 경찰의 긴급 호루라기: 모두에게 들리고 AI 가 소리 난 곳으로 모인다
    if (p.whistleNight === this.nightNo) { if (p.isHuman) this.toast('이번 밤에는 이미 호루라기를 불었어요.', 1800); return; }
    if (this.phase !== 'night') { if (p.isHuman) this.toast('호루라기는 밤에만 불 수 있어요.', 1800); return; }
    p.whistleNight = this.nightNo; sfx.whistle(); const z = this.zone(p);
    this.ui.system(`삐익— 호루라기 소리가 울렸다! (${zoneName(z)} 쪽)`);
    for (const q of this.alive()) if (q.mind && q !== p) { q.mind.events.push({ k: 'whistle', night: this.nightNo, zone: z, t: this.time }); if (q.team === 'citizen' && rnd() < 0.7) q.attention = { x: p.b.x, z: p.b.z, until: this.time + 20 }; }
  }
  addPhoto(p, img, cam) { // 사진 기록. 프레임 안에 보이는 사람과 범인(가면)을 적는다
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const inFrame = this.alive().filter(q => q !== p && (() => { const dx = q.b.x - cam.position.x, dz = q.b.z - cam.position.z, d = Math.hypot(dx, dz); return d < 14 && d > 0.5 && (dx * fwd.x + dz * fwd.z) / d > 0.62; })());
    const names = inFrame.map(q => q.persona || q.forced ? `${PERSONA}(가면)` : q.name);
    const when = this.phase === 'night' ? `${this.nightNo}일차 밤` : `${this.dayNo}일차 낮`;
    const caption = `${when} · ${zoneName(this.zone(p))} · 찍은 사람: ${p.name}<br>찍힌 사람: ${names.length ? names.join(', ') : '없음'}`;
    this.photos.push({ img, caption, by: p.id, night: this.nightNo, persona: inFrame.some(q => q.persona || q.forced), ids: inFrame.map(q => q.id), zone: this.zone(p) });
    sfx.shutter(); if (p.isHuman) this.toast('📷 찰칵! 사진첩(P)에 기록됐어요.', 1800);
    this.ui.system(`📷 ${p.name}이(가) 사진을 찍었다.`);
  }
  aiPhoto(p) { // AI 기자: 화면 밖에서 따로 그려서 찍는다
    if (!this.renderer) return;
    try {
      const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 80); cam.position.set(p.b.x, 1.6, p.b.z); cam.lookAt(p.b.x + Math.sin(p.b.heading) * 5, 1.4, p.b.z + Math.cos(p.b.heading) * 5); cam.updateMatrixWorld();
      const rt = new THREE.WebGLRenderTarget(320, 200); const prev = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(rt); this.renderer.render(this.scene, cam); this.renderer.setRenderTarget(prev);
      const px = new Uint8Array(320 * 200 * 4); this.renderer.readRenderTargetPixels(rt, 0, 0, 320, 200, px); rt.dispose();
      const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'), im = g.createImageData(320, 200);
      for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) { const s = ((199 - y) * 320 + x) * 4, d = (y * 320 + x) * 4; for (let k = 0; k < 3; k++) im.data[d + k] = Math.min(255, 255 * Math.pow(px[s + k] / 255, 1 / 2.2) * 1.15); im.data[d + 3] = 255; }
      g.putImageData(im, 0, 0); this.addPhoto(p, c.toDataURL('image/jpeg', 0.6), cam);
    } catch (e) { /* 사진 실패는 무시 */ }
  }

  // ───────── 마피아 사냥 ─────────
  pickTool(p, pk) {
    pk.taken = true; this.scene.remove(pk.mesh);
    p.persona = true; p.tool = pk.kind; this.lastTool = pk.kind; this.refreshLook(p);
    this.ui.system(`누군가 ${eul(TOOLS[pk.kind].name)} 들고 "${PERSONA}"로 변신했다…`);
    const T = p.plan?.target != null ? this.players[p.plan.target] : p.hunt?.target;
    this.target = T ?? null;
    if (p.bot) p.bot.pause = 1.2;
    if (T?.isHuman) { this.ui.setHint(`${iga(PERSONA)} 당신을 쫓아요! 도망치세요!`); sfx.heartbeat(); this.ui.big(`범인 "${PERSONA}" 출현!`, true); setTimeout(() => this.ui.big(''), 2000); }
    else if (p.isHuman) this.ui.setHint(`사냥 시작! ${eul(T?.name)} 쫓아 가까이 가서 Space (X: 포기)`);
  }
  humanAttack() {
    const h = this.human, T = h.plan?.target != null ? this.players[h.plan.target] : null;
    if (!T?.alive || this.attackCd > 0) return; this.attackCd = 0.7;
    if (dist2(h, T) < CFG.killDist + 0.5) this.attackDone(h, T); else this.ui.setHint('빗나갔다! 더 가까이 가서 Space');
  }
  attackDone(p, T) { // 습격 성공: 도구를 내려놓고 곧바로 시민 복장으로
    const r = this.lethalHit(T, p, 'mafia'); this.target = null;
    this.endHunt(p, r === 'saved' ? '습격했지만 약 때문에 실패했다' : '습격 성공');
    if (p.hunt) p.hunt.used = true;
    if (p.plan) p.plan.done = true;
  }
  endHunt(p, msg) {
    if (!p.persona) return; p.persona = false; this.refreshLook(p); p.tool = null;
    if (p.hunt) { p.hunt.state = 'cool'; p.hunt.t = 0; }
    if (p.isHuman) { this.ui.setHint(`${msg}. 이제 시민처럼 평범하게 행동하세요.`); this.hero.walkSpeed = this.hero.runSpeed = SPEED.humanWalk; }
  }
  huntStep(p, dt) { // AI 마피아: 평소엔 시민처럼 → 도구 줍기 → 변신하고 추격 → 끝나면 시민 복장으로 돌아가 평범하게
    const H = p.hunt; if (!H) return this.wander(p, dt); H.t += dt;
    if (H.state === 'blend' || H.state === 'cool') {
      this.wander(p, dt);
      if (H.state === 'blend' && H.t > H.blendT && !H.used && this.t > 22) { // 사냥 시작: 외로운 대상 고르기
        const cands = this.alive().filter(q => q !== p && q.team !== 'mafia');
        if (!cands.length) { H.used = true; return; }
        const iso = q => -this.alive().filter(o => o !== q && o !== p && dist2(o, q) < 8).length + rnd() * 1.2;
        H.target = cands.map(q => ({ q, w: iso(q) })).sort((a, b) => b.w - a.w)[0].q; p.plan.target = H.target.id;
        H.state = 'toTool'; p.bot.path = []; H.pk = null;
      }
    } else if (H.state === 'toTool') {
      const free = this.pickups.filter(pk => !pk.taken); if (!free.length) { H.state = 'cool'; H.used = true; return; }
      if (!p.bot.path.length || p.bot.pi >= p.bot.path.length) { const hz = zoneIdAt(p.b.x, p.b.z); const pk = free.sort((a, c) => hops(hz, a.zone) - hops(hz, c.zone))[0]; H.pk = pk; p.bot.path = pathPoints(p.b.x, p.b.z, pk.zone, { x: pk.x, z: pk.z }); p.bot.pi = 0; }
      this.followPath(p, dt, SPEED.follow);
      if (H.pk && !H.pk.taken && Math.hypot(H.pk.x - p.b.x, H.pk.z - p.b.z) < 1.0) { this.pickTool(p, H.pk); H.state = 'chase'; H.chase = 0; }
    } else if (H.state === 'chase') {
      const T = H.target;
      if (!T?.alive || T.wounded) { this.endHunt(p, '추격 종료'); return; }
      H.chase += dt; const b = p.bot;
      if (b.pause > 0) { b.pause -= dt; p.b.speed = 0; return; }
      b.repath -= dt;
      if (b.repath <= 0 || !b.path.length) { b.repath = 0.5; const hz = zoneIdAt(p.b.x, p.b.z), tz = zoneIdAt(T.b.x, T.b.z); b.path = hz === tz ? [{ x: T.b.x, z: T.b.z }] : pathPoints(p.b.x, p.b.z, tz, { x: T.b.x, z: T.b.z }); b.pi = 0; }
      this.followPath(p, dt, SPEED.hunter);
      if (dist2(p, T) < CFG.killDist) this.attackDone(p, T);
      else if (H.chase > CFG.huntMax) this.endHunt(p, '추격 포기');
    }
  }
  fleeFrom(p, from, dt) {
    const b = p.bot, d = dist2(p, from); b.repath -= dt;
    const mz = zoneIdAt(p.b.x, p.b.z), hz = zoneIdAt(from.b.x, from.b.z);
    if (b.repath <= 0 || !b.path.length || b.pi >= b.path.length) {
      b.repath = 1.2; let best = null, bs = -1e9;
      for (const z of PLAY_ZONES) { const s = hops(hz, z) * 3 - hops(mz, z) * 0.8 + (z === mz ? -2 : 0) + rnd() * 1.5; if (s > bs) { bs = s; best = z; } }
      b.path = pathPoints(p.b.x, p.b.z, best, randomPoint(this.col, best)); b.pi = 0;
    }
    if (d < 2.6) { const ax = (p.b.x - from.b.x) / Math.max(d, 0.01), az = (p.b.z - from.b.z) / Math.max(d, 0.01); this.move(p, p.b.x + ax * SPEED.flee * dt, p.b.z + az * SPEED.flee * dt, dt); }
    else this.followPath(p, dt, SPEED.flee);
  }
  botNight(p, dt) { // AI 의 밤 행동
    const hp = this.hunter;
    // 쫓기는 대상 / 범인을 본 시민은 도망친다
    if (hp?.persona && hp.alive && this.target === p) return this.fleeFrom(p, hp, dt);
    if (p.fear && this.time < p.fear.until && p.team === 'citizen' && p.fear.from.alive && p.fear.from.persona) return this.fleeFrom(p, p.fear.from, dt);
    // 의사: 누군가 습격당했으면 달려가 치료
    if (p.role === 'doctor' && !p.follower) { const w = this.players.find(q => q.wounded && q.alive); if (w) { this.goNear(p, w, dt, SPEED.hunter); return; } }
    const pl = p.plan;
    if (p.role === 'mafia') return this.huntStep(p, dt);
    if (pl && !pl.done && pl.target != null && ['medicine', 'investigate', 'recruit', 'shoot'].includes(pl.kind)) { const T = this.players[pl.target]; if (T.alive) { this.goNear(p, T, dt, pl.kind === 'shoot' ? SPEED.follow : SPEED.follow, pl.kind === 'shoot' ? 6 : 1.3); return; } }
    if (p.role === 'doctor' && pl?.done && pl.target != null) { const T = this.players[pl.target]; if (T.alive && !T.wounded) { this.goNear(p, T, dt, SPEED.follow, 2.4); return; } } // 약을 준 뒤에도 곁에서 지킨다
    if (p.role === 'reporter' && this.time - (p.lastPhoto ?? -99) > 24 && (p.photoCount ?? 0) < 8) { p.lastPhoto = this.time; p.photoCount = (p.photoCount ?? 0) + 1; this.aiPhoto(p); }
    if (p.attention && this.time < p.attention.until) { const a = p.attention; if (Math.hypot(a.x - p.b.x, a.z - p.b.z) > 3) { p.bot.path = p.bot.path.length ? p.bot.path : pathPoints(p.b.x, p.b.z, zoneIdAt(a.x, a.z), { x: a.x, z: a.z }); p.bot.pi = Math.min(p.bot.pi, p.bot.path.length); this.followPath(p, dt, SPEED.follow); if (p.bot.pi >= p.bot.path.length) { p.attention = null; } return; } p.attention = null; }
    this.wander(p, dt);
  }
  goNear(p, T, dt, speed, stay = 1.3) {
    const b = p.bot; const d = dist2(p, T); if (d < stay) { p.b.speed = Math.max(0, p.b.speed - dt * 20); return; }
    b.repath -= dt;
    if (b.repath <= 0 || !b.path.length) { b.repath = 0.8; const hz = zoneIdAt(p.b.x, p.b.z), tz = zoneIdAt(T.b.x, T.b.z); b.path = hz === tz && d < 6 ? [{ x: T.b.x, z: T.b.z }] : pathPoints(p.b.x, p.b.z, tz, { x: T.b.x, z: T.b.z }); b.pi = 0; }
    this.followPath(p, dt, speed);
  }

  // ───────── 밤: 끝(아침) ─────────
  finishNight() {
    this.phase = 'dawn'; this.t = 7; this.setNight(0);
    for (const p of this.players) p.nightZone = zoneIdAt(p.b.x, p.b.z);
    const lines = [];
    // 상처 입은 채로 밤이 끝나면 사망
    for (const w of this.players) if (w.wounded && w.alive) this.die(w, w.wounded.by, w.wounded.cause);
    { const mp = this.mafiaP; this.prints.prune(m => (m.night >= this.nightNo - 1) && ((mp && m.owner === mp.id) || this.killedByMafia.has(m.owner))); } // 쓸모 있는 발자국(마피아, 마피아에게 죽은 사람)만 남긴다
    // 포교 반영
    for (const r of this.recruitPending ?? []) { const T = this.players[r.id]; if (T.alive && !T.follower && T.role !== 'mafia') { T.follower = true; T.team = 'cult'; T.plan = null; if (T.mind) T.mind.setAllies(); if (T.isHuman) this.note('당신은 사이비 광신도가 되었다. 교주를 따르며 이제 제3세력이다.'); const c = this.players[r.by]; c.mind?.allies.add(T.id); T.mind?.allies.add(c.id); if (c.isHuman) this.note(`${T.name}이(가) 광신도가 되었다.`); } }
    this.recruitPending = [];
    // 능력 결과: 스파이/추적자
    for (const p of this.alive()) {
      const pl = p.plan; if (!pl || pl.target == null || p.follower) continue; const T = this.players[pl.target];
      if (pl.kind === 'spy') { const rn = T.follower ? '사이비 광신도' : ROLES[T.role].name; this.privateNote(p, `[스파이] ${T.name}의 직업: ${rn}`); p.mind?.known.set(T.id, { role: T.role, team: T.team, by: p.id }); }
      if (pl.kind === 'track') { const s = this.trackSummary(T); this.privateNote(p, `[추적자] ${T.name}: ${s}`); }
    }
    // 사립탐정(AI): 발자국 단서로 마피아 용의자를 추린다
    const det = this.byRole('detective'); if (det?.alive && det.mind) this.aiDetective(det);
    // 영매(AI): 유령에게 들은 이야기
    const med = this.byRole('medium'); if (med?.alive && med.mind) for (const g of this.ghosts) med.mind.events.push({ k: 'ghost', night: this.nightNo, from: g.p.id, text: this.ghostInfo(g.p) });
    // 사진: 사진 속 사람들 의심
    for (const ph of this.photos.filter(x => x.night === this.nightNo && x.persona)) for (const q of this.alive()) if (q.mind) for (const id of ph.ids) { const T = this.players[id]; if (!(T.persona || T.forced)) q.mind.bump(T, 0.2, '범인이 찍힌 사진 속에 같이 있었다'); }
    // 사망 보고
    const deaths = this.deathsTonight.filter(d => d.cause !== 'exec');
    if (!deaths.length) lines.push('밤 사이 아무도 죽지 않았다.');
    for (const d of deaths) {
      if (d.cause === 'mafia') lines.push(`${iga(d.p.name)} 살해당했다.\n단서: 범인 "${PERSONA}"${this.lastTool ? ' · 도구 ' + TOOLS[this.lastTool].name : ''} · 장소 ${zoneName(d.p.deathZone)}`);
      else if (d.cause === 'gun') lines.push(`${iga(d.p.name)} 총에 맞아 숨졌다. (${zoneName(d.p.deathZone)})`);
      else if (d.cause === 'soldier') lines.push(`${iga(d.p.name)} 군인과 함께 숨진 채 발견됐다. ${d.p.team === 'mafia' ? '(마피아팀이었다!)' : ''}`);
    }
    this.ui.panel({ title: `🌅 ${this.nightNo}일차 아침`, body: lines.join('\n\n'), buttons: [{ label: '계속', onClick: () => { this.t = Math.min(this.t, 0.01); } }] });
    this.ui.setHint(''); this.ui.progress(null); this.ui.alert('');
    this.hero.walkSpeed = this.hero.runSpeed = undefined; this.target = null;
    for (const pk of this.pickups) this.scene.remove(pk.mesh); this.pickups = [];
    for (const p of this.players) { if (p.persona) { p.persona = false; p.tool = null; } p.forced = false; p.medicine = false; p.fear = null; this.refreshLook(p); if (p.alive) { p.wounded = null; resetFall(p.model); } }
  }
  trackSummary(T) {
    const rec = this.rec[this.nightNo - 1]?.[T.id]; if (!rec?.length) return '움직임 기록이 없다.';
    const zs = []; for (const r of rec) if (zs[zs.length - 1] !== r.zone) zs.push(r.zone);
    const met = new Map(); for (const r of rec) for (const id of r.near) met.set(id, (met.get(id) ?? 0) + 1);
    const long = [...met].filter(([, n]) => n >= 3).map(([id]) => this.players[id].name);
    return `${zs.map(zoneName).join(' → ')} 순으로 움직였다.${long.length ? ' 오래 함께 있었던 사람: ' + joinNames(long) : ' 오래 함께 있던 사람은 없다.'}${this.hunter && T.id === this.hunter.id && this.hunter.hunt?.used ? ' (밤에 한 번 멈춰 서서 무언가를 했다)' : ''}`;
  }
  aiDetective(det) { // 사립탐정(AI): 파란 발자국(마피아)이 지나간 곳과 겹치는 사람을 의심(완벽하지 않게)
    const mp = this.mafiaP; if (!mp) return;
    const blues = []; for (let i = 0; i < this.prints.n; i++) { const m = this.prints.meta[i]; if (m && m.owner === mp.id && m.night === this.nightNo) blues.push(m); }
    if (!blues.length) return;
    const rec = this.rec[this.nightNo - 1] ?? {}; const score = new Map();
    for (const q of this.alive()) { if (q === det) continue; const tr = rec[q.id] ?? []; let hit = 0; for (const b of blues) if (tr.some(r => Math.hypot(r.x - b.x, r.z - b.z) < 3)) hit++; score.set(q.id, hit / Math.max(1, blues.length)); }
    const top = [...score].sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [id, s] of top) if (s > 0.1) det.mind.bump(this.players[id], 0.3 + s * 0.3 + (rnd() - 0.5) * 0.2, '파란 발자국이 지나간 길과 동선이 겹쳤다');
  }
  printColor(m) {
    const h = this.human; if (!this.active || !h.alive || h.role !== 'detective' || h.follower) return null;
    const mp = this.mafiaP; if (mp && m.owner === mp.id) return 0x2f7dff;       // 마피아의 발자국: 파랑
    if (this.killedByMafia.has(m.owner)) return 0xff3b3b;                           // 마피아에게 죽은 사람의 발자국: 빨강
    return null;                                                                    // 그 외에는 보이지 않는다
  }

  // ───────── 결과 ─────────
  afterDeath(from) {
    const w = this.checkWin(); if (w) return this.over(w);
    if (from === 'exec') this.startNight(); else this.nextDay();
  }
  checkWin() {
    const al = this.alive(); if (!al.length) return 'none';
    const c = al.filter(p => p.team === 'citizen').length, m = al.filter(p => p.team === 'mafia').length, k = al.filter(p => p.team === 'cult').length;
    if (m === 0 && k === 0) return 'citizen';
    if (m > 0 && m >= c + k) return 'mafia';
    if (k > 0 && k >= c + m) return 'cult';
    return null;
  }
  over(winner) {
    this.phase = 'over'; this.dayBtn(false); this.ui.setHint(''); this.ui.bars(false); this.setNight(0); this.ui.progress(null);
    const h = this.human, win = winner === h.team;
    const nm = { citizen: '시민팀이 모든 위협을 물리쳤어요.', mafia: '마피아팀이 이겼어요.', cult: '사이비 교단이 마을을 장악했어요.', none: '아무도 남지 않았어요.' }[winner];
    const reveal = this.players.map(p => `${p.name}: ${p.follower ? '광신도' : ROLES[p.role].name}${p.alive ? '' : ' ✝'}`).join(' · ');
    this.ui.panel({ title: win ? '🏆 승리!' : '💀 패배…', body: `${nm}\n\n${reveal}`, buttons: [{ label: '🔁 다시 하기', onClick: () => this.showRoleSelect() }, { label: '자유 이동', onClick: () => { this.reset(); this.active = false; this.phase = 'off'; this.ui.panel(); this.ui.setHud('', ''); this.ui.notesVisible(false); this.ui.startButton(true, () => this.showRoleSelect()); } }] });
  }

  // ───────── 움직임(AI) ─────────
  move(p, nx, nz, dt) {
    const c = p.b.circle, sx = c.x, sz = c.z; c.x = 1e6; c.z = 1e6;
    const r = resolveCircle(nx, nz, 0.3, this.col, this.world.bounds); c.x = sx; c.z = sz;
    const mv = Math.hypot(r.x - p.b.x, r.z - p.b.z);
    p.b.speed = mv / Math.max(dt, 1e-4);
    if (mv > 1e-4) p.b.heading += wrap(Math.atan2(r.x - p.b.x, r.z - p.b.z) - p.b.heading) * Math.min(1, dt * 10);
    p.b.x = r.x; p.b.z = r.z; c.x = r.x; c.z = r.z; return mv;
  }
  followPath(p, dt, speed) {
    const b = p.bot, g = b.path[b.pi];
    if (!g) { p.b.speed = 0; return true; }
    const dx = g.x - p.b.x, dz = g.z - p.b.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { b.pi++; return b.pi >= b.path.length; }
    const step = Math.min(d, speed * dt);
    const mv = this.move(p, p.b.x + (dx / d) * step, p.b.z + (dz / d) * step, dt);
    b.stuck = mv < step * 0.25 ? b.stuck + dt : 0;
    if (b.stuck > 0.9) { b.path = []; b.stuck = 0; b.wait = 0.2; }
    return false;
  }
  wander(p, dt) {
    const b = p.bot;
    if (b.wait > 0) { b.wait -= dt; p.b.speed = Math.max(0, p.b.speed - dt * 20); return; }
    if (!b.path.length || b.pi >= b.path.length) { const zid = pick(PLAY_ZONES.filter(z => z !== zoneIdAt(p.b.x, p.b.z))); b.path = pathPoints(p.b.x, p.b.z, zid, randomPoint(this.col, zid)); b.pi = 0; }
    if (this.followPath(p, dt, SPEED.wander)) { b.wait = 1.2 + rnd() * 3; b.path = []; p.b.speed = 0; }
  }

  // ───────── 프레임 ─────────
  update(dt) {
    this.time += dt;
    for (const p of this.players) { if (p.bubbleT > 0) { p.bubbleT -= dt; if (p.bubbleT <= 0) p.bubble.visible = false; } }
    if (!this.active) return;
    this.t -= dt;
    // AI 관찰(0.5초마다)
    this.perceiveAcc += dt; if (this.perceiveAcc > 0.5) { this.perceiveAcc = 0; for (const p of this.alive()) p.mind?.observe(); }
    switch (this.phase) {
      case 'day':
        for (const p of this.alive()) if (p.bot) this.botDay(p, dt);
        this.dayChatter(dt);
        if (this.t <= 0) this.startVote();
        break;
      case 'toVote': if (this.t <= 0) { this.seatAll(); this.startTalk(); } break;
      case 'talk': this.updateTalk(dt); if (this.t <= 0) this.openVote(); break;
      case 'vote': if (this.t <= 0) { this.ui.panel(); this.resolveVote(); } break;
      case 'resolve': if (this.t <= 0) { this.ui.panel(); if (this.execTarget) this.startExecution(this.execTarget); else this.startNight(); } break;
      case 'exec': this.updateExec(dt); break;
      case 'toNight': if (this.t <= 0) this.beginNight(); break;
      case 'pick': break;
      case 'night': this.nightTick(dt); break;
      case 'dawn': if (this.t <= 0) { this.ui.panel(); this.afterDeath('night'); } break;
      default: break;
    }
    this.animate(dt);
    this.refreshHud();
  }
  botDay(p, dt) { // 낮: 돌아다니고, 사진/유령 등은 아침에 처리
    if (p.attention) p.attention = null;
    this.wander(p, dt);
  }
  dayChatter(dt) { // 낮에 가까이 있는 AI 끼리 밤에 본 것을 이야기한다
    this.chatAcc += dt; if (this.chatAcc < 2.2) return; this.chatAcc = 0;
    if (this.dayNo < 2 && this.nightNo < 1) return;
    const ai = this.alive().filter(p => p.mind && p.b.speed < 0.5);
    for (const a of shuffle(ai)) {
      const near = ai.filter(q => q !== a && dist2(a, q) < 4.5); if (!near.length || this.time - (a.lastChat ?? -99) < 16) continue;
      const st = a.mind.nextStatement('day'); if (!st || st.act === 'chat') continue;
      a.lastChat = this.time; this.speak(a, st, 9); return;
    }
  }
  refreshHud() {
    const names = { day: '낮', toVote: '투표', talk: '토론', vote: '투표', resolve: '투표', exec: '처형', toNight: '밤', pick: '밤', night: '밤', dawn: '아침', over: '끝' };
    const time = ['day', 'talk', 'vote', 'night'].includes(this.phase) ? ` · ${Math.max(0, Math.ceil(this.t))}초` : '';
    const h = this.human, R = ROLES[h.role], ghost = h.alive ? '' : ' · 관전 중';
    const role = h.follower ? '<b style="color:#d2b8ff">사이비 광신도</b>' : `<b style="color:${R.team === 'citizen' ? '#9fe39f' : R.team === 'mafia' ? '#ff9a9a' : '#d2b8ff'}">${R.icon} ${R.name}</b>`;
    this.ui.setHud(`${this.phase === 'dawn' ? this.nightNo : (this.phase === 'night' || this.phase === 'pick' || this.phase === 'toNight') ? this.nightNo : this.dayNo}일차 · ${names[this.phase] ?? ''}${time}`, `당신: ${role} · 생존 ${this.alive().length}/12${ghost}`);
  }
  animate(dt) {
    const hv = this.human.alive && this.human.role === 'medium' && !this.human.follower;
    for (const g of this.ghosts) { g.ph += dt; g.mesh.visible = hv; g.mesh.position.set(g.x + Math.sin(g.ph * 0.6) * 0.4, 0.6 + Math.sin(g.ph * 1.3) * 0.12, g.z + Math.cos(g.ph * 0.5) * 0.4); g.mesh.rotation.y += dt * 0.4; }
    for (const p of this.players) {
      const t = p.b, m = p.model;
      if (p.dead || p.wounded) { updateFall(m, dt); continue; }
      if (!p.isHuman) { t.phase = advancePhase(t.phase, t.speed, dt); poseModel(m, t.phase, 1, t.sit, t.speed); m.position.set(t.x, 0, t.z); m.rotation.y = t.heading; }
      // 발자국(모두 기록, 보이는 건 사립탐정에게만 색으로)
      if (t.speed > 0.6 && t.sit < 0.2 && p.alive && this.phase === 'night') { // 발자국은 밤에만 남긴다(추리 대상)
        const lp = p.lastPrint, d = Math.hypot(t.x - lp.x, t.z - lp.z);
        if (d > 0.62) { lp.side *= -1; lp.x = t.x; lp.z = t.z; this.prints.add(t.x + Math.cos(t.heading) * 0.09 * lp.side, t.z - Math.sin(t.heading) * 0.09 * lp.side, t.heading, p.id, this.nightNo); }
      }
    }
    for (const pk of this.pickups) pk.mesh.userData.update?.(this.time);
    const nl = this.getNight(); for (const b of this.blood) setBloodNight(b, nl, this.time);
  }
}
