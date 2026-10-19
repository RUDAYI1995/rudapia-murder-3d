// AI 한 명의 "생각": 본 것을 기억하고(관찰), 누가 수상한지 추리하고(의심도), 사람처럼 말한다(대화).
//  - 관찰: 가까이 있는 사람이 어디 있었는지, 가면 쓴 범인을 봤는지, 시신을 봤는지, 자기가 쫓겼는지 기록한다.
//  - 추리: 말과 본 것이 어긋나면 의심, 범인 근처에 있던 사람 의심, 경찰 조사 결과/탐정 단서/사진을 근거로 의심.
//  - 대화: 밤새 본 것을 정리해서 말하고, 쫓기면 쫓긴다고 외치고, 남의 말에 반박·동의·변호한다.
//  - 마피아팀/교주는 거짓말을 할 수 있다(알리바이 조작, 가짜 직업 주장). 시민팀은 자기가 본 대로만 말한다.
// 서버 진실 기록(g.records)을 AI 가 마음대로 읽지 못하게, AI 는 자기 눈으로 본 것(observe)과 들은 말(hear)만 쓴다.
import { zoneIdAt, zoneName, PLAY_ZONES } from './nav.js';
import { iga, eul, eun, gwa, ro, pick, rnd, shuffle, joinNames } from './kr.js';
import { ROLES } from './roles.js';

const PERSONA = '정하림';
const TOOLN = { knife: '식칼', hammer: '망치', rope: '밧줄' };
const dist = (a, b) => Math.hypot(a.b.x - b.b.x, a.b.z - b.b.z);

export class Mind {
  constructor(g, p) { this.g = g; this.p = p; this.reset(); }

  reset() {
    this.seen = new Map();          // pid -> 마지막 목격 {zone, t, night}
    this.hist = new Map();          // pid -> 목격 기록 [{zone, t, night}]
    this.events = [];               // 내가 겪은 일 {k, night, zone, ...}
    this.sus = new Map();           // pid -> 의심도 0~1
    this.why = new Map();           // pid -> 의심한 이유(말로 할 것)
    this.known = new Map();         // pid -> {team?, role?, by}  확정 정보(경찰/스파이 결과 등)
    this.trail = [];                // 내 동선 [{zone,t,night}]
    this.lastTrail = -99; this.lastShout = -99;
    this.personaCd = new Map(); this.bodiesNoted = new Set(); this.attackNoted = new Set();
    this.pendingDefend = null;      // 누가 날 의심했다 {by, reason}
    this.callouts = [];             // 반박할 거리 {about, text}
    this.said = new Set();          // 이번 토론에서 이미 한 말 종류
    this.heardClaims = [];          // 들은 직업 주장 {by, role, target, result}
    this.heardAlibi = new Map();    // pid -> {zones, night}
    this.allies = new Set();
    this.results = [];              // 내 능력 결과(아침 보고용)
    this.chasedNight = -1;
    this.defended = new Set(); this.calledOut = new Set(); // 같은 말다툼이 끝없이 반복되지 않게
    for (const q of this.g.players) if (q !== this.p) this.sus.set(q.id, 0.1);
  }

  setAllies() { this.allies = new Set(); for (const q of this.g.players) if (q !== this.p && q.team === this.p.team && this.p.team !== 'citizen') this.allies.add(q.id); }
  s(q) { return this.allies.has(q.id) ? 0 : (this.sus.get(q.id) ?? 0.1); }
  bump(q, d, why) { if (this.allies.has(q.id) || q === this.p) return; this.sus.set(q.id, Math.max(0, Math.min(1, (this.sus.get(q.id) ?? 0.1) + d))); if (why && d > 0) { const a = this.why.get(q.id) ?? []; a.push(why); this.why.set(q.id, a); } }
  name(id) { return this.g.players[id].name; }
  zn(z) { return zoneName(z); }
  evil() { return this.p.team !== 'citizen'; }    // 거짓말을 할 수 있는 쪽(마피아팀·제3세력)

