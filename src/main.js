import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildMap } from './map/buildMap.js';
import { buildColliders } from './map/collision.js';
import { playerSpawns, zoneAt } from './map/mansionMap.js';
import { Player } from './player.js';
import { createMinimap } from './minimap.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb9d0e6, 0.008);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 900);
camera.position.set(0, 8, 12);

// ── 낮/밤 프리셋 ──
const DAY = {
  sky: new THREE.Color(0x9ec4e8), fog: new THREE.Color(0xb9d0e6), density: 0.0035,
  sun: new THREE.Color(0xfff1d6), sunI: 3.2, hemiSky: new THREE.Color(0xcfe3ff), hemiGround: new THREE.Color(0x6b6a55), hemiI: 1.5, bloom: 0.2,
};
const NIGHT = {
  sky: new THREE.Color(0x04060e), fog: new THREE.Color(0x070b16), density: 0.03,
  sun: new THREE.Color(0x7f9cff), sunI: 0.85, hemiSky: new THREE.Color(0x24315a), hemiGround: new THREE.Color(0x0a0c12), hemiI: 0.35, bloom: 0.75,
};

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.45, 0.8, -0.35).normalize();

// ── 맵 / 플레이어 ──
const map = buildMap();
scene.add(map.group);
const col = buildColliders();
const player = new Player(col, playerSpawns[0]);
player.addTo(scene);
const drawMinimap = createMinimap(document.getElementById('minimap'));

// ── 후처리 ──
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.6, 0.85);
composer.addPass(bloom);
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, strength: { value: 0.3 }, grain: { value: 0.022 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, strength, grain; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= smoothstep(0.95, 0.25, d * (1.0 + strength));
      c.rgb += (rnd(vUv * 1000.0 + time) - 0.5) * grain;
      gl_FragColor = c;
    }`,
});
composer.addPass(vignette);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 입력 ──
const keys = new Set();
let locked = false;
let showTools = false;
const clickHint = document.getElementById('click');
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyN') nightTarget = nightTarget > 0.5 ? 0 : 1;
  if (e.code === 'KeyF') player.flashOn = !player.flashOn;
  if (e.code === 'KeyT') { showTools = !showTools; }
});
window.addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('click', () => { if (!locked) canvas.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  clickHint.style.display = locked ? 'none' : 'block';
});
window.addEventListener('mousemove', e => {
  if (!locked && e.buttons !== 1) return;
  player.yaw -= e.movementX * 0.0024;
  player.pitch = Math.min(1.3, Math.max(0.2, player.pitch + e.movementY * 0.002));
});
window.addEventListener('wheel', e => { player.dist = Math.min(16, Math.max(3.5, player.dist + e.deltaY * 0.01)); }, { passive: true });

// ── 루프 ──
let night = 0, nightTarget = 0;
const status = document.getElementById('status');
let fpsAcc = 0, fpsN = 0, fps = 0;
const clock = new THREE.Clock();

function applyLighting() {
  const lerpC = (a, b, out) => out.copy(a).lerp(b, night);
  scene.background = lerpC(DAY.sky, NIGHT.sky, new THREE.Color());
  lerpC(DAY.fog, NIGHT.fog, scene.fog.color);
  scene.fog.density = THREE.MathUtils.lerp(DAY.density, NIGHT.density, night);
  lerpC(DAY.sun, NIGHT.sun, sun.color);
  sun.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, night);
  lerpC(DAY.hemiSky, NIGHT.hemiSky, hemi.color);
  lerpC(DAY.hemiGround, NIGHT.hemiGround, hemi.groundColor);
  hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, night);
  bloom.strength = THREE.MathUtils.lerp(DAY.bloom, NIGHT.bloom, night);
  vignette.uniforms.strength.value = THREE.MathUtils.lerp(0.12, 0.7, night);
  map.setNight(night);
}

let simTime = 0;
function tick(dt) {
  simTime += dt;
  const t = simTime;

  night += (nightTarget - night) * Math.min(1, dt * 2.5);
  if (Math.abs(nightTarget - night) < 0.002) night = nightTarget;
  applyLighting();

  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  player.yaw += ((keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0)) * dt * 1.8;
  player.update(dt, { f, r }, keys.has('ShiftLeft') || keys.has('ShiftRight'));
  player.updateCamera(camera, dt);

  // 그림자 카메라가 플레이어를 따라다닌다
  sun.position.set(player.x, 0, player.z).addScaledVector(SUN_DIR, 90);
  sun.target.position.set(player.x, 0, player.z);

  map.markers.visible = showTools;
  map.update(dt, player.x, player.z, t);
  vignette.uniforms.time.value = t % 100;
  composer.render();
  drawMinimap(player, showTools);

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  status.textContent = `${zoneAt(player.x, player.z)} · (${player.x.toFixed(1)}, ${player.z.toFixed(1)}) · ${night > 0.5 ? '🌙 밤' : '☀ 낮'} · ${fps} FPS`;
}

function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}
applyLighting();
frame();

// 디버그/자동화용 (패널이 백그라운드면 rAF 가 멈추므로 step 으로 프레임을 직접 진행)
window.__dbg = {
  player, camera, scene, keys,
  setNight: v => { nightTarget = v; },
  teleport: (x, z) => { player.x = x; player.z = z; },
  step: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(dt); },
};
