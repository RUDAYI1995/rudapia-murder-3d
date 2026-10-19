// 한글 조사 처리 + 작은 유틸
export const hasFinal = w => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
export const iga = w => w + (hasFinal(w) ? '이' : '가');
export const eul = w => w + (hasFinal(w) ? '을' : '를');
export const eun = w => w + (hasFinal(w) ? '은' : '는');
export const gwa = w => w + (hasFinal(w) ? '과' : '와');
export const ro = w => { const c = String(w).charCodeAt(String(w).length - 1); const f = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; return w + (f === 0 || f === 8 ? '로' : '으로'); };
export const rnd = Math.random;
export const pick = a => a[Math.floor(rnd() * a.length)];
export const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const joinNames = (names) => (names.length <= 1 ? names.join('') : names.length === 2 ? `${names[0]}, ${names[1]}` : `${names.slice(0, -1).join(', ')}, ${names[names.length - 1]}`);