  // ───────── 관찰 (0.5초마다) ─────────
  observe() {
    const g = this.g, p = this.p; if (!p.alive) return;
    const b = p.b, z = zoneIdAt(b.x, b.z), night = g.nightNo;
    if (g.phase === 'night' && g.time - this.lastTrail > 4) { this.lastTrail = g.time; this.trail.push({ zone: z, t: g.time, night }); }
    for (const q of g.players) {
      if (q === p) continue;
      const d = dist(p, q); if (d > 11) continue;
      const qz = zoneIdAt(q.b.x, q.b.z); if (!(qz === z || d < 3.5)) continue;
      if (q.alive) {
        this.noteSeen(q, qz, night);
        if ((q.persona || q.forced) && g.time - (this.personaCd.get(q.id) ?? -99) > 8) {
          this.personaCd.set(q.id, g.time);
          const near = g.players.filter(o => o !== p && o !== q && o.alive && Math.hypot(o.b.x - q.b.x, o.b.z - q.b.z) < 6).map(o => o.id);
          this.events.push({ k: 'persona', night, zone: qz, t: g.time, tool: q.tool, forced: !!q.forced && !q.persona, near, who: q.id });
          if (this.p.team === 'citizen' && q.persona && d < 9) p.fear = { from: q, until: g.time + 7 }; // 시민은 범인을 보면 도망친다
          if (q.persona && d < 9 && g.time - this.lastShout > 12) { this.lastShout = g.time; g.say(p, pick(['가면 쓴 사람이다!!', '저기 범인이야, 도망쳐!', '으악, 가면 쓴 놈이 있어!']), { shout: true }); g.heardShout(p, qz); }
        }
        if (q.wounded && !this.attackNoted.has(q.id + ':' + night)) {
          this.attackNoted.add(q.id + ':' + night);
          const near = g.players.filter(o => o !== p && o !== q && o.alive && Math.hypot(o.b.x - q.b.x, o.b.z - q.b.z) < 6).map(o => o.id);
          this.events.push({ k: 'attack', night, zone: qz, t: g.time, victim: q.id, tool: g.hunter?.tool, near });
        }
      } else if (!this.bodiesNoted.has(q.id) && d < 6) {
        this.bodiesNoted.add(q.id);
        this.events.push({ k: 'body', night, zone: qz, t: g.time, who: q.id });
      }
    }
    const h = g.hunter;
    if (h && h.persona && h.alive && g.target === p && g.phase === 'night' && dist(h, p) < 12) this.onChased(h);
  }
  noteSeen(q, zone, night) {
    const t = this.g.time; this.seen.set(q.id, { zone, t, night });
    const a = this.hist.get(q.id) ?? []; const last = a[a.length - 1];
    if (!last || last.zone !== zone || t - last.t > 8) { a.push({ zone, t, night }); if (a.length > 40) a.shift(); this.hist.set(q.id, a); }
  }
  onChased(h) {
    const g = this.g, p = this.p; if (g.time - this.lastShout < 9) return;
    this.lastShout = g.time;
    if (this.chasedNight !== g.nightNo) { this.chasedNight = g.nightNo; this.events.push({ k: 'chased', night: g.nightNo, zone: zoneIdAt(p.b.x, p.b.z), t: g.time, tool: h.tool }); }
    const zn = this.zn(zoneIdAt(p.b.x, p.b.z));
    g.say(p, pick([`누가 날 쫓아오고 있어!!`, `가면 쓴 놈이 쫓아와! ${zn}이야!`, `살려줘! ${zn}에서 쫓기는 중이야!`, `${TOOLN[h.tool] ?? '흉기'} 든 놈이 따라와!!`]), { shout: true, chased: true });
    g.heardShout(p, zoneIdAt(p.b.x, p.b.z));
  }

