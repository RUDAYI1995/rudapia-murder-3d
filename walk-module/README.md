# 걷기 모듈 (three.js)

루다피아 3D에서 쓰는 **걷기 · 충돌 · 3인칭 카메라**만 따로 뗀 것입니다. 맵·조명·그래픽과 상관없이 `three` 하나만 있으면 다른 프로그램에 그대로 넣을 수 있습니다.

## 들어 있는 파일

| 파일 | 용도 |
|---|---|
| `walk.js` | **핵심 코드 한 파일** (충돌 + 캐릭터 + 카메라 + 입력). 이것만 가져가면 됩니다 |
| `walk-demo.html` | 더블클릭으로 바로 열리는 **데모**(인터넷 연결 필요: three.js를 CDN에서 불러옴). 코드가 안에 들어 있음 |
| `demo.template.html`, `build-demo.mjs` | 데모를 다시 만드는 도구(`node walk-module/build-demo.mjs`). 이식에는 불필요 |

## 할 수 있는 것

- **WASD / 방향키** 이동, **Shift** 달리기
- **마우스**로 시점 회전(클릭하면 마우스 고정, 고정이 안 될 땐 왼쪽 버튼 드래그), **Q/E** 로 카메라 회전, **휠**로 거리 조절
- 벽·기둥·가구에 부딪히면 **막히지 않고 미끄러짐** (벽 따라 걷기)
- 카메라가 **벽과 천장을 뚫지 않음** (닿으면 앞으로 당겨짐), 가로등 같은 가는 기둥도 피함
- 걸으면 카메라가 **캐릭터 뒤쪽으로 자동으로 따라 돎** (앞으로 갈수록 빠르게, 옆걸음은 완만하게, 뒷걸음은 안 돎)
- 걷기 **다리/팔 흔들기 + 몸 상하 흔들림**. 벽에 막히면 모션도 느려짐

## 가져다 쓰는 법 (3단계)

### 1) 파일 넣고 import

```js
import * as THREE from 'three';
import { makeColliders, WalkCharacter, bindWalkInput } from './walk.js';
```

### 2) 충돌 데이터 만들기 — 눈에 보이는 물체와 같은 위치에 한 번씩 등록

```js
const col = makeColliders();

// 박스(벽/가구): 중심 x, 중심 z, 폭, 깊이, 바닥 높이, 윗 높이, 태그
col.addCenterBox(10, 0, 20, 0.3, 0, 3.2, 'wall');   // 벽 → 카메라도 피함
col.addCenterBox(10, 15, 2.4, 1.0, 0, 0.8, 'table'); // 가구 → 사람은 막히지만 카메라는 통과

// 원(기둥/화분): 중심 x, 중심 z, 반지름, 태그
col.addCircle(6, 5, 0.35, 'pillar');
```

`'wall'`, `'pillar'` 태그는 카메라 충돌에도 쓰입니다(아래 `cameraBlockTags`). 다른 이름은 사람만 막습니다.

### 3) 캐릭터 만들고 매 프레임 호출

```js
const hero = new WalkCharacter({
  col,
  spawn: { x: 10, z: 24 },
  bounds: { minX: -8, maxX: 28, minZ: -8, maxZ: 40 },   // 월드 바깥으로 못 나가게 (생략 가능)
  ceilingAt: (x, z) => (실내이면 천장높이 : null),        // 실내 카메라가 천장을 뚫지 않게 (생략 가능)
  cameraBlockTags: ['wall', 'pillar'],
  // model: 내 캐릭터 Object3D            // 생략하면 임시 인물
});
hero.addTo(scene);

const input = bindWalkInput(renderer.domElement, hero);

renderer.setAnimationLoop(now => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const i = input.getInput(dt);        // { f, r, run }
  hero.update(dt, i, i.run);           // 이동 + 충돌 + 애니메이션
  hero.updateCamera(camera, dt);       // 카메라 (update 뒤에 호출)
  renderer.render(scene, camera);
});
```

## 조절하는 값 (hero 만든 뒤 바꾸면 됨)

| 값 | 기본 | 뜻 |
|---|---|---|
| `hero.WALK` | 3.9 | 걷기 속도 (m/s) |
| `hero.RUN` | 6.2 | 달리기 속도 |
| `hero.RADIUS` | 0.3 | 몸 반지름(충돌). 문 폭보다 작아야 통과 |
| `hero.dist` | 3.6 | 카메라 거리 (휠로 1.8~7) |
| `hero.pitch` | 0.2 | 카메라 높낮이 각도 |
| `hero.follow` | true | 걸을 때 카메라 자동 추적 켜기/끄기 |
| `bindWalkInput(..., {mouseSensitivity})` | 0.0024 | 마우스 감도 |

