/* Pomodoro (/focus/): timer, saving sessions, statistics by subject */
import { useEffect, useRef, useState } from 'react';
import 'chart.js/auto';
import { Doughnut } from 'react-chartjs-2';
import { api, getAll } from '../api/client.js';
import { minutesText, plural, toast } from '../lib/bloom.js';
import { ConfirmButton, Empty, Failed, SubjectOptions } from '../components/ui.jsx';

const CIRCLE = 2 * Math.PI * 52;       // circumference of the ring (r = 52)
const DEMO_SECONDS = 10;
const CHART_OPTIONS = {
  cutout: '62%',
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} ч` } },
  },
};

function clamp(n, min, max) { return Math.min(max, Math.max(min, Math.round(n))); }

function format(seconds) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  } catch {
    // sound is optional: some browsers block audio until the user interacts
  }
}

export default function Focus() {
  const settingsRef = useRef(null);
  const [subjects, setSubjects] = useState(null);
  // phase: 'work' | 'break'; the timer uses an end timestamp so it stays
  // correct even when the browser slows down background tabs
  const timer = useRef({ phase: 'work', total: 25 * 60, remaining: 25 * 60, endsAt: null, tick: null, startedAt: null });
  const [, redraw] = useState(0);
  const [startLabel, setStartLabel] = useState('Старт');
  const [running, setRunning] = useState(false);       // settings are disabled while running
  const [subjectId, setSubjectId] = useState('');      // shown under the time

  const [period, setPeriod] = useState('week');
  const periodRef = useRef('week');
  const [stats, setStats] = useState(null);             // {total, rows} | {error}
  const [chartData, setChartData] = useState(null);     // kept once created, like the old chart
  const [sessions, setSessions] = useState(null);       // [] | {error}

  const t = timer.current;
  const draw = () => redraw((n) => n + 1);

  // ---------- timer --------------------------------------------------------

  const isDemo = () => settingsRef.current.elements.demo.checked;
  const workMinutes = () => clamp(Number(settingsRef.current.elements.work.value) || 25, 1, 180);
  const breakMinutes = () => clamp(Number(settingsRef.current.elements.break.value) || 5, 1, 60);

  function phaseSeconds() {
    if (isDemo()) return DEMO_SECONDS;
    return (t.phase === 'work' ? workMinutes() : breakMinutes()) * 60;
  }

  function resetPhase() {
    t.total = phaseSeconds();
    t.remaining = t.total;
    setSubjectId(settingsRef.current.elements.subject.value);
    draw();
  }

  function start() {
    if (t.endsAt) return;
    if (t.phase === 'work' && t.remaining === t.total) t.startedAt = new Date();
    t.endsAt = Date.now() + t.remaining * 1000;
    t.tick = setInterval(update, 250);
    setStartLabel('Пауза');
    setRunning(true);
    draw();
  }

  function pause() {
    clearInterval(t.tick);
    t.endsAt = null;
    setStartLabel('Продолжить');
    draw();
  }

  function stop() {
    clearInterval(t.tick);
    t.endsAt = null;
    setStartLabel('Старт');
    setRunning(false);
  }

  function update() {
    t.remaining = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
    draw();
    if (t.remaining === 0) finishPhase();
  }

  async function finishPhase() {
    stop();
    beep();
    if (t.phase === 'work') {
      await saveSession();
      t.phase = 'break';
      toast('Помодоро завершён! Время отдохнуть 🍵');
    } else {
      t.phase = 'work';
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
          subject: settingsRef.current.elements.subject.value || null,
          duration_min: minutes,
          started_at: (t.startedAt || new Date()).toISOString(),
        },
      });
      loadStats();
      loadSessions();
    } catch (error) {
      toast('Сессию не удалось сохранить: ' + error.message, 'error');
    }
  }

  // ---------- statistics -------------------------------------------------

  async function loadStats() {
    const current = periodRef.current;
    try {
      const data = await api(`pomodoro/stats/?period=${current}`);
      setStats({ data, period: current });
      if (data.by_subject.length) setChartData(data.by_subject);
    } catch (error) { setStats((old) => ({ ...old, error })); }
  }

  async function loadSessions() {
    try {
      const data = await api('pomodoro/');   // newest first, first page only
      setSessions(data.results);
    } catch (error) { setSessions({ error }); }
  }

  function choosePeriod(value) {
    periodRef.current = value;
    setPeriod(value);
    loadStats();
  }

  // ---------- start ------------------------------------------------------

  useEffect(() => {
    document.title = 'Помодоро · Bloom 🌷';
    const state = timer.current;
    let cancelled = false;
    (async () => {
      try {
        const list = await getAll('subjects/');
        if (cancelled) return;
        setSubjects(list);
      } catch (error) { toast(error.message, 'error'); }
      if (cancelled) return;
      resetPhase();
      loadStats();
      loadSessions();
      if (new URLSearchParams(window.location.search).get('start') === '1') start();
    })();
    return () => { cancelled = true; clearInterval(state.tick); state.endsAt = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // native "change" (not React's per-keystroke onChange): number fields apply on blur/Enter, as before
  useEffect(() => {
    const form = settingsRef.current;
    const onChange = () => { if (!timer.current.endsAt) resetPhase(); };
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the tab title shows the countdown while the timer runs
  useEffect(() => {
    document.title = t.endsAt
      ? `${format(t.remaining)} · ${t.phase === 'work' ? 'Фокус' : 'Перерыв'} · Bloom`
      : 'Помодоро · Bloom 🌷';
  });

  // ---------- render -----------------------------------------------------

  const subject = (subjects || []).find((s) => String(s.id) === subjectId);

  let statsTotal = '';
  let statsList = null;
  let chartHidden = false;
  if (stats?.error) statsList = <Failed error={stats.error} />;
  if (stats?.data) {
    const { data } = stats;
    statsTotal = `${stats.period === 'week' ? 'За неделю' : 'За месяц'}: ${minutesText(data.total_minutes)} · ` +
      `${data.sessions} ${plural(data.sessions, ['сессия', 'сессии', 'сессий'])}`;
    chartHidden = !data.by_subject.length;
    if (!stats.error) {
      statsList = data.by_subject.length
        ? data.by_subject.map((row) => (
          <li key={`${row.subject}-${row.name}`}>
            <span className="swatch" style={{ '--dot': row.color }} />
            <span className="grow">{row.name}</span>
            <span className="num">{minutesText(row.minutes)}</span>
          </li>
        ))
        : <Empty icon="🍅">Пока нет сессий за этот период. Запусти таймер!</Empty>;
    }
  }

  let sessionList = null;
  if (sessions?.error) sessionList = <Failed error={sessions.error} />;
  else if (sessions && !sessions.length) sessionList = <Empty icon="⏳">Сессий ещё не было.</Empty>;
  else if (sessions) {
    sessionList = sessions.slice(0, 8).map((s) => (
      <li key={s.id}>
        <span className="swatch" style={{ '--dot': s.subject_color || 'var(--soft-pink)' }} />
        <span className="grow">{s.subject_name || 'Без предмета'}
          <span className="small muted">{' · '}
            {new Date(s.started_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
        <span className="num small">{`${s.duration_min} мин`}</span>
        <ConfirmButton className="icon-btn delete" aria-label="Удалить сессию" title="Удалить"
          action={async () => { await api(`pomodoro/${s.id}/`, { method: 'DELETE' }); loadSessions(); loadStats(); }}>✕</ConfirmButton>
      </li>
    ));
  }

  const chart = chartData && {
    labels: chartData.map((r) => r.name),
    datasets: [{
      data: chartData.map((r) => +(r.minutes / 60).toFixed(2)),
      backgroundColor: chartData.map((r) => r.color), borderWidth: 2, borderColor: '#fff',
    }],
  };

  return (
    <>
      <div className="page-head">
        <h1>Focus ⏳</h1>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="timer-title">
          <h2 id="timer-title" className="visually-hidden">Таймер</h2>
          <div className="chips" role="group" aria-label="Режим" style={{ justifyContent: 'center', marginBottom: '12px' }}>
            <span className="chip" id="phase-label" aria-live="polite">{t.phase === 'work' ? 'Работа 🍅' : 'Перерыв 🍵'}</span>
          </div>
          <div className={'timer-ring' + (t.phase === 'break' ? ' break' : '')} id="timer-ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="track" cx="60" cy="60" r="52" fill="none" strokeWidth="10"></circle>
              <circle className="bar" id="timer-bar" cx="60" cy="60" r="52" fill="none" strokeWidth="10"
                strokeDasharray="326.73" strokeDashoffset="0"
                style={{ strokeDashoffset: String(CIRCLE * (1 - t.remaining / t.total)) }}></circle>
            </svg>
            <div className="time">
              <strong id="timer-time" role="timer" aria-live="off">{format(t.remaining)}</strong>
              <span className="muted small" id="timer-subject">{subject ? subject.name : 'без предмета'}</span>
            </div>
          </div>
          <div className="timer-controls">
            <button type="button" className="btn big" id="timer-start" onClick={() => (t.endsAt ? pause() : start())}>{startLabel}</button>
            <button type="button" className="btn ghost" id="timer-reset" onClick={() => { stop(); resetPhase(); }}>Сброс</button>
            <button type="button" className="btn ghost" id="timer-skip" onClick={() => {
              stop();
              t.phase = t.phase === 'work' ? 'break' : 'work';
              resetPhase();
            }}>Пропустить</button>
          </div>

          <form id="timer-settings" style={{ marginTop: '18px' }} noValidate ref={settingsRef}>
            <div className="field">
              <label htmlFor="timer-subject-select">Предмет</label>
              <select id="timer-subject-select" name="subject" disabled={running}>
                {subjects && <SubjectOptions subjects={subjects} />}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="work-min">Работа, мин</label>
                <input type="number" id="work-min" name="work" min="1" max="180" defaultValue="25" disabled={running} />
              </div>
              <div className="field">
                <label htmlFor="break-min">Перерыв, мин</label>
                <input type="number" id="break-min" name="break" min="1" max="60" defaultValue="5" disabled={running} />
              </div>
            </div>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text)' }}>
              <input type="checkbox" id="demo-mode" name="demo" style={{ width: 'auto', minHeight: 0 }} disabled={running} />
              Демо-режим: 10 секунд (сохраняется как 1 минута)
            </label>
          </form>
        </section>

        <section className="panel" aria-labelledby="stats-title">
          <div className="panel-head">
            <h2 id="stats-title">Статистика</h2>
            <div className="chips" role="group" aria-label="Период">
              <button type="button" className="chip" data-period="week" aria-pressed={String(period === 'week')} onClick={() => choosePeriod('week')}>Неделя</button>
              <button type="button" className="chip" data-period="month" aria-pressed={String(period === 'month')} onClick={() => choosePeriod('month')}>Месяц</button>
            </div>
          </div>
          <p className="muted" id="stats-total">{statsTotal}</p>
          <div style={{ position: 'relative', maxWidth: '300px', margin: '0 auto' }} id="chart-wrap" hidden={chartHidden}>
            {chart
              ? <Doughnut id="stats-chart" aria-label="Минуты по предметам" role="img" data={chart} options={CHART_OPTIONS} />
              : <canvas id="stats-chart" aria-label="Минуты по предметам" role="img"></canvas>}
          </div>
          <ul className="list" id="stats-list" style={{ marginTop: '10px' }}>{statsList}</ul>

          <h3 style={{ marginTop: '18px' }}>Последние сессии</h3>
          <ul className="list" id="session-list">{sessionList}</ul>
        </section>
      </div>
    </>
  );
}
