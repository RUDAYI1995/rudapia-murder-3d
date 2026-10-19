// 개발용 미니맵. 맵 데이터(순수 데이터)를 그대로 그려서 레이아웃/충돌을 눈으로 검증한다.
import { buildings, fence, hedges, props, paths, plaza, trees, toolSpawns, playerSpawns, MAP_HALF } from './map/mansionMap.js';

const COLORS = { knife: '#e6e6f2', hammer: '#e0a85f', rope: '#9ed67a' };

export function createMinimap(canvas) {
  const S = canvas.width;
  const g = canvas.getContext('2d');
  const k = S / (MAP_HALF * 2);
  const X = x => (x + MAP_HALF) * k;
  const Z = z => (z + MAP_HALF) * k;

  // 정적 배경은 한 번만 그려 캐시
  const bg = document.createElement('canvas');
  bg.width = bg.height = S;
  {
    {
      const c = bg.getContext('2d');
      c.fillStyle = '#17231a'; c.fillRect(0, 0, S, S);
      c.fillStyle = '#4a4a4f';
      for (const p of paths) c.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k, (p.z1 - p.z0) * k);
      c.beginPath(); c.arc(X(plaza.x), Z(plaza.z), plaza.r * k, 0, 6.3); c.fill();
      for (const b of buildings) { c.fillStyle = '#6b5a45'; c.fillRect(X(b.x0), Z(b.z0), b.w * k, b.d * k); }
      const r = (b, color) => { c.fillStyle = color; c.fillRect(X(b.cx - b.w / 2), Z(b.cz - b.d / 2), Math.max(1, b.w * k), Math.max(1, b.d * k)); };
      for (const b of buildings) for (const w of b.walls) r(w, '#e8dfcf');
      for (const w of fence) r(w, '#a97a5c');
      for (const w of hedges) r(w, '#3f8a3f');
      for (const p of props) r({ cx: p.x, cz: p.z, w: p.w, d: p.d }, '#c9a36a');
      c.fillStyle = '#2f6b2f';
      for (const t of trees) { c.beginPath(); c.arc(X(t.x), Z(t.z), 1.6, 0, 6.3); c.fill(); }
      c.font = '10px sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center';
      for (const b of buildings) c.fillText(b.name, X(b.cx), Z(b.cz) + 3);
      c.fillText('광장', X(0), Z(0) + 24);
    }
  }

  return function draw(player, showTools) {
    g.drawImage(bg, 0, 0);
    if (showTools) {
      for (const s of toolSpawns) { g.fillStyle = COLORS[s.tool]; g.beginPath(); g.arc(X(s.x), Z(s.z), 3, 0, 6.3); g.fill(); }
    }
    g.fillStyle = '#5ab0ff';
    for (const s of playerSpawns) { g.beginPath(); g.arc(X(s.x), Z(s.z), 1.8, 0, 6.3); g.fill(); }
    // 플레이어 (방향 삼각형)
    g.save();
    g.translate(X(player.x), Z(player.z));
    g.rotate(-player.heading + Math.PI);
    g.fillStyle = '#ff4d4d';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
  };
}