  // ───────── 요약 ─────────
  nightsZones(night) { const z = []; for (const t of this.trail) if (t.night === night && z[z.length - 1] !== t.zone) z.push(t.zone); return z; }
  metIn(night) { // 구역 -> 만난 사람들
    const m = new Map();
    for (const [pid, arr] of this.hist) for (const h of arr) if (h.night === night) { if (!m.has(h.zone)) m.set(h.zone, new Set()); m.get(h.zone).add(pid); }
    return m;
  }
  summaryText(night) {
    const zones = this.nightsZones(night), met = this.metIn(night);
    if (!zones.length) return '어젯밤은 한 곳에 숨어 있었어서 본 게 별로 없어.';
    const route = zones.map(z => this.zn(z)).join(' → ');
    const bits = [];
    for (const z of zones) { const ids = [...(met.get(z) ?? [])].filter(id => this.g.players[id].alive || true); if (ids.length) bits.push(`${this.zn(z)}에서 ${joinNames(ids.map(id => this.name(id)))}${ids.length > 1 ? '을 봤고' : '를 봤고'}`); }
    return `어젯밤 나는 ${route} 순서로 다녔어.${bits.length ? ' ' + [...new Set(bits)].slice(0, 3).join(' ') + ' 그랬어.' : ' 마주친 사람은 없었어.'}`;
  }
  fakeAlibi() { // 거짓말용: 실제와 다른 곳
    const real = new Set(this.nightsZones(this.g.nightNo)); const zs = shuffle(PLAY_ZONES.filter(z => !real.has(z))).slice(0, 2);
    return { zones: zs, text: `어젯밤 나는 ${zs.map(z => this.zn(z)).join(' → ')}에 있었어. 혼자 조용히 있었어.` };
  }

  // ───────── 들은 말 반영 ─────────
  hear(st) {
    if (!this.p.alive || st.by === this.p.id) return;
    const g = this.g, by = g.players[st.by];
    switch (st.act) {
      case 'accuse': {
        const T = g.players[st.target];
        if (T === this.p) { const k = st.by + ':' + g.dayNo; if (!this.defended.has(k)) { this.defended.add(k); this.pendingDefend = { by: st.by, reason: st.reason }; this.bump(by, 0.08); } break; }
        if (this.s(T) > 0.35) this.bump(T, 0.1); else if (this.s(by) < 0.3) this.bump(T, 0.05);
        if (this.allies.has(st.target) && !this.defended.has('a' + st.by + ':' + g.dayNo)) { this.defended.add('a' + st.by + ':' + g.dayNo); this.pendingDefend = { by: st.by, ally: T, reason: st.reason }; }
        break; }
      case 'alibi': {
        this.heardAlibi.set(st.by, { zones: st.zones, night: st.night });
        const mine = (this.hist.get(st.by) ?? []).filter(h => h.night === st.night);
        const bad = mine.find(h => !st.zones.includes(h.zone));
        const ck = st.by + ':' + st.night;
        if (bad && st.zones.length && !this.calledOut.has(ck)) { this.calledOut.add(ck); this.bump(by, 0.35, `${this.zn(bad.zone)}에서 봤는데 ${this.zn(st.zones[0])}에 있었다고 말했다`); this.callouts.push({ about: st.by, text: `${by.name}, 너 ${st.zones.map(z => this.zn(z)).join(', ')}에 있었다고 했는데, 나는 ${this.zn(bad.zone)}에서 너를 봤어. 어떻게 된 거야?` }); }
        else if (mine.length && st.zones.some(z => mine.some(h => h.zone === z))) this.bump(by, -0.08);
        break; }
      case 'persona': case 'attack': case 'chased': case 'body': {
        this.events.push({ k: 'heard', night: st.night, zone: st.zone, from: st.by, what: st.act, tool: st.tool, near: st.near ?? [] });
        for (const id of st.near ?? []) { const q = g.players[id]; if (q !== this.p) this.bump(q, 0.14, `${this.zn(st.zone)}에서 범인 근처에 있었다고 들었다`); }
        break; }
      case 'claim': {
        this.heardClaims.push({ by: st.by, role: st.role, target: st.target, result: st.result, night: st.night });
        const T = g.players[st.target];
        const rivals = this.heardClaims.filter(c => c.role === st.role && c.by !== st.by).length;
        if (st.result === 'mafia') {
          if (T === this.p) { this.pendingDefend = { by: st.by, reason: `경찰이라면서 나를 마피아라고 했다` }; this.bump(by, 0.3); }
          else { const w = rivals ? 0.2 : 0.55; if (!this.allies.has(T.id)) { this.bump(T, w, `${iga(by.name)} 경찰이라며 마피아팀이라고 지목했다`); this.known.set(T.id, { team: 'mafia', by: st.by, soft: true }); } else this.bump(by, 0.5); }
        } else if (st.result === 'citizen' && !this.allies.has(T.id)) this.bump(T, -0.15);
        break; }
      default: break;
    }
  }

