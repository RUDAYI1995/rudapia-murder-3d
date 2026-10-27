// 공포 맵 시안: 기존 월드·이동·충돌을 사용하며 look=horror에서만 적용한다.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export async function prepareHorrorMaterials(M, onProgress) {
  onProgress('Higgsfield 바닥·벽지 재질 불러오는 중…');
  const loader = new THREE.TextureLoader();
  const load = async name => {
    const texture = await loader.loadAsync(`/assets/horror/${name}-albedo.png`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  };
  // 생성 실패나 파일 누락을 기본 재질로 숨기지 않는다. 로딩 오류가 호출자에게 전달된다.
  const [floor, wallpaper, portrait] = await Promise.all([load('floor'), load('wallpaper'), load('portrait')]);
  portrait.wrapS = portrait.wrapT = THREE.ClampToEdgeWrapping;
  M.horrorPortrait = portrait;
  const stone = new THREE.MeshStandardMaterial({ map: floor, roughness: 0.56, metalness: 0.04, color: 0x999c9c });
  stone.userData.tile = 2.4;
  const paper = new THREE.MeshStandardMaterial({ map: wallpaper, roughness: 0.96, color: 0x9baba7 });
  paper.userData.tile = 3;
  M.marble = stone;
  M.hallStone = paper;
  M.wallpaperRed = paper;
  M.wallpaperGreen = paper;
  for (const name of ['woodPanel', 'trimWood', 'walnut', 'darkWood']) {
    M[name].color.multiplyScalar(0.48);
    M[name].roughness = 0.87;
  }
  M.brass.color.setHex(0x6b6042);
  M.brass.roughness = 0.72;
  for (const name of ['stoneWarm', 'stoneCap', 'marbleStatue', 'hallStoneAlt']) {
    if (M[name]?.color) M[name].color.multiplyScalar(0.53);
  }
}

export function buildHorrorDetails(ctx, root) {
  const { M, col, pool } = ctx;
  const group = new THREE.Group();
  group.name = 'horror-details';
  root.add(group);
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // 광원 풀을 그대로 사용해 가까운 광원만 활성화한다. 다른 모드의 광원은 바꾸지 않는다.
  for (const s of pool.sources) {
    if (['hall', 'corridor', 'foyer'].includes(s.zone)) {
      s.intensity *= s.alwaysOn ? 0.16 : 0.22;
      if (s.alwaysOn) s.color = 0x708c9e;
    }
  }
  const glow = new THREE.MeshStandardMaterial({ color: 0xffb477, emissive: 0xff752a, emissiveIntensity: 0.9 });
  // 엄폐물은 실제 충돌에도 등록하며 기존 동쪽 출입문(z=5,13)을 막지 않는다.
  for (const [x, z, w] of [[16.6, 18.5, 2.2], [3.2, 10.5, 1.7]]) {
    box(w, 0.9, 0.85, M.darkWood, x, 0.45, z);
    for (const offset of [-0.28, 0, 0.28]) box(w - 0.14, 0.07, 0.06, M.brass, x, 0.45 + offset, z + 0.44);
    col.addCenterBox(x, z, w, 0.85, 0, 0.9, 'horror-cover');
  }
  // 복도 비상등과 작업등은 광원의 위치와 실제 발광 소품 위치를 일치시킨다.
  for (const z of [4, 12, 21]) {
    box(0.38, 0.18, 0.12, M.iron, 22.78, 2.65, z);
    box(0.28, 0.08, 0.13, glow, 22.77, 2.65, z);
    pool.add({ x: 22.3, y: 2.5, z, zone: 'corridor', color: 0xff9d51, intensity: 12, distance: 7, flicker: 0.035, alwaysOn: true });
  }
  box(0.52, 0.07, 0.38, M.iron, 17.5, 0.08, 11.2);
  box(0.07, 1.3, 0.07, M.iron, 17.5, 0.73, 11.2);
  box(0.44, 0.27, 0.13, M.iron, 17.5, 1.45, 11.2);
  box(0.36, 0.19, 0.02, glow, 17.5, 1.45, 11.28);
  pool.add({ x: 17.5, y: 1.5, z: 11.6, zone: 'hall', color: 0xffb576, intensity: 18, distance: 11, flicker: 0, alwaysOn: true });
  const rnd = mulberry32(83);
  const paper = new THREE.MeshStandardMaterial({ color: 0x8a8370, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 65; i++) {
    const x = 2 + rnd() * 16, z = 8 + rnd() * 14;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + rnd() * 0.2, 0.18 + rnd() * 0.23), paper);
    mesh.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI);
    mesh.position.set(x, 0.026 + i * 0.0001, z);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // 화면 전체를 덮는 이미지 대신 실제 공간의 반투명 저층 안개를 사용한다.
  const haze = new THREE.MeshBasicMaterial({ color: 0x7d96a3, transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 21), haze);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(10, 0.12 + i * 0.14, 12);
    group.add(mesh);
  }
}

export function configureHorrorView(hero, game) {
  document.title = '루다피아 · 중앙 홀 / 동쪽 복도 시안';
  document.body.classList.add('horror-preview');
  game.ui.startButton(false);
  const style = document.createElement('style');
  style.textContent = `.horror-preview #help,.horror-preview #chatBar,.horror-preview #gStart,.horror-preview #minimap,.horror-preview #mapBtns{display:none!important}
    .horror-preview #status{font-size:11px;opacity:.65;background:transparent}
    .horror-preview #click{font-size:14px;border:1px solid #a29d8244;background:#0b1219c9}
    #horrorPanel{position:fixed;left:24px;top:24px;z-index:10;color:#ddd9c9;font:12px/1.8 'Malgun Gothic',sans-serif;max-width:310px;text-shadow:0 2px 4px #000}
    #horrorPanel b{display:block;font-size:23px;letter-spacing:.2em;font-weight:500;margin:2px 0 8px}
    #horrorPanel small{color:#a9b5bb;letter-spacing:.12em}
    #horrorPanel button,#horrorPanel a{display:inline-block;border:1px solid #b1b9b23b;background:#091017b8;color:#dadbcf;padding:6px 10px;margin:10px 5px 0 0;cursor:pointer;text-decoration:none;font:11px 'Malgun Gothic',sans-serif}`;
  document.head.appendChild(style);
  const panel = document.createElement('section');
  panel.id = 'horrorPanel';
  panel.innerHTML = '<small>구역 02 · 공간 시안 01</small><b>루다피아</b><div>중앙 홀 · 동쪽 복도</div><div>WASD 이동 · Q/E 시점 · Shift 달리기<br>F 손전등 · R 처음 위치 · 클릭 후 마우스 시점</div><button data-view="hall">중앙 홀</button><button data-view="corridor">동쪽 복도</button><a href="/">기존 맵 비교</a>';
  document.body.appendChild(panel);
  const place = (x, z, yaw) => { hero.x = x; hero.z = z; hero.yaw = yaw; hero.heading = Math.PI + yaw; hero.camInit = false; };
  panel.querySelector('[data-view="hall"]').onclick = () => place(14, 21, -0.32);
  panel.querySelector('[data-view="corridor"]').onclick = () => place(21.4, 17, 0);
  // 시안의 조형 검토를 위해 기존 캐릭터를 중성색으로 표시한다. 새 캐릭터 모델은 별도 제작 대상이다.
  hero.model.traverse(o => {
    if (!o.isMesh || !o.material?.color) return;
    o.material = o.material.clone();
    o.material.color.multiplyScalar(0.32);
    o.material.roughness = 0.95;
  });
}
