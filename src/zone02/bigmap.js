// 전체화면 지도 오버레이. 레이아웃(JSON)과 충돌 데이터에서 직접 그리므로 맵이 바뀌어도 자동으로 따라간다.
const ZONE_COLOR = {
  hall: '#7a6550', corridor: '#65503f', dining: '#4f6552', kitchen: '#9a9a90', security: '#4f5a66', utility: '#585858',
  foyer: '#7a6550', courtyard: '#3f4339', east_path: '#4a4c43', south_path: '#4a4c43', library_a: '#6a5240', library_b: '#6a4747',
};
const TAG_COLOR = { wall: '#efe6d4', hedge: '#3d7a3d', gate: '#222', pillar: '#a89c88', fountain: '#4a86b0', car: '#2a2d34', lamp: '#ffd27a', plant: '#4a7a3a', topiary: '#3d7a3d', planter: '#6e4a38', bench: '#7a5538' };

export function createBigMap({ canvas, root, buttonClose, world, layout, ZONES, hero }) {
  const g = canvas.getContext('2d');
  // 지도로 보여줄 월드 범위 (플레이 가능 영역 + 정문 밖 길 일부)
  const B = { x0: -12, z0: -2, x1: 46, z1: 51 };
  let open = false;

  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(root.clientWidth * dpr), h = Math.floor(root.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h, dpr };
  };

  const draw = (t = 0) => {
    const { w, h, dpr } = fit();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07090e'; g.fillRect(0, 0, w, h);

    // 우측 범례 패널을 뺀 영역에 맞춰 축척 결정
    const legendW = Math.min(300 * dpr, w * 0.26);
    const topPad = 64 * dpr, pad = 28 * dpr;
    const availW = w - legendW - pad * 2, availH = h - topPad - pad;
    const s = Math.min(availW / (B.x1 - B.x0), availH / (B.z1 - B.z0));
    const ox = pad + (availW - (B.x1 - B.x0) * s) / 2, oz = topPad + (availH - (B.z1 - B.z0) * s) / 2;
    const X = x => ox + (x - B.x0) * s, Z = z => oz + (z - B.z0) * s;

    // 지도 바탕 + 격자(5m)
    g.fillStyle = '#10161a'; g.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * s, (B.z1 - B.z0) * s);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    for (let x = Math.ceil(B.x0 / 5) * 5; x <= B.x1; x += 5) { g.beginPath(); g.moveTo(X(x), Z(B.z0)); g.lineTo(X(x), Z(B.z1)); g.stroke(); }
    for (let z = Math.ceil(B.z0 / 5) * 5; z <= B.z1; z += 5) { g.beginPath(); g.moveTo(X(B.x0), Z(z)); g.lineTo(X(B.x1), Z(z)); g.stroke(); }

    // 정문 밖 길
    g.fillStyle = '#34363a'; g.fillRect(X(7), Z(44), 6 * s, 7 * s);

    // 구역
    for (const z of ZONES) {
      g.fillStyle = ZONE_COLOR[z.id] ?? '#333'; g.fillRect(X(z.x), Z(z.z), z.w * s, z.d * s);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.strokeRect(X(z.x), Z(z.z), z.w * s, z.d * s);
    }
    // 충돌 박스: 벽/울타리/가구
    for (const b of world.colliders.boxes) {
      const tag = b.tag || 'prop';
      g.fillStyle = TAG_COLOR[tag] ?? (tag === 'wall' ? '#efe6d4' : 'rgba(205,165,105,0.75)');
      g.fillRect(X(b.minX), Z(b.minZ), Math.max(1.5 * dpr, (b.maxX - b.minX) * s), Math.max(1.5 * dpr, (b.maxZ - b.minZ) * s));
    }
    for (const c of world.colliders.circles) {
      g.fillStyle = TAG_COLOR[c.tag] ?? 'rgba(205,165,105,0.75)';
      g.beginPath(); g.arc(X(c.x), Z(c.z), Math.max(1.5 * dpr, c.r * s), 0, 6.283); g.fill();
    }
    // 문 표시
    g.strokeStyle = '#5ad2ff'; g.lineWidth = Math.max(2, 0.18 * s);
    for (const d of layout.doors) {
      const half = d.width / 2;
      g.beginPath();
      if (d.axis === 'x') { g.moveTo(X(d.center.x - half), Z(d.center.z)); g.lineTo(X(d.center.x + half), Z(d.center.z)); }
      else { g.moveTo(X(d.center.x), Z(d.center.z - half)); g.lineTo(X(d.center.x), Z(d.center.z + half)); }
      g.stroke();
    }

    // 구역 이름
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fs = Math.max(12 * dpr, Math.min(22 * dpr, s * 1.15));
    g.font = `600 ${fs}px "Malgun Gothic", system-ui, sans-serif`;
    for (const z of ZONES) {
      const tw = g.measureText(z.name).width;
      const small = tw > z.w * s * 0.88 && z.d * s > z.w * s; // 가로로 안 들어가는 좁고 긴 구역은 세로로 쓴다
      g.save(); g.translate(X(z.x + z.w / 2), Z(z.z + z.d / 2));
      if (small) g.rotate(-Math.PI / 2);
      g.lineJoin = 'round'; g.lineWidth = (small ? 2.5 : 4) * dpr; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(z.name, 0, 0);
      g.fillStyle = '#fff'; g.fillText(z.name, 0, 0);
      g.restore();
    }

    // 플레이어
    const px = X(hero.x), pz = Z(hero.z);
    const pulse = 1 + 0.25 * Math.sin(t * 4);
    g.fillStyle = 'rgba(255,77,77,0.22)'; g.beginPath(); g.arc(px, pz, 1.6 * s * pulse, 0, 6.283); g.fill();
    g.save(); g.translate(px, pz); g.rotate(Math.PI - hero.heading);
    g.fillStyle = '#ff4d4d'; g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr;
    const a = Math.max(8 * dpr, 0.9 * s);
    g.beginPath(); g.moveTo(0, -a * 1.4); g.lineTo(a, a); g.lineTo(-a, a); g.closePath(); g.fill(); g.stroke();
    g.restore();

    // 방위(N) + 축척 막대(10m)
    g.fillStyle = '#ffd98a'; g.font = `700 ${18 * dpr}px system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText('N ↑', X(B.x1) - 26 * dpr, Z(B.z0) + 22 * dpr);
    g.fillStyle = '#e9e4d8'; g.fillRect(X(B.x0) + 12 * dpr, Z(B.z1) - 16 * dpr, 10 * s, 4 * dpr);
    g.textAlign = 'left'; g.font = `${13 * dpr}px system-ui, sans-serif`; g.fillText('10 m', X(B.x0) + 12 * dpr + 10 * s + 8 * dpr, Z(B.z1) - 13 * dpr);

    // 범례 패널
    const lx = w - legendW + 8 * dpr;
    let ly = topPad + 6 * dpr;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd98a'; g.font = `700 ${17 * dpr}px "Malgun Gothic", system-ui, sans-serif`; g.fillText('구역', lx, ly); ly += 28 * dpr;
    g.font = `${15 * dpr}px "Malgun Gothic", system-ui, sans-serif`;
    for (const z of ZONES) {
      g.fillStyle = ZONE_COLOR[z.id] ?? '#333'; g.fillRect(lx, ly - 8 * dpr, 16 * dpr, 16 * dpr);
      g.fillStyle = hero.zone === z.id ? '#ff8080' : '#e9e4d8';
      g.fillText(z.name + (hero.zone === z.id ? '  ◀ 현재 위치' : ''), lx + 26 * dpr, ly);
      ly += 24 * dpr;
    }
    ly += 10 * dpr;
    g.fillStyle = '#ffd98a'; g.font = `700 ${17 * dpr}px "Malgun Gothic", system-ui, sans-serif`; g.fillText('표시', lx, ly); ly += 26 * dpr;
    g.font = `${14 * dpr}px "Malgun Gothic", system-ui, sans-serif`;
    const items = [['#efe6d4', '벽'], ['#5ad2ff', '문 (통로)'], ['rgba(205,165,105,0.85)', '가구'], ['#3d7a3d', '울타리·화단'], ['#ff4d4d', '내 위치']];
    for (const [c, label] of items) { g.fillStyle = c; g.fillRect(lx, ly - 7 * dpr, 16 * dpr, 14 * dpr); g.fillStyle = '#cfc8b8'; g.fillText(label, lx + 26 * dpr, ly); ly += 22 * dpr; }
  };

  return {
    get isOpen() { return open; },
    open() { open = true; root.hidden = false; if (document.pointerLockElement) document.exitPointerLock(); draw(); },
    close() { open = false; root.hidden = true; },
    toggle() { open ? this.close() : this.open(); },
    draw,
  };
}
