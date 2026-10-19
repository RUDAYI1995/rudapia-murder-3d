// 액자 초상화(흰 배경) → 투명 배경 PNG. 가장자리에서 이어진 "거의 흰색" 영역만 배경으로 보고 지운다(액자 안쪽 흰 레이스는 보존).
// 실행: node tools/make-portrait.mjs <원본> <출력이름>   예) node tools/make-portrait.mjs assets/ref/hall/portrait-big-v2.webp portrait_big_v2
import sharp from 'sharp';

const [src, outName] = process.argv.slice(2);
if (!src || !outName) { console.error('usage: node tools/make-portrait.mjs <src> <outName>'); process.exit(1); }

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const isBg = i => Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) > 232;

const bg = new Uint8Array(W * H);
const stack = [];
const push = (x, y) => { const k = y * W + x; if (!bg[k] && isBg(k)) { bg[k] = 1; stack.push(k); } };
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) {
  const k = stack.pop(), x = k % W, y = (k / W) | 0;
  if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1);
}
// 배경 경계를 1px 더 깎아 흰 테두리(번짐)를 없앤다
const cut = new Uint8Array(bg);
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  const k = y * W + x;
  if (!bg[k] && (bg[k - 1] || bg[k + 1] || bg[k - W] || bg[k + W])) cut[k] = 1;
}
const out = Buffer.alloc(W * H * 4);
let removed = 0;
for (let k = 0; k < W * H; k++) {
  out[k * 4] = data[k * 3]; out[k * 4 + 1] = data[k * 3 + 1]; out[k * 4 + 2] = data[k * 3 + 2];
  out[k * 4 + 3] = cut[k] ? 0 : 255;
  if (cut[k]) { out[k * 4] = 150; out[k * 4 + 1] = 118; out[k * 4 + 2] = 60; removed++; } // 투명 픽셀 색은 액자 금색(밉맵 번짐 방지)
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`public/assets/zone02/${outName}.png`);
console.log(outName, `${W}x${H}`, `transparent ${(100 * removed / (W * H)).toFixed(1)}%`);
