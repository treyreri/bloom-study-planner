/* ==========================================================================
   Bloom — shared helpers for every page.

   Authentication: the browser is logged in with the Django session cookie.
   fetch() sends that cookie automatically and we add the CSRF token header,
   so no JWT is ever stored in localStorage (safer against XSS token theft).

   Safety: user data is always put on the page with textContent (see el()),
   never with innerHTML.
   ========================================================================== */
const Bloom = (() => {
  const API = '/api/v1/';

  // ---------- requests ----------------------------------------------------

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  }

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  /** Turn a DRF error body into one readable sentence. */
  function errorMessage(data) {
    if (!data) return 'Что-то пошло не так. Попробуйте ещё раз.';
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return data.map(errorMessage).join(' ');
    if (data.detail) return String(data.detail);
    return Object.entries(data)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(' ') : errorMessage(messages);
        return field === 'non_field_errors' ? text : `${FIELD_NAMES[field] || field}: ${text}`;
      })
      .join(' ');
  }

  const FIELD_NAMES = {
    title: 'Название', date: 'Дата', name: 'Название', due_date: 'Дата',
    start_time: 'Начало', end_time: 'Конец', week_start: 'Неделя', mood: 'Настроение',
    subject: 'Предмет', month_plan: 'Месяц', duration_min: 'Длительность',
    focus_goals: 'Фокус-цели', color: 'Цвет', avatar: 'Аватар', year: 'Год', month: 'Месяц',
  };

  /**
   * api('tasks/', {method: 'POST', body: {...}})
   * Returns the parsed JSON (or null for 204). Throws ApiError on failure.
   */
  async function api(path, { method = 'GET', body, formData } = {}) {
    const url = path.startsWith('/') ? path : API + path;
    const headers = { Accept: 'application/json' };
    let payload;
    if (formData) {
      payload = formData;                          // browser sets multipart headers
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (method !== 'GET') headers['X-CSRFToken'] = csrfToken();

    let response;
    try {
      response = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
    } catch (networkError) {
      throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0, null);
    }

    if (response.status === 401) {
      // the session has expired: go to the login page and come back afterwards
      window.location.href = '/login/?next=' + encodeURIComponent(location.pathname + location.search);
      throw new ApiError('Нужно войти снова.', 401, null);
    }
    if (response.status === 204) return null;

    let data = null;
    const type = response.headers.get('Content-Type') || '';
    if (type.includes('application/json')) data = await response.json();

    if (!response.ok) {
      const message = response.status === 404 ? 'Не найдено.' : errorMessage(data);
      throw new ApiError(message, response.status, data);
    }
    return data;
  }

  /** Load every page of a paginated list ({count, next, results}). */
  async function getAll(path) {
    let data = await api(path);
    if (!data || !Array.isArray(data.results)) return data || [];
    const items = [...data.results];
    while (data.next) {
      const next = new URL(data.next);
      data = await api(next.pathname + next.search);
      items.push(...data.results);
    }
    return items;
  }

  // ---------- DOM ---------------------------------------------------------

  /**
   * el('li', {class: 'task', onclick: fn, dataset: {id: 1}}, 'text', otherNode)
   * Strings become text nodes, so user input can never become HTML.
   */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'style') node.style.cssText = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (key === 'text') node.textContent = value;
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, value);
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function $(selector, root = document) { return root.querySelector(selector); }

  function loading(container, text = 'Загружаем') {
    container.replaceChildren(el('p', { class: 'loading' }, text));
  }

  function empty(container, icon, text) {
    container.replaceChildren(el('div', { class: 'empty-state' },
      el('span', { class: 'icon', 'aria-hidden': 'true' }, icon), text));
  }

  function failed(container, error) {
    container.replaceChildren(el('p', { class: 'form-error', role: 'alert' },
      'Не удалось загрузить: ' + error.message));
  }

  // ---------- pixel heart checkbox ---------------------------------------

  const HEART = [
    '.XX...XX.',
    'XXXX.XXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ];
  const isPixel = (x, y) => HEART[y] && HEART[y][x] === 'X';
  const pixelPath = (test) => {
    let d = '';
    HEART.forEach((row, y) => [...row].forEach((_, x) => {
      if (test(x, y)) d += `M${x} ${y}h1v1h-1z`;
    }));
    return d;
  };
  // outline = pixels of the heart that touch the outside
  const OUTLINE = pixelPath((x, y) => isPixel(x, y) &&
    (!isPixel(x - 1, y) || !isPixel(x + 1, y) || !isPixel(x, y - 1) || !isPixel(x, y + 1)));
  const FILLED = pixelPath(isPixel);

  function heartSvg(filled) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 9 8');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', filled ? FILLED : OUTLINE);
    path.setAttribute('class', filled ? 'fill' : 'outline');
    svg.append(path);
    if (filled) {
      const shine = document.createElementNS(ns, 'path');
      shine.setAttribute('d', 'M2 1h1v1h-1z');
      shine.setAttribute('fill', '#fff');
      shine.setAttribute('fill-opacity', '.75');
      svg.append(shine);
    }
    return svg;
  }

  /**
   * A heart that works like a checkbox.
   * onToggle(newValue) must return a Promise; on failure the heart goes back.
   */
  function heartButton({ checked, label, onToggle, disabled = false }) {
    const button = el('button', {
      type: 'button', class: 'heart-check', role: 'checkbox',
      'aria-checked': String(Boolean(checked)), 'aria-label': label, title: label, disabled,
    }, heartSvg(checked));

    button.addEventListener('click', async () => {
      const next = button.getAttribute('aria-checked') !== 'true';
      set(next);
      button.disabled = true;
      try {
        await onToggle(next);
      } catch (error) {
        set(!next);
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });

    function set(value) {
      button.setAttribute('aria-checked', String(value));
      button.replaceChildren(heartSvg(value));
      button.classList.remove('pulse');
      void button.offsetWidth;            // restart the CSS animation
      if (value) button.classList.add('pulse');
    }
    return button;
  }

  // ---------- feedback ----------------------------------------------------

  function toast(message, type = 'info') {
    let box = $('.toasts');
    if (!box) {
      box = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.append(box);
    }
    const item = el('div', { class: 'toast' + (type === 'error' ? ' error' : '') }, message);
    box.append(item);
    setTimeout(() => item.remove(), type === 'error' ? 5000 : 2600);
  }

  /** Put an API error next to the form (and in a toast). */
  function showFormError(form, error) {
    const box = form.querySelector('.form-error');
    if (box) box.textContent = error.message;
    else toast(error.message, 'error');
  }
  function clearFormError(form) {
    const box = form.querySelector('.form-error');
    if (box) box.textContent = '';
  }

  /** Disable the submit button while a request is running. */
  async function busy(form, work) {
    const button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    clearFormError(form);
    try {
      return await work();
    } catch (error) {
      showFormError(form, error);
      return undefined;
    } finally {
      if (button) button.disabled = false;
    }
  }

  /** Two-step delete: the first click asks "Точно?", the second one confirms. */
  function confirmClick(button, action, question = 'Точно?') {
    button.addEventListener('click', async () => {
      if (button.dataset.armed !== 'true') {
        button.dataset.armed = 'true';
        button.dataset.text = button.textContent;
        button.textContent = question;
        setTimeout(() => {
          button.dataset.armed = 'false';
          button.textContent = button.dataset.text;
        }, 3000);
        return;
      }
      button.disabled = true;
      try { await action(); } catch (error) { toast(error.message, 'error'); button.disabled = false; }
    });
    return button;
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hearts = ['💗', '💖', '🌸', '💕', '🌷'];
    for (let i = 0; i < 36; i++) {
      const piece = el('span', {
        class: 'confetti-heart', 'aria-hidden': 'true',
        style: `left:${Math.random() * 100}vw;animation-duration:${2 + Math.random() * 2}s;` +
               `animation-delay:${Math.random() * .6}s;font-size:${16 + Math.random() * 16}px`,
      }, hearts[i % hearts.length]);
      document.body.append(piece);
      setTimeout(() => piece.remove(), 5000);
    }
  }

  // ---------- dates (always the server's "today", see base.html) ---------

  const pad = (n) => String(n).padStart(2, '0');
  function iso(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  function parseDate(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); }
  function today() { return parseDate(document.body.dataset.today); }
  function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
  function monday(date) { return addDays(date, -((date.getDay() + 6) % 7)); }

  function formatDate(value, options = { day: 'numeric', month: 'long' }) {
    const date = typeof value === 'string' ? parseDate(value) : value;
    return date.toLocaleDateString('ru-RU', options);
  }

  /** plural(5, ['день', 'дня', 'дней']) -> 'дней' */
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }
  const daysWord = (n) => plural(n, ['день', 'дня', 'дней']);

  function minutesText(minutes) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    if (!h) return `${m} мин`;
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }

  // ---------- shared vocabulary ------------------------------------------

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const PRIORITY = {
    low: { emoji: '🌸', label: 'низкий' },
    mid: { emoji: '🌷', label: 'средний' },
    high: { emoji: '🌹', label: 'высокий' },
  };
  const KINDS = {
    exam: 'экзамен', test: 'зачёт', coursework: 'курсовая', homework: 'ДЗ',
  };
  const KINDS_GENITIVE = {
    exam: 'экзамена', test: 'зачёта', coursework: 'курсовой', homework: 'ДЗ',
  };
  const STAGES = {
    seedling: { emoji: '🌱', label: 'росток' },
    stem: { emoji: '🌿', label: 'стебель' },
    bud: { emoji: '🌷', label: 'бутон' },
    bouquet: { emoji: '💐', label: 'букет' },
  };

  /** Flower in a pot + vine progress bar. Animates when the stage changes. */
  function renderFlower(container, progress, previousStage) {
    const stage = STAGES[progress.stage];
    const pot = el('div', { class: 'pot', role: 'img', 'aria-label': `Цветок: ${stage.label}` }, stage.emoji);
    if (previousStage && previousStage !== progress.stage) pot.classList.add('grow');
    container.replaceChildren(
      el('div', { class: 'flower' },
        pot,
        el('strong', {}, `${stage.label[0].toUpperCase()}${stage.label.slice(1)}`),
        el('span', { class: 'muted small' }, `${progress.done} из ${progress.total} задач`)),
      el('div', {
        class: 'vine', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100',
        'aria-valuenow': String(progress.percent), 'aria-label': 'Прогресс месяца',
      }, el('div', { class: 'vine-fill', style: `width:${progress.percent}%` })),
      el('div', { class: 'small muted', style: 'text-align:center' },
        el('span', { class: 'num' }, `${progress.percent}%`), ' выполнено'),
    );
    container.dataset.stage = progress.stage;
  }

  /** Read a form into a plain object; empty strings become null. */
  function formValues(form) {
    const values = {};
    for (const [key, value] of new FormData(form).entries()) {
      if (value instanceof File) continue;
      values[key] = value === '' ? null : value;
    }
    return values;
  }

  /** Fill <select> with the user's subjects. */
  async function fillSubjectSelect(select, { emptyLabel = 'Без предмета', subjects } = {}) {
    const list = subjects || await getAll('subjects/');
    select.replaceChildren(
      el('option', { value: '' }, emptyLabel),
      ...list.map((s) => el('option', { value: s.id }, s.name)));
    return list;
  }

  return {
    api, getAll, ApiError, el, $, loading, empty, failed,
    heartSvg, heartButton, toast, showFormError, clearFormError, busy, confirmClick, confetti,
    iso, parseDate, today, addDays, monday, formatDate, plural, daysWord, minutesText,
    MONTHS, PRIORITY, KINDS, KINDS_GENITIVE, STAGES, renderFlower, formValues, fillSubjectSelect,
  };
})();

// Mobile "Ещё" menu
document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('[data-more-toggle]');
  const sheet = document.getElementById('more-sheet');
  if (!button || !sheet) return;
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    sheet.hidden = !open;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet.hidden) { sheet.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  });
});
