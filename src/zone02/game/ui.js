// 게임 화면 UI(DOM): 상단 상태, 역할 선택, 투표/사냥 대상 선택, 결과 카드, 대화 로그, 암전, 컷신 레터박스
const CSS = `
#gHud{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:7;text-align:center;pointer-events:none;text-shadow:0 1px 4px #000;font-family:'Malgun Gothic',system-ui,sans-serif;display:none}
#gHud .l1{font-size:22px;font-weight:800;color:#ffe9b8;letter-spacing:.04em}
#gHud .l2{font-size:13px;color:#e0d8c6;margin-top:3px}
#gHud .l2 b{color:#ff9a9a}
#gHint{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:7;pointer-events:none;font:700 15px 'Malgun Gothic',system-ui,sans-serif;color:#ffe9b8;background:rgba(10,8,4,.7);padding:8px 16px;border-radius:10px;border:1px solid rgba(255,217,138,.5);display:none;text-align:center;max-width:80vw}
.gPanel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;min-width:320px;max-width:min(520px,92vw);background:rgba(12,10,8,.94);border:1px solid #ffd98a;border-radius:14px;padding:20px 22px;color:#f1e9d6;font-family:'Malgun Gothic',system-ui,sans-serif;display:none;box-shadow:0 10px 40px rgba(0,0,0,.6)}
.gPanel h2{margin:0 0 6px;font-size:22px;color:#ffe9b8}
.gPanel p{margin:6px 0 12px;font-size:14px;line-height:1.6;color:#d9d1bf;white-space:pre-line}
.gPanel .row{display:flex;flex-wrap:wrap;gap:8px}
.gBtn{font:700 14px 'Malgun Gothic',system-ui,sans-serif;color:#f4ecd8;background:rgba(40,32,20,.9);border:1px solid rgba(255,217,138,.5);border-radius:9px;padding:9px 14px;cursor:pointer}
.gBtn:hover{background:rgba(90,66,30,.95);border-color:#ffd98a}
.gBtn.sel{background:#7a1d1d;border-color:#ff8a8a}
.gBtn.big{font-size:16px;padding:12px 18px}
#gLog{position:fixed;left:16px;bottom:56px;z-index:7;width:min(430px,46vw);pointer-events:none;font:600 13px/1.5 'Malgun Gothic',system-ui,sans-serif;color:#e9e4d8;text-shadow:0 1px 3px #000}
#gLog div{background:rgba(8,10,18,.6);padding:3px 9px;border-radius:6px;margin-top:3px;width:fit-content;max-width:100%}
#gLog b{color:#ffd98a}
#gFade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:8;transition:opacity .45s}
#gBars{position:fixed;inset:0;pointer-events:none;z-index:8;display:none}
#gBars:before,#gBars:after{content:'';position:absolute;left:0;right:0;height:11vh;background:#000}
#gBars:before{top:0}#gBars:after{bottom:0}
#gFlash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:9;transition:opacity .1s}
#gBig{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);z-index:9;pointer-events:none;font:800 54px 'Malgun Gothic',system-ui,sans-serif;color:#ffe2b0;text-shadow:0 2px 20px rgba(255,150,40,.8),0 3px 6px #000;opacity:0;transition:opacity .5s,transform .5s;text-align:center;white-space:pre-line;letter-spacing:.06em}
#gBig.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#gBig.red{color:#ff8a8a;text-shadow:0 2px 20px rgba(255,30,30,.8),0 3px 6px #000}
#gStart{position:fixed;left:16px;top:96px;z-index:7;display:none}
#gNotes{position:fixed;right:16px;top:300px;width:min(300px,34vw);max-height:42vh;overflow:auto;z-index:7;background:rgba(10,8,6,.82);border:1px solid rgba(255,217,138,.4);border-radius:10px;padding:10px 12px;color:#eadfc6;font:600 12px/1.55 'Malgun Gothic',system-ui,sans-serif;display:none}
#gNotes h3{margin:0 0 6px;font-size:13px;color:#ffd98a}
#gNotes div.n{margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,.1)}
#gProg{position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:7;width:260px;display:none;text-align:center;font:700 12px 'Malgun Gothic',system-ui,sans-serif;color:#ffe9b8;text-shadow:0 1px 3px #000}
#gProg .bar{height:8px;border-radius:5px;background:rgba(255,255,255,.18);margin-top:4px;overflow:hidden}
#gProg .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffb04a,#ff6a3a)}
#gAlert{position:fixed;left:50%;top:112px;transform:translateX(-50%);z-index:8;display:none;font:800 20px 'Malgun Gothic',system-ui,sans-serif;color:#ffd0d0;background:rgba(80,8,8,.82);border:1px solid #ff6a6a;border-radius:10px;padding:8px 18px;text-align:center}
#gGallery{position:fixed;inset:0;z-index:9;background:rgba(6,5,4,.92);display:none;overflow:auto;padding:18px;font-family:'Malgun Gothic',system-ui,sans-serif;color:#f1e9d6}
#gGallery h2{margin:0 0 10px;color:#ffe9b8}
#gGallery .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
#gGallery .ph{background:#15110d;border:1px solid rgba(255,217,138,.35);border-radius:8px;overflow:hidden}
#gGallery .ph img{width:100%;display:block}
#gGallery .ph p{margin:0;padding:6px 8px;font-size:12px;line-height:1.5;color:#d9d1bf}
.gBtn.sm{padding:5px 9px;font-size:12px}
`;

