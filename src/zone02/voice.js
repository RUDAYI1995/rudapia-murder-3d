// 음성 명령: 브라우저 내장 음성인식(Web Speech API, 크롬·엣지)으로 "앉아" / "시작" / "일어서" 를 듣는다.
// 켜고 끄는 것은 사용자가 고른다. 켜 두면 계속 듣고(무음이 길어져 브라우저가 끊어도 자동으로 다시 켠다), 인식된 말은 화면에 잠깐 보여 준다.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// 비슷하게 들리는 말도 같은 명령으로 본다. 위에서부터 먼저 맞는 것이 이긴다.
const COMMANDS = [
  ['일어서', /일어|기립|해산/],
  ['시작', /시작|시자|시잔/],
  ['앉아', /앉|안자|안저|앙자/],
];
export const matchCommand = text => { const s = text.replace(/\s+/g, ''); for (const [cmd, re] of COMMANDS) if (re.test(s)) return cmd; return null; };

export function createVoice({ onCommand, onHeard, onState, onError }) {
  const supported = !!SR;
  let rec = null, wanted = false, running = false, handled = new Set();

  function build() {
    const r = new SR();
    r.lang = 'ko-KR'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
    r.onstart = () => { running = true; onState?.(true); };
    r.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        // 후보 중 명령으로 인식되는 것이 있으면 사용 (가장 가능성 높은 후보부터)
        let text = res[0].transcript, cmd = null;
        for (let k = 0; k < res.length && !cmd; k++) { cmd = matchCommand(res[k].transcript); if (cmd) text = res[k].transcript; }
        onHeard?.(text.trim(), res.isFinal, cmd);
        // 말이 끝나기 전(중간 결과)에도 명령어가 들리면 바로 실행해서 반응을 빠르게 한다. 같은 말을 두 번 실행하지 않는다.
        if (cmd && !handled.has(i)) { handled.add(i); onCommand?.(cmd); }
        if (res.isFinal) handled.delete(i);
      }
    };
    r.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { wanted = false; onError?.('마이크 사용이 허용되지 않았어요. 주소창 왼쪽 자물쇠에서 마이크를 허용하고 다시 켜 주세요. (앱 내장 미리보기 창은 마이크가 막혀 있을 수 있어요. 크롬/엣지에서 열어 주세요.)'); }
      else if (e.error === 'audio-capture') { wanted = false; onError?.('마이크를 찾을 수 없어요. 마이크가 연결되어 있는지 확인해 주세요.'); }
      else if (e.error === 'network') { wanted = false; onError?.('음성인식 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.'); }
      else onError?.('음성인식 오류: ' + e.error);
    };
    r.onend = () => {
      running = false; handled.clear();
      if (wanted) { try { setTimeout(() => { if (wanted && !running) { rec = build(); rec.start(); } }, 250); } catch { /* 재시작 실패는 무시 */ } }
      else onState?.(false);
    };
    return r;
  }

  return {
    supported,
    get on() { return wanted; },
    start() {
      if (!supported) { onError?.('이 브라우저는 음성인식을 지원하지 않아요. 크롬이나 엣지에서 열어 주세요.'); return false; }
      if (wanted) return true;
      wanted = true;
      try { rec = build(); rec.start(); } catch (e) { wanted = false; onError?.('음성인식을 시작할 수 없어요: ' + e.message); return false; }
      return true;
    },
    stop() { wanted = false; try { rec?.stop(); } catch { /* 이미 멈춤 */ } onState?.(false); },
  };
}