자동 추적 속도는 `walk.js`의 `update()` 안 `1.1 + 5.9 * fwd`(옆걸음 1.1/s, 앞으로 7/s), 대기 시간은 `this.camIdle > 0.45`(마우스를 멈춘 뒤 0.45초) 입니다.

## 내 캐릭터 모델로 바꾸려면

`model` 에 넣는 `Object3D` 가 다음을 지키면 됩니다.

1. **정면이 +Z** 를 보게 만든다(걷는 방향으로 `rotation.y = heading` 을 돌려 줌).
2. 걷기 애니메이션을 쓰려면 `model.userData` 에 `{ body, legL, legR, armL, armR }` 를 넣는다. 각 팔다리는 **관절 위치가 원점인 Group** (회전 축이 어깨/엉덩이). 없으면 모션 없이 위치만 이동한다.
3. glb 에 애니메이션 클립(Walk/Run/Idle)이 있다면 `update()` 맨 아래 "걷기 애니메이션" 부분을 `AnimationMixer` 로 바꾸고, `this.speed`(실제 이동 속도)로 Idle/Walk/Run 을 섞는다.

## 동작 원리 (다른 엔진에 옮길 때)

1. **이동 방향**: 입력 `f, r` 을 카메라 `yaw` 로 회전해서 월드 방향(`mx,mz`)을 만든다 → 카메라가 보는 쪽이 앞.
2. **충돌**: 다음 위치를 구한 뒤 `resolveCircle` 로 "원(몸) vs 박스/원" 겹침을 밀어낸다. 3회 반복해서 모서리에 끼어도 빠져나옴. 밀려난 만큼 실제 속도가 줄어든다.
3. **몸 회전**: `heading` 을 이동 방향으로 `dt*12` 비율로 부드럽게 보간(각도 차이는 `atan2(sin,cos)` 로 −π~π 로 정규화).
4. **카메라**: 캐릭터 어깨(높이 1.55)를 바라보고, `yaw/pitch/dist` 로 뒤쪽 위치를 구한다. 그 선분이 벽 박스와 만나는 비율 `t` 를 구해 거기까지만 당기고(`rayBoxesT`, 슬랩 방식), 위치는 지수 보간(`dt*12`, 벽 닿을 땐 `dt*22`)으로 부드럽게 이동.
5. **자동 추적**: 걷는 중이고 마우스를 0.45초 이상 안 만졌으면 `yaw` 를 `heading+π` 쪽으로 보간한다.
6. **프레임 독립**: 모든 이동·보간에 `dt` 를 곱했다. `dt` 는 0.05초로 제한해서 탭 전환 후 순간이동을 막는다.

Unity/Godot 등으로 옮길 때는 3·4·5번의 **공식만** 그대로 쓰고, 충돌은 엔진 기본 CharacterController/Raycast 로 대체하면 됩니다.

## 주의할 점

- 좌표계: **X 동쪽, Z 남쪽, Y 위**. `heading 0` = +Z, `π` = −Z.
- 마우스 고정(포인터락)은 **사용자가 클릭한 뒤**에만 되고, `https` 또는 `localhost` 에서만 됩니다. iframe/미리보기 창에서는 막힐 수 있습니다(그때는 왼쪽 버튼 드래그로 시점 회전).
- 충돌은 **위에서 본 2D**(원 vs 박스)입니다. 계단·경사·점프는 없습니다. 바닥 높이는 항상 0.
- 박스 `y1 < 0.05`(바닥에 깐 것) 와 `noPlayer: true` 인 박스는 사람 충돌에서 제외됩니다.
- 박스는 **축 정렬(회전 없음)** 만 지원합니다. 비스듬한 벽은 작은 박스를 여러 개 이어 붙이세요.
- `ceilingAt` 을 안 주면 카메라 천장 보정이 꺼집니다(야외용).

## 원본 위치 (루다피아 프로젝트)

- `src/zone02/character.js` — `Hero` 클래스 (이 모듈의 `WalkCharacter` 원본)
- `src/zone02/collide.js` — 충돌 함수 원본
- `src/zone02/main.js` — 입력 처리(187~213행)
