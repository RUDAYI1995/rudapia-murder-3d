// 임시 절차적 텍스처 (실제 에셋이 들어오기 전 그레이박스용). 나중에 이미지 텍스처로 교체.
import * as THREE from 'three';

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(size, draw, repeatSeed = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, rng(repeatSeed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const noiseDots = (g, s, r, base, count, spread) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < count; i++) {
    const v = Math.floor(r() * spread);
    g.fillStyle = `rgba(${v},${v},${v},0.08)`;
    g.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 3);
  }
};

export function makeTextures() {
  const cobble = canvasTex(512, (g, s, r) => {
    g.fillStyle = '#3b3a3d'; g.fillRect(0, 0, s, s);
    const cell = 64;
    for (let y = 0; y < s; y += cell) {
      const off = (y / cell) % 2 ? cell / 2 : 0;
      for (let x = -cell; x < s + cell; x += cell) {
        const v = 80 + r() * 55;
        g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
        const px = x + off + 3, py = y + 3, w = cell - 6 - r() * 4, h = cell - 6 - r() * 4;
        g.beginPath(); g.roundRect(px, py, w, h, 10); g.fill();
      }
    }
  }, 3);

  const grass = canvasTex(512, (g, s, r) => {
    g.fillStyle = '#31452c'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6000; i++) {
      const gv = 55 + r() * 60;
      g.fillStyle = `rgba(${gv * 0.55},${gv},${gv * 0.4},0.35)`;
      g.fillRect(r() * s, r() * s, 1.5, 3 + r() * 5);
    }
  }, 5);

  const plaster = canvasTex(256, (g, s, r) => {
    noiseDots(g, s, r, '#cfc4b0', 2500, 255);
    g.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(r() * s, 0); g.lineTo(r() * s, s); g.stroke(); }
  }, 7);

  const brickDark = canvasTex(256, (g, s, r) => {
    g.fillStyle = '#4a3a34'; g.fillRect(0, 0, s, s);
    const bh = 32, bw = 64;
    for (let y = 0; y < s; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < s + bw; x += bw) {
        const v = 70 + r() * 40;
        g.fillStyle = `rgb(${v + 20},${v - 5},${v - 12})`;
        g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
  }, 9);

  const wood = canvasTex(256, (g, s, r) => {
    g.fillStyle = '#5a4030'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 32) {
      const v = 70 + r() * 30;
      g.fillStyle = `rgb(${v + 30},${v},${v - 20})`;
      g.fillRect(0, y + 1, s, 30);
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(0, y + 6 + k * 6); g.lineTo(s, y + 6 + k * 6 + r() * 4 - 2); g.stroke(); }
    }
  }, 11);

  const roof = canvasTex(256, (g, s, r) => {
    g.fillStyle = '#2f2523'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 24) {
      for (let x = 0; x < s; x += 24) {
        const v = 45 + r() * 25;
        g.fillStyle = `rgb(${v + 12},${v},${v - 4})`;
        g.beginPath(); g.arc(x + 12 + ((y / 24) % 2 ? 12 : 0), y + 8, 13, 0, Math.PI); g.fill();
      }
    }
  }, 13);

  const hedge = canvasTex(256, (g, s, r) => {
    g.fillStyle = '#1f3a1f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) {
      const v = 50 + r() * 70;
      g.fillStyle = `rgba(${v * 0.4},${v},${v * 0.35},0.5)`;
      g.beginPath(); g.arc(r() * s, r() * s, 2 + r() * 4, 0, 6.3); g.fill();
    }
  }, 15);

  return { cobble, grass, plaster, brickDark, wood, roof, hedge };
}
