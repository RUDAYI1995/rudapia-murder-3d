import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createWorld } from './world.js';
import { Hero } from './character.js';
import { layout, ZONES, zoneById } from './zones.js';
import { createBigMap } from './bigmap.js';
import { auditTexelDensity } from './audit.js';
import { Meeting } from './meeting.js';
import { createVoice } from './voice.js';
import { Game } from './game/game.js';
import { createReferenceWorld, configureReferenceView } from './reconstruction/scene.js';

const $ = id => document.getElementById(id);
const canvas = $('view');
const params = new URLSearchParams(location.search);
const HORROR = ['horror', 'reference'].includes(params.get('look'));
const QUALITY = params.get('q') ?? 'high'; // high | low

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// 1x 화면(dpr=1)에서도 1.35배로 그려서(수퍼샘플링) 가장자리와 가는 무늬가 뭉개지지 않게 한다. ?q=low 는 1배.
renderer.setPixelRatio(QUALITY === 'low' ? 1 : Math.min(Math.max(window.devicePixelRatio, 1.35), 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070a14, 0.014);
scene.background = new THREE.Color(0x05070d);
const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 400);

// 반사용 환경(IBL): 어두운 밤에도 대리석/금속에 은은한 반사가 생긴다
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.2;

// ── 낮/밤 프리셋 ──
const C = hex => new THREE.Color(hex);
const DAY = { fog: C(0xb9c9d8), fogD: 0.006, bg: C(0x9fc0e0), sun: C(0xfff0d8), sunI: 2.6, hemiS: C(0xcfe2ff), hemiG: C(0x66624e), hemiI: 0.7, env: 0.55, exposure: 0.8, bloom: 0.18, sunDir: new THREE.Vector3(-0.35, 0.8, -0.45) };
const NIGHT = { fog: C(0x0d1528), fogD: 0.011, bg: C(0x0a1122), sun: C(0x8eaeff), sunI: 2.4, hemiS: C(0x2e4070), hemiG: C(0x1c1c28), hemiI: 0.85, env: 0.42, exposure: 1.05, bloom: 0.35, sunDir: new THREE.Vector3(-0.45, 0.72, -0.55) };
if (HORROR) {
  Object.assign(NIGHT, { bg:C(0x668697), fog: C(0x273e4d), fogD: 0.026, hemiS: C(0xa3bbca), hemiG: C(0x333c3e), hemiI: 0.3, env: 0.12, exposure: .85, bloom: 0.12, sunI: 0.08 });
}

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY === 'low' ? 1024 : 3072, QUALITY === 'low' ? 1024 : 3072);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// ── 후처리 ──
let w = window.innerWidth, h = window.innerHeight;
const pr = renderer.getPixelRatio();
const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: QUALITY === 'low' ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(pr);
composer.setSize(w, h);
composer.addPass(new RenderPass(scene, camera));
let gtao = null;
if (QUALITY !== 'low') {
  try {
    const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
    gtao = new GTAOPass(scene, camera, w, h);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.blendIntensity = 0.7;
    // 기본 GTAOPass 는 투명 메시(유리, 달빛 줄기, 물, 데칼)와 하늘도 불투명한 막으로 AO 에 넣어 뒤쪽을 검게 만든다 → 제외
    const overrideDefault = gtao._overrideVisibility.bind(gtao);
    gtao._overrideVisibility = function () {
      overrideDefault();
      const cache = this._visibilityCache;
      this.scene.traverse(o => {
        if (!o.isMesh || !o.visible) return;
        const m = o.material;
        if (o.userData.noAO || (m && !Array.isArray(m) && (m.transparent || m.isShaderMaterial))) { o.visible = false; cache.push(o); }
      });
    };
    composer.addPass(gtao);
  } catch (e) { console.warn('GTAO 비활성', e); }
}
const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.7, 1.0);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.35 }, grain: { value: 0.03 }, ca: { value: 1 }, teal: { value: 0.5 }, warm: { value: 0.4 }, sat: { value: 1.0 }, lift: { value: 0.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vig, grain, ca, teal, warm, sat, lift; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c0 = vUv - 0.5; float d = length(c0);
      vec2 off = c0 * d * 0.006 * ca;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(0.9, 1.0, 1.12), smoothstep(0.3, 0.0, l) * teal);
      c = mix(c, c * vec3(1.1, 1.0, 0.88), smoothstep(0.35, 1.2, l) * warm);
      c = mix(vec3(l), c, sat);
      c *= smoothstep(0.95, 0.2, d * (1.0 + vig * 1.6));
      c += vec3(0.9, 0.95, 1.25) * lift * (1.0 - smoothstep(0.0, 0.06, l)); // 완전한 검정으로 뭉개지지 않게 어두운 곳을 살짝 들어올림
      c += (rnd(vUv * 900.0 + time) - 0.5) * grain * (1.0 - clamp(l, 0.0, 1.0) * 0.5);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