export function createUI() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = (tag, id, cls, parent = document.body) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; parent.appendChild(e); return e; };
  const hud = el('div', 'gHud'); hud.innerHTML = '<div class="l1"></div><div class="l2"></div>';
  const hint = el('div', 'gHint');
  const log = el('div', 'gLog');
  const fade = el('div', 'gFade'), bars = el('div', 'gBars'), flash = el('div', 'gFlash'), big = el('div', 'gBig');
  const panel = el('div', 'gPanel', 'gPanel'); // 하나의 패널을 용도별로 재사용
  const startBtn = el('button', 'gStart', 'gBtn'); startBtn.textContent = '🎮 게임 시작';
  const notes = el('div', 'gNotes'); notes.innerHTML = '<h3>📓 내 수첩 (J)</h3><div class="list"></div>';
  const prog = el('div', 'gProg'); prog.innerHTML = '<span></span><div class="bar"><i></i></div>';
  const alertEl = el('div', 'gAlert');
  const gallery = el('div', 'gGallery');

  const ui = {
    hudEl: hud, panelEl: panel,
    setHud(l1, l2) {
      const key = l1 + '|' + l2; if (key === this._hudKey) return; this._hudKey = key;
      hud.style.display = l1 ? 'block' : 'none'; hud.querySelector('.l1').textContent = l1; hud.querySelector('.l2').innerHTML = l2;
    },
    setHint(t) { hint.style.display = t ? 'block' : 'none'; hint.textContent = t || ''; },
    say(name, text, color = '#ffd98a') {
      const d = document.createElement('div'); d.innerHTML = `<b style="color:${color}">${name}</b> ${text}`; log.appendChild(d);
      while (log.children.length > 9) log.removeChild(log.firstChild);
      setTimeout(() => d.remove(), 26000);
    },
    system(text) { const d = document.createElement('div'); d.style.color = '#bfe3ff'; d.textContent = text; log.appendChild(d); while (log.children.length > 9) log.removeChild(log.firstChild); setTimeout(() => d.remove(), 26000); },
    fade(on) { fade.style.opacity = on ? '1' : '0'; },
    bars(on) { bars.style.display = on ? 'block' : 'none'; },
    flash() { flash.style.opacity = '0.95'; setTimeout(() => { flash.style.opacity = '0'; }, 110); },
    big(text, red = false) { big.textContent = text || ''; big.classList.toggle('on', !!text); big.classList.toggle('red', red); },
    startButton(show, onClick) { startBtn.style.display = show ? 'block' : 'none'; startBtn.onclick = onClick; },
    // 내 수첩(개인 기록): 능력 결과, 들은 정보
    notesVisible(on) { notes.style.display = on ? 'block' : 'none'; },
    toggleNotes() { notes.style.display = notes.style.display === 'block' ? 'none' : 'block'; },
    setNotes(list) { const box = notes.querySelector('.list'); box.innerHTML = ''; for (const n of list.slice(-14)) { const d = document.createElement('div'); d.className = 'n'; d.textContent = n; box.appendChild(d); } box.parentElement.scrollTop = 1e6; },
    // 진행 막대(조사·포교·치료 등)
    progress(label, v) { if (v == null) { prog.style.display = 'none'; return; } prog.style.display = 'block'; prog.querySelector('span').textContent = label; prog.querySelector('i').style.width = Math.round(Math.min(1, v) * 100) + '%'; },
    alert(text) { alertEl.style.display = text ? 'block' : 'none'; alertEl.textContent = text || ''; },
    // 사진첩: photos = [{img, caption}]
    gallery(photos, onClose) {
      if (!photos) { gallery.style.display = 'none'; return; }
      gallery.innerHTML = '<h2>📷 사진첩 <button class="gBtn sm" id="gGalClose">닫기 ✕</button></h2>';
      const grid = document.createElement('div'); grid.className = 'grid'; gallery.appendChild(grid);
      if (!photos.length) { const p = document.createElement('p'); p.textContent = '아직 찍힌 사진이 없어요. (기자가 C 키로 촬영해요)'; gallery.appendChild(p); }
      for (const ph of photos) { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = `<img src="${ph.img}"><p>${ph.caption}</p>`; grid.appendChild(d); }
      gallery.style.display = 'block'; gallery.querySelector('#gGalClose').onclick = () => { gallery.style.display = 'none'; onClose?.(); };
    },
    get galleryOpen() { return gallery.style.display === 'block'; },
    // 패널: {title, body, buttons:[{label, cls?, onClick}], rows:[{label, onClick}]}
    panel({ title, body = '', buttons = [], rows = [] } = {}) {
      if (!title) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
      panel.innerHTML = '';
      const h = document.createElement('h2'); h.textContent = title; panel.appendChild(h);
      if (body) { const p = document.createElement('p'); p.textContent = body; panel.appendChild(p); }
      const mk = (list, big) => { if (!list.length) return; const r = document.createElement('div'); r.className = 'row'; r.style.marginTop = '8px'; for (const b of list) { const x = document.createElement('button'); x.className = 'gBtn' + (big ? ' big' : '') + (b.cls ? ' ' + b.cls : ''); x.textContent = b.label; x.onclick = () => b.onClick(x, r); r.appendChild(x); } panel.appendChild(r); };
      mk(rows, false); mk(buttons, true);
      panel.style.display = 'block';
    },
  };
  return ui;
}
