// 주인공 턴어라운드 시트(정면/측면/후면, 투명 배경) → "종이 인형" 부품 텍스처 + 배치 데이터
//  시트의 사람을 관절 단위(머리, 몸통, 팔 2, 허벅지 2, 정강이 2)로 잘라, 같은 뼈대(character.js 의 걷기/앉기 동작)에 붙인다.
//  모든 부품은 정면/후면(+머리·몸통·다리는 측면) 판으로 만든다. 시트 높이 1000px = 키 1.78m.
//  좌표 규칙: 정면 그림에서 이미지 왼쪽 = 모델의 오른쪽 = 월드 -x. (모델이 +z 를 본다)
// 실행: node tools/make-hero-character.mjs   → public/assets/zone02/hero/*.png, src/data/hero_parts.json
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'assets/ref/character/hero-turnaround.webp';
const OUT = 'public/assets/zone02/hero/';
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(OUT + f);

const S = 1.78 / 1000, FIG_TOP = 9;                       // 1px = m, 정면 그림 머리끝 y(px)
const CX = { F: 371.5, B: 1177, S: 765 };                  // 각 그림의 몸 중심선 x(px)
const worldY = py => 1.78 - (py - FIG_TOP) * S;

// [이름, 뷰, [x, y, w, h], 노드]
//  노드: head, torso, arm- / arm+ (월드 -x / +x 쪽 팔), thigh-, thigh+, shin-, shin+
const PARTS = [
  ['head_f', 'F', [290, 0, 180, 190], 'head'],
  ['head_b', 'B', [1085, 0, 170, 215], 'head'],
  ['head_s', 'S', [660, 0, 240, 215], 'head'],
  ['torso_f', 'F', [285, 183, 185, 312], 'torso'],
  ['torso_b', 'B', [1075, 183, 205, 312], 'torso'],
  ['torso_s', 'S', [655, 183, 290, 312], 'torso'],
  // 팔(어깨 관절 y=183px 부터 손끝까지). 정면 이미지 왼쪽 = 월드 -x, 후면 이미지 오른쪽 = 월드 -x
  ['arm_f-', 'F', [176, 183, 109, 420], 'arm-'], ['arm_f+', 'F', [470, 183, 97, 420], 'arm+'],
  ['arm_b-', 'B', [1277, 183, 90, 420], 'arm-'], ['arm_b+', 'B', [988, 183, 90, 420], 'arm+'],
  // 허벅지(엉덩이 492px ~ 무릎 734px) / 정강이(무릎 ~ 바닥 1010px)
  ['thigh_f-', 'F', [250, 492, 122, 242], 'thigh-'], ['thigh_f+', 'F', [372, 492, 124, 242], 'thigh+'],
  ['shin_f-', 'F', [205, 734, 167, 277], 'shin-'], ['shin_f+', 'F', [372, 734, 170, 277], 'shin+'],
  ['thigh_b-', 'B', [1177, 492, 128, 242], 'thigh-'], ['thigh_b+', 'B', [1050, 492, 127, 242], 'thigh+'],
  ['shin_b-', 'B', [1177, 734, 170, 277], 'shin-'], ['shin_b+', 'B', [1005, 734, 172, 277], 'shin+'],
  ['thigh_s', 'S', [680, 492, 175, 242], 'thigh'], ['shin_s', 'S', [650, 734, 200, 277], 'shin'],
];

const meta = { S, parts: {} };
for (const [name, view, [x, y, w, h], node] of PARTS) {
  await sharp(SRC).ensureAlpha().extract({ left: x, top: y, width: w, height: h }).png({ compressionLevel: 9 }).toFile(OUT + name + '.png');
  const cxPx = x + w / 2, cyPx = y + h / 2;
  // 판 중심의 월드 위치. F: x 는 이미지 오른쪽이 +x. B: 이미지 오른쪽이 -x. S: 이미지 오른쪽이 -z(뒤).
  const pos = view === 'F' ? { x: (cxPx - CX.F) * S } : view === 'B' ? { x: -(cxPx - CX.B) * S } : { z: -(cxPx - CX.S) * S };
  meta.parts[name] = { view, node, w: +(w * S).toFixed(4), h: +(h * S).toFixed(4), cy: +worldY(cyPx).toFixed(4), top: +worldY(y).toFixed(4), ...Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, +v.toFixed(4)])) };
}
fs.writeFileSync('src/data/hero_parts.json', JSON.stringify(meta, null, 1));
console.log(Object.keys(meta.parts).length, 'parts');
