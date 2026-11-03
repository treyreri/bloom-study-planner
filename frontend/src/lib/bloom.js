/* ==========================================================================
   Bloom — shared helpers (ported 1:1 from the former vanilla-JS helpers):
   toasts, confetti, dates in the server's "today", plurals,
   and the shared vocabulary (priorities, kinds, flower stages).
   Texts come from src/locales (see src/i18n.js).
   ========================================================================== */
import i18n, { locale } from '../i18n.js';

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
  return date.toLocaleDateString(locale(), options);
}

/** daysWord(5) -> 'дней' / 'days' (plural rules of the current language) */
export const daysWord = (n) => i18n.t('common.days', { count: n });

export function minutesText(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return i18n.t('common.minutes', { m });
  return m ? i18n.t('common.hoursMinutes', { h, m }) : i18n.t('common.hours', { h });
}

// ---------- shared vocabulary --------------------------------------------

/** monthName(11) -> 'Ноябрь' / 'November' */
export const monthName = (month) => i18n.t('months', { returnObjects: true })[month - 1];

export const PRIORITY_EMOJI = { low: '🌸', mid: '🌷', high: '🌹' };
/** '🌷 средний' */
export const priorityText = (priority) => `${PRIORITY_EMOJI[priority]} ${i18n.t(`priority.${priority}`)}`;

export const STAGE_EMOJI = { seedling: '🌱', stem: '🌿', bud: '🌷', bouquet: '💐' };
export const stageLabel = (stage) => i18n.t(`stages.${stage}`);

// ---------- feedback (plain DOM, outside React, exactly as before) --------

export function toast(message, type = 'info', duration = null) {
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
  setTimeout(() => item.remove(), duration || (type === 'error' ? 5000 : 2600));
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
    toast(i18n.t('common.allDone'));
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
  return i18n.t('common.pageTitle', { title });
}

/** Tells the notification bell that tasks or deadlines changed. */
export const DATA_CHANGED = 'bloom:data-changed';
export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED));
}
