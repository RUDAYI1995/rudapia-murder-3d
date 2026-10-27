// 원본 1344×768의 기준점으로 맞춘 구도. 모델 재질과 게임 규칙은 이 파일이 변경하지 않는다.
export const COMPOSITION = {
  camera: {
    position: [7.6324167, 1.8, 23.5142087],
    target: [3.9230344, 0.2077113, 10.1087956],
    fov: 40.8847409,
  },
  hall: { width: 8, depth: 26, ceiling: 5.4 },
  windows: { centers: [2.5, 6.5, 10.5], base: 1.2, height: 3.6292124 },
  table: { x: 3.84856, z: 12.44166, scale: 0.94437 },
  cabinet: { x: 7.10, z: 18.123414, yaw: 0.933165, tilt: -0.032858, scale: 0.635, heightScale: 0.88 },
  corridor: { origin: [9.24, 0, 17], angle: -0.17, scale: [0.65, 0.70, 1] },
  chandelier: { x: 4.7541, y: 3.3, z: 13.8945, scale: 1.1 },
  actor: { x: 6.456, z: 22.181, heading: Math.PI + 0.6 },
};
