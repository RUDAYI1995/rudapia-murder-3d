// 효과음(파일 없이 WebAudio 로 합성): 경찰 호루라기, 총소리, 카메라 셔터, 심장 소리. 브라우저 정책상 클릭 같은 사용자 조작 뒤에만 소리가 난다.
let ctx = null;
const ac = () => {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
let master = 0.8;
export const setVolume = v => { master = v; };

function noiseBuffer(c, secs) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** 경찰 호루라기: 삑- 삑- 삑- (높은 음 + 핀이 구르는 떨림 + 숨소리) */
export function whistle() {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.5, dur = i === 2 ? 0.7 : 0.34;
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(2750, t); o.frequency.linearRampToValueAtTime(3350, t + 0.08); o.frequency.linearRampToValueAtTime(3050, t + dur);
    lfo.frequency.value = 34; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);   // 트릴
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.38 * master, t + 0.03); g.gain.setValueAtTime(0.38 * master, t + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    // 숨소리
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, dur); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2.5;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.18 * master, t + 0.03); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(ng); ng.connect(c.destination); n.start(t); n.stop(t + dur + 0.05);
  }
}

/** 총소리: 짧은 잡음 폭발 + 낮은 울림 */
export function gunshot() {
  const c = ac(); if (!c) return;
  const t = c.currentTime + 0.01;
  const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.5); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.35);
  const g = c.createGain(); g.gain.setValueAtTime(0.9 * master, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  n.connect(lp); lp.connect(g); g.connect(c.destination); n.start(t);
  const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  og.gain.setValueAtTime(0.8 * master, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(og); og.connect(c.destination); o.start(t); o.stop(t + 0.35);
}

/** 카메라 셔터: 찰칵 */
export function shutter() {
  const c = ac(); if (!c) return;
  const t = c.currentTime + 0.01;
  for (const [dt, f] of [[0, 2400], [0.09, 1500]]) {
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.06); const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = f; hp.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(0.5 * master, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.05);
    n.connect(hp); hp.connect(g); g.connect(c.destination); n.start(t + dt);
  }
}

/** 심장 소리(쿵-쿵): 쫓길 때 */
export function heartbeat() {
  const c = ac(); if (!c) return;
  const t = c.currentTime + 0.01;
  for (const dt of [0, 0.22]) {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(40, t + dt + 0.15);
    g.gain.setValueAtTime(0.5 * master, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18); o.connect(g); g.connect(c.destination); o.start(t + dt); o.stop(t + dt + 0.2);
  }
}

/** 알림 소리 */
export function ding() {
  const c = ac(); if (!c) return;
  const t = c.currentTime + 0.01, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + 0.08);
  g.gain.setValueAtTime(0.25 * master, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.35);
}