if (HORROR) { grade.uniforms.grain.value = 0.008; grade.uniforms.ca.value = 0.15; grade.uniforms.sat.value = 0.75; }
composer.addPass(new OutputPass());

function resize() {
  w = window.innerWidth; h = window.innerHeight;
  // 실제 원본(1344×768)의 구도를 패널 크기와 무관하게 보존한다. 나머지는 여백으로 둔다.
  if (HORROR) {
    w = Math.min(w, h * 1344 / 768); h = w * 768 / 1344;
    canvas.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:${w}px;height:${h}px`;
  }
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 월드 ──
const loading = $('loading');
let world;
try {
  world = HORROR
    ? await createReferenceWorld(scene, msg => { loading.textContent = msg; })
    : await createWorld(scene, msg => { loading.textContent = msg; });
} catch (error) {
  loading.textContent = '맵을 불러오지 못했습니다. 재질 파일과 개발 서버 연결을 확인한 뒤 새로고침해 주세요.';
  console.error('월드 로딩 실패', error);
  throw error;
}
const previewSpawn = HORROR ? world.spawn : layout.spawn;
const hero = new Hero(world.colliders, previewSpawn, world.bounds, HORROR ? world.avatar : null);
hero.addTo(scene);
hero.yaw = HORROR ? -0.32 : 0;
if (HORROR) { hero.heading = Math.PI + hero.yaw; hero.pitch = 0.08; hero.dist = 2.5; hero.flashOn = true; }
loading.style.display = 'none';

// ── 미니맵 (레이아웃 JSON 에서 직접 그림) ──
const mm = $('minimap'), mg = mm.getContext('2d');
// 서쪽 별채(x=-9)까지 보이도록 지도 범위: x -11~45, z -4~52 (정사각 56m)
const MK = mm.width / 56;
const mX = x => (x + 11) * MK, mZ = z => (z + 4) * MK;
const mmBg = document.createElement('canvas'); mmBg.width = mm.width; mmBg.height = mm.height;
{
  const c = mmBg.getContext('2d');
  c.fillStyle = '#10161a'; c.fillRect(0, 0, mm.width, mm.height);
  const col = { hall: '#6a5a4a', corridor: '#5a4a3c', dining: '#4a5a4a', kitchen: '#8a8a82', security: '#4a525a', utility: '#4e4e4e', foyer: '#6a5a4a', courtyard: '#3a3d36', east_path: '#44463f', south_path: '#44463f', library_a: '#5b4a3a', library_b: '#5a3f3f' };
  for (const z of ZONES) { c.fillStyle = col[z.id] ?? '#333'; c.fillRect(mX(z.x), mZ(z.z), z.w * MK, z.d * MK); }
  c.fillStyle = '#e8dfcf';
  for (const wl of layout.walls) c.fillRect(mX(wl.center.x - wl.size.x / 2), mZ(wl.center.z - wl.size.z / 2), Math.max(1.2, wl.size.x * MK), Math.max(1.2, wl.size.z * MK));
}
function drawMinimap() {
  mg.drawImage(mmBg, 0, 0);
  mg.fillStyle = '#c9a36a';
  for (const b of world.colliders.boxes) if (b.tag && b.tag !== 'wall') mg.fillRect(mX(b.minX), mZ(b.minZ), Math.max(1, (b.maxX - b.minX) * MK), Math.max(1, (b.maxZ - b.minZ) * MK));
  if (game.active) { for (const m of game.minimapMarks()) { mg.fillStyle = m.c; mg.beginPath(); mg.arc(mX(m.x), mZ(m.z), 3.5, 0, 6.283); mg.fill(); } }
  else { mg.fillStyle = '#7fd0ff'; for (const n of meeting.npcs) { mg.beginPath(); mg.arc(mX(n.t.x), mZ(n.t.z), 3, 0, 6.283); mg.fill(); } }
  mg.save();
  mg.translate(mX(hero.x), mZ(hero.z));
  mg.rotate(Math.PI - hero.heading);
  mg.fillStyle = '#ff4d4d';
  mg.beginPath(); mg.moveTo(0, -6); mg.lineTo(4.5, 5); mg.lineTo(-4.5, 5); mg.closePath(); mg.fill();
  mg.restore();
}

// ── 전체화면 지도 ──
const bigmap = createBigMap({ canvas: $('bigmapCanvas'), root: $('bigmap'), world, layout, ZONES, hero });

// 알림 토스트
const toastEl = document.createElement('div');
toastEl.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:9;max-width:min(560px,90vw);padding:12px 18px;border-radius:10px;background:rgba(20,16,10,.92);border:1px solid #ffd98a;color:#f4ecd8;font:600 14px/1.5 "Malgun Gothic",system-ui,sans-serif;text-align:center;pointer-events:none;display:none';
document.body.appendChild(toastEl);
let toastTimer = 0;
function toast(msg, ms = 6000) { toastEl.textContent = msg; toastEl.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, ms); }

// ── 원탁 회의 연출: 나와 똑같이 생긴 AI 7명 + 나 = 8명. 채팅창에 "앉아" / "시작" / "일어서" ──
const bigText = $('bigText');
let bigTextTimer = 0;
const meeting = new Meeting({
  scene, hero, col: world.colliders, bounds: world.bounds,
  npcCount: HORROR ? 0 : undefined,
  onToast: toast,
  onText: t => {
    clearTimeout(bigTextTimer);
    bigText.textContent = t; bigText.classList.toggle('on', !!t);
  },
});
// 마피아 게임(낮 → 투표 → 밤 사냥 → 아침). 시작 버튼은 화면 왼쪽 위.
const game = new Game({ scene, camera, hero, meeting, world, setNight: v => { nightTarget = v; }, getNight: () => night, toast, renderer });
const referenceView = HORROR ? configureReferenceView(hero, game, world, camera) : null;
const chatInput = $('chatInput');
function sendCommand(text) { if (game.active) { game.humanSay(text); return; } meeting.say(text); } // 게임 중에는 채팅 = 말하기
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = chatInput.value.trim(); chatInput.value = ''; chatInput.blur(); if (v) sendCommand(v); });
document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => sendCommand(b.dataset.cmd)));

// 음성 명령 (선택 사항): 🎤 버튼으로 켜고 끈다. 버튼·입력창과 똑같은 명령으로 연결된다.
const micBtn = $('micBtn'), micText = $('micText');
let micTextTimer = 0;
const voice = createVoice({
  onCommand: cmd => { if (!game.active) sendCommand(cmd); }, // 게임 중에는 음성 명령(앉아/시작)을 쓰지 않는다
  onHeard: (text, final, cmd) => {
    micText.style.display = 'block'; micText.textContent = `🎤 "${text}"${cmd ? '  → ' + cmd : ''}`;
    clearTimeout(micTextTimer); micTextTimer = setTimeout(() => { micText.style.display = 'none'; }, final ? 2200 : 4000);
  },
  onState: on => { micBtn.classList.toggle('on', on); micBtn.textContent = on ? '🎤 음성 켜짐 (듣는 중)' : '🎤 음성 꺼짐'; if (!on) micText.style.display = 'none'; },
  onError: msg => { toast(msg, 8000); micBtn.classList.remove('on'); micBtn.textContent = '🎤 음성 꺼짐'; },
});
micBtn.addEventListener('click', () => {
  if (voice.on) { voice.stop(); toast('음성 명령을 껐어요.', 1800); }
  else if (voice.start()) toast('음성 명령 켜짐: "앉아" · "시작" · "일어서" 라고 말해 보세요.', 3500);
});

// 브라우저 전체화면. 앱 내장 패널처럼 막힌 환경에서는 요청이 응답 없이 멈추므로 시간 안에 안 되면 이유를 알려준다.
function requestFs() {
  const el = document.documentElement;
  if (document.fullscreenElement) return;
  if (!document.fullscreenEnabled || !el.requestFullscreen) { toast('이 브라우저는 전체화면을 지원하지 않습니다. 크롬/엣지에서 열어 주세요.'); return; }
  el.requestFullscreen().catch(() => toast('전체화면이 거부되었습니다. 크롬/엣지 같은 일반 브라우저에서 열어 주세요.'));
  setTimeout(() => {
    if (!document.fullscreenElement) toast('이 창(앱 내장 미리보기 패널)은 전체화면을 허용하지 않습니다.\n크롬/엣지에서 http://127.0.0.1:5174/ 를 열면 PC 화면 전체로 보입니다.', 9000);
  }, 1200);
}
let fsByMap = false;
function openMap() { bigmap.open(); if (!document.fullscreenElement) { fsByMap = true; requestFs(); } }
function closeMap() { bigmap.close(); if (fsByMap && document.fullscreenElement) document.exitFullscreen?.(); fsByMap = false; }
const toggleMap = () => (bigmap.isOpen ? closeMap() : openMap());

$('mapBtn').addEventListener('click', toggleMap);
$('mapClose').addEventListener('click', closeMap);
$('fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) { fsByMap = false; document.exitFullscreen?.(); } else requestFs();
});
document.addEventListener('fullscreenchange', () => {
  $('fsBtn').textContent = document.fullscreenElement ? '⛶ 전체화면 끄기' : '⛶ 브라우저 전체화면';
  if (bigmap.isOpen) bigmap.draw();
});
window.addEventListener('resize', () => { if (bigmap.isOpen) bigmap.draw(); });

// ── 입력 ──
const keys = new Set();
let locked = false, overview = false, nightTarget = 1, night = 1;
const clickHint = $('click');
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) { if (e.code === 'Escape') e.target.blur(); return; } // 명령 입력 중에는 이동 키로 취급하지 않는다
  if (e.repeat) return;
  if (e.code === 'Enter') { if (HORROR) return; e.preventDefault(); keys.clear(); document.exitPointerLock?.(); chatInput.focus(); return; }
  if (game.active && ['Space', 'KeyC', 'KeyV', 'KeyG', 'KeyJ', 'KeyP', 'KeyX'].includes(e.code) && game.key(e.code)) { e.preventDefault(); return; } // 직업 행동 키
  if (e.code === 'KeyM') { if (!HORROR) toggleMap(); return; }
  if (e.code === 'Escape' && bigmap.isOpen) { closeMap(); return; }
  keys.add(e.code);
  if (e.code === 'KeyN') nightTarget = nightTarget > 0.5 ? 0 : 1;
  if (e.code === 'KeyF') hero.flashOn = !hero.flashOn;
  if (e.code === 'KeyO') { overview = !overview; world.setOverview(overview); }
  if (e.code === 'KeyR' && !HORROR) { hero.x = previewSpawn.x; hero.z = previewSpawn.z; hero.yaw = 0; hero.heading = Math.PI; }
});
window.addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  clickHint.style.display = locked ? 'none' : 'block';
  $('help').style.opacity = locked ? 0.35 : 1;
});
window.addEventListener('mousemove', e => {
  if (bigmap.isOpen || (!locked && e.buttons !== 1)) return;
  hero.camIdle = 0; // 수동 시점 조작 중에는 자동 추적을 잠시 멈춘다
  hero.yaw -= e.movementX * 0.0024;
  hero.pitch = Math.min(1.1, Math.max(-0.15, hero.pitch + e.movementY * 0.002));
});
window.addEventListener('wheel', e => { hero.dist = Math.min(7, Math.max(1.8, hero.dist + e.deltaY * 0.004)); }, { passive: true });

// ── 낮/밤 적용 ──
const tmpC = new THREE.Vector3();
function applyLighting(dt) {
  night += (nightTarget - night) * Math.min(1, dt * 2.2);
  if (Math.abs(nightTarget - night) < 0.002) night = nightTarget;
  const L = (a, b, out) => out.copy(a).lerp(b, night);
  L(DAY.fog, NIGHT.fog, scene.fog.color);
  scene.fog.density = THREE.MathUtils.lerp(DAY.fogD, NIGHT.fogD, night);
  L(DAY.bg, NIGHT.bg, scene.background);
  L(DAY.sun, NIGHT.sun, sun.color);
  sun.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, night);
  L(DAY.hemiS, NIGHT.hemiS, hemi.color); L(DAY.hemiG, NIGHT.hemiG, hemi.groundColor);
  hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, night);
  scene.environmentIntensity = THREE.MathUtils.lerp(DAY.env, NIGHT.env, night);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, night);
  bloom.strength = THREE.MathUtils.lerp(DAY.bloom, NIGHT.bloom, night);
  grade.uniforms.vig.value = THREE.MathUtils.lerp(0.2, 0.3, night);
  grade.uniforms.lift.value = THREE.MathUtils.lerp(0.003, 0.008, night);
  grade.uniforms.teal.value = THREE.MathUtils.lerp(0.2, 0.6, night);
  if (HORROR) { grade.uniforms.vig.value = 0.05; grade.uniforms.lift.value = 0.002; grade.uniforms.teal.value = 0.25; }
  tmpC.copy(DAY.sunDir).lerp(NIGHT.sunDir, night).normalize();
  return tmpC;
}

// ── 루프 ──
const status = $('status');
let simTime = 0, fpsAcc = 0, fpsN = 0, fps = 0;
const clock = new THREE.Clock();
const sunDirV = new THREE.Vector3();
const ovPos = new THREE.Vector3(22, 64, 62), ovLook = new THREE.Vector3(22, 0, 20);

function tick(dt) {
  simTime += dt;
  sunDirV.copy(applyLighting(dt));
  const mapOpen = bigmap.isOpen;
  const f = mapOpen ? 0 : (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = mapOpen ? 0 : (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const qe = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  if (qe) hero.camIdle = 0;
  hero.yaw += qe * dt * 1.8;
  meeting.update(dt);
  game.update(dt);
  if (meeting.heroBusy) { /* 회의 연출 중: meeting 이 hero.autoStep 을 부른다 */ }
  else if (game.heroBusy()) hero.autoStep(dt); // 게임 연출/선택 중: 조작 잠금
  else hero.update(dt, { f, r }, game.filterRun(keys.has('ShiftLeft') || keys.has('ShiftRight'), dt));
  if (overview) { camera.position.lerp(ovPos, Math.min(1, dt * 4)); camera.lookAt(ovLook); }
  else if (!referenceView?.updateCamera()) { hero.updateCamera(camera, dt); game.afterCamera(camera, dt); }
  referenceView?.pose();

  sun.position.set(hero.x, 0, hero.z).addScaledVector(sunDirV, 70);
  sun.target.position.set(hero.x, 0, hero.z);
  world.update(dt, simTime, hero, night);
  grade.uniforms.time.value = simTime % 100;
  if (!mapOpen) { composer.render(); game.afterRender(canvas); } // 전체화면 지도가 열려 있으면 3D 렌더를 쉰다
  drawMinimap();
  if (mapOpen) bigmap.draw(simTime);

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  const zn = zoneById[hero.zone];
  status.textContent = `${zn ? zn.name : '외곽'} · (${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}) · ${night > 0.5 ? '🌙 밤' : '☀ 낮'} · ${fps} FPS`;
}
function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
frame();

window.__dbg = {
  hero, camera, scene, world, keys, renderer, THREE, bigmap, composer, meeting, voice, game, passes: { gtao, bloom, grade },
  setNight: v => { nightTarget = v; },
  teleport: (x, z) => { hero.x = x; hero.z = z; },
  step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(dt); },
  audit: () => auditTexelDensity(scene),
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures }),
};
