/* ==========================================================================
   Bloom — shared helpers (ported 1:1 from the former vanilla-JS helpers):
   toasts, confetti, dates in the server's "today", Russian plurals,
   and the shared vocabulary (priorities, kinds, flower stages).
   ========================================================================== */

// ---------- "today" comes from the server (TIME_ZONE), like data-today before ----

let serverToday = null;   // 'YYYY-MM-DD', set by the auth provider

export function setServerToday(value) { serverToday = value; }

const pad = (n) => String(n).padStart(2, '0');
export function iso(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
export function parseDate(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
export function today() { return serverToday ? parseDate(serverToday) : parseDate(iso(new Date())); }
export function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
export function monday(date) { return addDays(date, -((date.getDay() + 6) % 7)); }

export function formatDate(value, options = { day: 'numeric', month: 'long' }) {
  const date = typeof value === 'string' ? parseDate(value) : value;
  return date.toLocaleDateString('ru-RU', options);
}

/** plural(5, ['день', 'дня', 'дней']) -> 'дней' */
export function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
export const daysWord = (n) => plural(n, ['день', 'дня', 'дней']);

export function minutesText(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

// ---------- shared vocabulary --------------------------------------------

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const PRIORITY = {
  low: { emoji: '🌸', label: 'низкий' },
  mid: { emoji: '🌷', label: 'средний' },
  high: { emoji: '🌹', label: 'высокий' },
};
export const KINDS = {
  exam: 'экзамен', test: 'зачёт', coursework: 'курсовая', homework: 'ДЗ',
};
export const KINDS_GENITIVE = {
  exam: 'экзамена', test: 'зачёта', coursework: 'курсовой', homework: 'ДЗ',
};
export const STAGES = {
  seedling: { emoji: '🌱', label: 'росток' },
  stem: { emoji: '🌿', label: 'стебель' },
  bud: { emoji: '🌷', label: 'бутон' },
  bouquet: { emoji: '💐', label: 'букет' },
};

// ---------- feedback (plain DOM, outside React, exactly as before) --------

export function toast(message, type = 'info') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const item = document.createElement('div');
  item.className = 'toast' + (type === 'error' ? ' error' : '');
  item.textContent = message;
  box.append(item);
  setTimeout(() => item.remove(), type === 'error' ? 5000 : 2600);
}

export function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hearts = ['💗', '💖', '🌸', '💕', '🌷'];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-heart';
    piece.setAttribute('aria-hidden', 'true');
    piece.style.cssText = `left:${Math.random() * 100}vw;animation-duration:${2 + Math.random() * 2}s;` +
      `animation-delay:${Math.random() * .6}s;font-size:${16 + Math.random() * 16}px`;
    piece.textContent = hearts[i % hearts.length];
    document.body.append(piece);
    setTimeout(() => piece.remove(), 5000);
  }
}

/** Confetti when every task of a non-empty list is done. */
export function celebrateIfAllDone(tasks) {
  if (tasks.length && tasks.every((task) => task.is_done)) {
    confetti();
    toast('Все задачи на сегодня сделаны! 🌷');
  }
}

/** Read a form into a plain object; empty strings become null. */
export function formValues(form) {
  const values = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (value instanceof File) continue;
    values[key] = value === '' ? null : value;
  }
  return values;
}

/** document.title in the same format as the old base.html */
export function pageTitle(title) {
  return `${title} · Bloom 🌷`;
}