  // ───────── 말하기 ─────────
  /** 이번 토론에서 할 말을 하나 고른다. null 이면 할 말 없음 */
  nextStatement(mode = 'talk') {
    const g = this.g, p = this.p, night = g.nightNo, lastNight = Math.max(1, night);
    const say = (key, st) => { if (this.said.has(key)) return null; this.said.add(key); return { by: p.id, night, ...st }; };
    // 1) 나를 의심한 사람에게 변호/반박 (첫 발언 차례에는 건너뛴다)
    if (this.pendingDefend && mode !== 'initial') {
      const d = this.pendingDefend; this.pendingDefend = null; const by = g.players[d.by];
      if (d.ally) return { by: p.id, night, act: 'defend', target: d.by, text: pick([`${by.name}, 그건 좀 성급한 판단 같은데? ${d.ally.name}에 대해 아는 거 있어?`, `${eul(d.ally.name)} 의심하려면 근거부터 말해 줘, ${by.name}.`, `잠깐, ${iga(d.ally.name)} 뭘 했다는 거야? 난 잘 모르겠는데.`]) };
      const alibi = this.evil() ? this.fakeAlibi() : { zones: this.nightsZones(night), text: this.summaryText(night) };
      const base = pick([`나 아니야! ${alibi.text}`, `${by.name}, 나를 의심하는 건 이해하는데 ${alibi.text}`, `왜 나야? ${alibi.text} ${iga(by.name)} 더 수상해.`]);
      if (!this.evil() || rnd() < 0.5) this.bump(by, 0.06);
      return { by: p.id, night, act: 'alibi', zones: alibi.zones, text: base };
    }
    // 2) 반박할 거리(들은 알리바이가 내가 본 것과 다름)
    while (mode !== 'initial' && this.callouts.length) { const c = this.callouts.shift(); const by = g.players[c.about]; if (by.alive) return { by: p.id, night, act: 'accuse', target: c.about, reason: '말과 목격이 다르다', text: c.text }; }
    // 3) 직업 결과 보고
    const rr = this.roleReport(); if (rr) return rr;
    // 4) 쫓겼던 일
    const ch = this.events.find(e => e.k === 'chased' && e.night === lastNight);
    if (ch) { const st = say('chased', { act: 'chased', zone: ch.zone, tool: ch.tool, text: pick([`어젯밤에 누가 날 쫓아왔어! ${this.zn(ch.zone)}에서 가면 쓴 놈이 ${eul(TOOLN[ch.tool] ?? '흉기')} 들고 따라오더라. 겨우 도망쳤어.`, `나 어젯밤에 습격당할 뻔했어. ${this.zn(ch.zone)}에서 가면 쓴 사람이 ${TOOLN[ch.tool] ?? '흉기'}${ch.tool === 'hammer' ? '를' : '을'} 들고 쫓아왔어.`]) }); if (st) return st; }
    // 5) 범인(가면)을 본 일 / 습격 목격 / 시신 발견
    const pe = this.events.find(e => (e.k === 'persona' || e.k === 'attack') && e.night === lastNight && !this.said.has('p' + e.t));
    if (pe) { this.said.add('p' + pe.t); const near = (pe.near ?? []).map(id => this.name(id)); const isAtk = pe.k === 'attack';
      return { by: p.id, night, act: isAtk ? 'attack' : 'persona', zone: pe.zone, tool: pe.tool, near: pe.near ?? [], text: isAtk ? `${this.zn(pe.zone)}에서 ${iga(this.name(pe.victim))} 습격당하는 걸 봤어! 범인은 가면을 쓰고 ${TOOLN[pe.tool] ?? '흉기'}을 들고 있었어.${near.length ? ' 그때 근처에 ' + joinNames(near) + ' 있었어.' : ''}` : `${this.zn(pe.zone)}에서 가면 쓴 사람을 봤어. ${TOOLN[pe.tool] ? eul(TOOLN[pe.tool]) + ' 들고 있었어.' : '마피아 복장이었어.'}${near.length ? ' 근처에 ' + joinNames(near) + ' 있었어.' : ' 근처엔 아무도 없었어.'}` }; }
    const bd = this.events.find(e => e.k === 'body' && e.night >= lastNight - 1 && !this.said.has('b' + e.who));
    if (bd) { this.said.add('b' + bd.who); const seenNear = [...this.hist].filter(([id, a]) => a.some(h => h.zone === bd.zone && h.night === bd.night)).map(([id]) => this.name(id));
      return { by: p.id, night, act: 'body', zone: bd.zone, near: [...this.hist].filter(([id, a]) => a.some(h => h.zone === bd.zone && h.night === bd.night)).map(([id]) => +id), text: `${this.zn(bd.zone)}에서 ${this.name(bd.who)}의 시신을 봤어.${seenNear.length ? ' 그 구역에서 ' + joinNames(seenNear.slice(0, 3)) + '을 봤었어.' : ''}` }; }
    // 6) 알리바이(밤에 본 것 정리)
    if (night >= 1 && !this.said.has('alibi') && g.dayNo >= 1) {
      this.said.add('alibi');
      if (this.evil() && rnd() < 0.85) { const f = this.fakeAlibi(); return { by: p.id, night, act: 'alibi', zones: f.zones, text: f.text }; }
      if (this.trail.some(t => t.night === night)) return { by: p.id, night, act: 'alibi', zones: this.nightsZones(night), text: this.summaryText(night) };
    }
    // 7) 의심 가는 사람 지목
    const top = this.topSuspect();
    if (top && this.s(top) > 0.32 && !this.said.has('acc' + top.id)) {
      this.said.add('acc' + top.id); const why = (this.why.get(top.id) ?? []).slice(-1)[0];
      return { by: p.id, night, act: 'accuse', target: top.id, reason: why ?? '그냥 느낌', text: why ? `${iga(top.name)} 수상해. ${why}.` : pick([`${iga(top.name)} 계속 마음에 걸려. 행동이 좀 이상했어.`, `내 직감인데 ${iga(top.name)} 수상해.`]) };
    }
    if (mode === 'day') return null;
    return { by: p.id, night, act: 'chat', text: pick(['다들 차분하게 말해 보자. 어젯밤에 뭘 봤어?', '단서가 부족하네. 조금 더 얘기해 보자.', '누가 어디 있었는지 맞춰 보면 답이 나올 거야.', '난 아직 확신이 없어. 의견 더 들어 보고 싶어.']) };
  }
  topSuspect() {
    let best = null, bs = 0;
    for (const q of this.g.players) { if (q === this.p || !q.alive) continue; const s = this.s(q); if (s > bs) { bs = s; best = q; } }
    return best;
  }
  /** 직업 능력 결과를 말한다(경찰은 조사 결과 공개, 마피아팀은 가짜 주장) */
  roleReport() {
    const p = this.p, g = this.g, night = g.nightNo;
    if (p.role === 'police' && !p.follower) {
      const r = this.results.find(x => x.k === 'police' && x.night === night && !this.said.has('claim' + x.target));
      if (r && (r.result === 'mafia' || g.dayNo >= 2)) { this.said.add('claim' + r.target); const T = g.players[r.target];
        return { by: p.id, night, act: 'claim', role: 'police', target: r.target, result: r.result, text: r.result === 'mafia' ? `나 경찰이야. 어젯밤 ${eul(T.name)} 조사했는데 마피아팀이야! 믿어 줘.` : `나 경찰이야. ${eun(T.name)} 조사해 보니 시민팀이었어.` }; }
    }
    if (this.evil() && p.role !== 'cultist' && g.dayNo >= 2 && !this.said.has('fakeclaim') && rnd() < 0.3) {
      const real = this.heardClaims.find(c => c.role === 'police');
      const T = real ? g.players[real.by] : pick(g.players.filter(q => q.alive && q !== p && !this.allies.has(q.id)));
      if (T) { this.said.add('fakeclaim'); return { by: p.id, night, act: 'claim', role: 'police', target: T.id, result: 'mafia', text: real ? `아니야, 진짜 경찰은 나야. ${iga(T.name)} 거짓말하는 거야. 내가 조사해 보니 ${iga(T.name)} 마피아팀이야.` : `나 경찰이야. 어젯밤 ${eul(T.name)} 조사했더니 마피아팀이야!` }; }
    }
    if (p.role === 'doctor' && !p.follower) { const r = this.results.find(x => x.k === 'saved' && x.night === night && !this.said.has('saved')); if (r) { this.said.add('saved'); return { by: p.id, night, act: 'chat', text: `어젯밤 내가 ${eul(this.name(r.target))} 살렸어. 의사인 거 밝혀야 할 것 같아서 말해.` }; } }
    return null;
  }
  /** 사람 말에 대한 반응(채팅) */
  respondToHuman(text) {
    const g = this.g, p = this.p, h = g.human;
    if (!p.alive) return null;
    const mentioned = text.includes(p.name);
    if (!mentioned) return null;
    const accusing = /(마피아|범인|수상|의심|거짓|죽였)/.test(text);
    const asking = /(어디|뭐 ?했|봤|알리바이)/.test(text);
    if (accusing) { this.bump(h, 0.1); const alibi = this.evil() ? this.fakeAlibi() : { zones: this.nightsZones(g.nightNo), text: this.summaryText(g.nightNo) }; return { by: p.id, night: g.nightNo, act: 'alibi', zones: alibi.zones, text: pick([`나? 아니야! ${alibi.text}`, `근거도 없이 날 의심하는 거야? ${alibi.text}`]) }; }
    if (asking) { const al = this.evil() ? this.fakeAlibi() : { zones: this.nightsZones(g.nightNo), text: this.summaryText(g.nightNo) }; return { by: p.id, night: g.nightNo, act: 'alibi', zones: al.zones, text: al.text }; }
    return { by: p.id, night: g.nightNo, act: 'chat', text: pick(['응, 말해 봐.', '왜? 뭐 아는 거 있어?', '그래, 같이 생각해 보자.']) };
  }

  // ───────── 투표 ─────────
  voteChoice(alive) {
    const p = this.p, g = this.g; let best = -1, bs = this.evil() ? 0.12 : 0.22;
    const pub = new Map(); for (const q of g.players) if (q.alive && q !== p && !g.humanTalk) pub.set(q.id, 0);
    for (const q of alive) {
      if (q === p || this.allies.has(q.id)) continue;
      let s = this.s(q) + (rnd() - 0.5) * 0.1;
      if (this.evil()) { // 마피아팀/교주: 자기들을 겨눈 사람과 위협적인 직업 주장자를 노린다, 시민 중 의심받는 사람을 민다
        const c = this.heardClaims.find(x => x.by === q.id && x.role === 'police'); if (c) s += 0.35;
        const acc = g.talkLog?.filter(x => x.act === 'accuse' && x.by === q.id && this.allies.has(x.target)).length ?? 0; s += 0.25 * acc;
      } else {
        const k = this.known.get(q.id); if (k?.team === 'mafia') s += k.soft ? 0.3 : 0.7;
      }
      if (s > bs) { bs = s; best = q.id; }
    }
    return best;
  }
}
