/* Pomodoro (/focus/): timer, saving sessions, statistics by subject */
(() => {
  const { el, api, $, toast } = Bloom;
  const CIRCLE = 2 * Math.PI * 52;       // circumference of the ring (r = 52)
  const DEMO_SECONDS = 10;

  const settings = $('#timer-settings');
  const subjectSelect = $('#timer-subject-select');
  const startButton = $('#timer-start');
  const ring = $('#timer-ring');
  const bar = $('#timer-bar');

  // phase: 'work' | 'break'; the timer uses an end timestamp so it stays
  // correct even when the browser slows down background tabs
  let phase = 'work';
  let totalSeconds = 25 * 60;
  let remaining = totalSeconds;
  let endsAt = null;
  let tick = null;
  let startedAt = null;
  let subjects = [];

  const isDemo = () => settings.elements.demo.checked;
  const workMinutes = () => clamp(Number(settings.elements.work.value) || 25, 1, 180);
  const breakMinutes = () => clamp(Number(settings.elements.break.value) || 5, 1, 60);
  function clamp(n, min, max) { return Math.min(max, Math.max(min, Math.round(n))); }

  function phaseSeconds() {
    if (isDemo()) return DEMO_SECONDS;
    return (phase === 'work' ? workMinutes() : breakMinutes()) * 60;
  }

  function format(seconds) {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function draw() {
    $('#timer-time').textContent = format(remaining);
    bar.style.strokeDashoffset = String(CIRCLE * (1 - remaining / totalSeconds));
    ring.classList.toggle('break', phase === 'break');
    $('#phase-label').textContent = phase === 'work' ? 'Работа 🍅' : 'Перерыв 🍵';
    document.title = endsAt ? `${format(remaining)} · ${phase === 'work' ? 'Фокус' : 'Перерыв'} · Bloom` : 'Помодоро · Bloom 🌷';
    const subject = subjects.find((s) => String(s.id) === subjectSelect.value);
    $('#timer-subject').textContent = subject ? subject.name : 'без предмета';
  }

  function resetPhase() {
    totalSeconds = phaseSeconds();
    remaining = totalSeconds;
    draw();
  }

  function start() {
    if (endsAt) return;
    if (phase === 'work' && remaining === totalSeconds) startedAt = new Date();
    endsAt = Date.now() + remaining * 1000;
    tick = setInterval(update, 250);
    startButton.textContent = 'Пауза';
    setSettingsDisabled(true);
    draw();
  }

  function pause() {
    clearInterval(tick);
    endsAt = null;
    startButton.textContent = 'Продолжить';
    draw();
  }

  function stop() {
    clearInterval(tick);
    endsAt = null;
    startButton.textContent = 'Старт';
    setSettingsDisabled(false);
  }

  function setSettingsDisabled(disabled) {
    for (const input of settings.elements) input.disabled = disabled;
  }

  function update() {
    remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    draw();
    if (remaining === 0) finishPhase();
  }

  async function finishPhase() {
    stop();
    beep();
    if (phase === 'work') {
      await saveSession();
      phase = 'break';
      toast('Помодоро завершён! Время отдохнуть 🍵');
    } else {
      phase = 'work';
      toast('Перерыв окончен — снова в бой 🌷');
    }
    resetPhase();
  }

  async function saveSession() {
    const minutes = isDemo() ? 1 : workMinutes();
    try {
      await api('pomodoro/', {
        method: 'POST',
        body: {
          subject: subjectSelect.value || null,
          duration_min: minutes,
          started_at: (startedAt || new Date()).toISOString(),
        },
      });
      loadStats();
      loadSessions();
    } catch (error) {
      toast('Сессию не удалось сохранить: ' + error.message, 'error');
    }
  }

  function beep() {
    try {
      const audio = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.8);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.8);
    } catch (error) {
      // sound is optional: some browsers block audio until the user interacts
    }
  }

  startButton.addEventListener('click', () => (endsAt ? pause() : start()));
  $('#timer-reset').addEventListener('click', () => { stop(); resetPhase(); });
  $('#timer-skip').addEventListener('click', () => {
    stop();
    phase = phase === 'work' ? 'break' : 'work';
    resetPhase();
  });
  settings.addEventListener('change', () => { if (!endsAt) resetPhase(); });

  // ---------- statistics -------------------------------------------------

  let chart = null;
  let period = 'week';

  async function loadStats() {
    const list = $('#stats-list');
    try {
      const stats = await api(`pomodoro/stats/?period=${period}`);
      $('#stats-total').textContent =
        `${period === 'week' ? 'За неделю' : 'За месяц'}: ${Bloom.minutesText(stats.total_minutes)} · ` +
        `${stats.sessions} ${Bloom.plural(stats.sessions, ['сессия', 'сессии', 'сессий'])}`;
      $('#chart-wrap').hidden = !stats.by_subject.length;
      if (!stats.by_subject.length) {
        Bloom.empty(list, '🍅', 'Пока нет сессий за этот период. Запусти таймер!');
        return;
      }
      list.replaceChildren(...stats.by_subject.map((row) => el('li', {},
        el('span', { class: 'swatch', style: `--dot:${row.color}` }),
        el('span', { class: 'grow' }, row.name),
        el('span', { class: 'num' }, Bloom.minutesText(row.minutes)))));
      drawChart(stats.by_subject);
    } catch (error) { Bloom.failed(list, error); }
  }

  function drawChart(rows) {
    if (typeof Chart === 'undefined') { $('#chart-wrap').hidden = true; return; }
    const data = {
      labels: rows.map((r) => r.name),
      datasets: [{ data: rows.map((r) => +(r.minutes / 60).toFixed(2)), backgroundColor: rows.map((r) => r.color), borderWidth: 2, borderColor: '#fff' }],
    };
    if (chart) { chart.data = data; chart.update(); return; }
    chart = new Chart($('#stats-chart'), {
      type: 'doughnut',
      data,
      options: {
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} ч` } },
        },
      },
    });
  }

  document.querySelectorAll('[data-period]').forEach((chip) => chip.addEventListener('click', () => {
    period = chip.dataset.period;
    document.querySelectorAll('[data-period]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    loadStats();
  }));

  async function loadSessions() {
    const list = $('#session-list');
    try {
      const data = await api('pomodoro/');   // newest first, first page only
      if (!data.results.length) { Bloom.empty(list, '⏳', 'Сессий ещё не было.'); return; }
      list.replaceChildren(...data.results.slice(0, 8).map((s) => el('li', {},
        el('span', { class: 'swatch', style: `--dot:${s.subject_color || 'var(--soft-pink)'}` }),
        el('span', { class: 'grow' }, s.subject_name || 'Без предмета',
          el('span', { class: 'small muted' }, ' · ',
            new Date(s.started_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))),
        el('span', { class: 'num small' }, `${s.duration_min} мин`),
        Bloom.confirmClick(
          el('button', { type: 'button', class: 'icon-btn delete', 'aria-label': 'Удалить сессию', title: 'Удалить' }, '✕'),
          async () => { await api(`pomodoro/${s.id}/`, { method: 'DELETE' }); loadSessions(); loadStats(); }))));
    } catch (error) { Bloom.failed(list, error); }
  }

  // ---------- start ------------------------------------------------------

  (async () => {
    try {
      subjects = await Bloom.fillSubjectSelect(subjectSelect);
    } catch (error) { toast(error.message, 'error'); }
    resetPhase();
    loadStats();
    loadSessions();
    if (new URLSearchParams(location.search).get('start') === '1') start();
  })();
})();
