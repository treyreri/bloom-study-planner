/* Habit tracker (/habits/): month grid of heart checkboxes + streaks */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { formValues, formatDate, iso, monthName, pageTitle, toast, today } from '../lib/bloom.js';
import { ConfirmButton, Empty, Failed, FormError, HeartButton, Loading, useBusy } from '../components/ui.jsx';

function HabitRow({ habit, days, todayIso, reload }) {
  const { t } = useTranslation();
  const [streak, setStreak] = useState(habit.streak);
  const checked = new Set(habit.checked_dates);

  async function toggleActive() {
    try {
      await api(`habits/${habit.id}/`, { method: 'PATCH', body: { is_active: !habit.is_active } });
      reload();
    } catch (error) { toast(error.message, 'error'); }
  }

  return (
    <tr className={habit.is_active ? '' : 'inactive'}>
      <th className="name" scope="row">
        <div>{habit.emoji} {habit.title}</div>
        <div className="streak small">{streak ? t('habits.streak', { count: streak }) : ''}</div>
      </th>
      {days.map((d) => (
        <td key={d}>
          <HeartButton
            checked={checked.has(d)}
            disabled={d > todayIso}
            label={`${habit.title}, ${formatDate(d)}`}
            onToggle={async () => {
              const result = await api(`habits/${habit.id}/check/`, { method: 'POST', body: { date: d } });
              setStreak(result.streak);
            }}
          />
        </td>
      ))}
      <td style={{ whiteSpace: 'nowrap' }}>
        <button
          type="button" className="icon-btn small"
          title={t(habit.is_active ? 'habits.archive' : 'habits.unarchive')}
          aria-label={`${t(habit.is_active ? 'habits.archive' : 'habits.unarchiveShort')}: ${habit.title}`}
          onClick={toggleActive}
        >{habit.is_active ? '🗄' : '↺'}</button>
        <ConfirmButton className="icon-btn delete" title={t('common.delete')} aria-label={t('common.deleteItem', { name: habit.title })}
          action={async () => { await api(`habits/${habit.id}/`, { method: 'DELETE' }); toast(t('habits.deleted')); reload(); }}>✕</ConfirmButton>
      </td>
    </tr>
  );
}

export default function Habits() {
  const { t } = useTranslation();
  const start = today();
  const ym = useRef({ year: start.getFullYear(), month: start.getMonth() + 1 });
  const [label, setLabel] = useState(null);   // {year, month} shown in the header
  const [grid, setGrid] = useState({ state: 'loading', round: 0 });
  const boxRef = useRef(null);
  const { busy, error, run } = useBusy();

  useEffect(() => { document.title = pageTitle(t('habits.title')); }, [t]);

  async function load() {
    const { year, month } = ym.current;
    setLabel({ year, month });
    setGrid((old) => ({ ...old, state: 'loading' }));
    try {
      const data = await api(`habits/grid/?year=${year}&month=${month}`);
      setGrid((old) => ({ state: 'ready', data, round: old.round + 1 }));
    } catch (err) { setGrid((old) => ({ ...old, state: 'error', error: err })); }
  }

  useEffect(() => {
    load();
  }, []);

  // like before: after drawing the table, scroll today's column into view
  useEffect(() => {
    if (grid.state !== 'ready') return;
    const todayHeader = boxRef.current.querySelector('.today-col');
    if (todayHeader) todayHeader.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [grid]);

  function addHabit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formValues(form);
    if (!values.title) { form.elements.title.focus(); return; }
    run(async () => {
      await api('habits/', { method: 'POST', body: values });
      form.elements.title.value = '';
      toast(t('habits.added'));
      load();
    });
  }

  function shift(delta) {
    let { year, month } = ym.current;
    month += delta;
    if (month === 0) { month = 12; year -= 1; }
    if (month === 13) { month = 1; year += 1; }
    ym.current = { year, month };
    load();
  }

  let content;
  if (grid.state === 'loading') content = <Loading />;
  else if (grid.state === 'error') content = <Failed error={grid.error} />;
  else if (!grid.data.habits.length) {
    content = <Empty icon="✨">{t('habits.empty')}</Empty>;
  } else {
    const { data } = grid;
    const todayIso = iso(today());
    const days = Array.from({ length: data.days_in_month }, (_, i) => iso(new Date(data.year, data.month - 1, i + 1)));
    content = (
      <table className="habit-grid">
        <thead>
          <tr>
            <th className="name" scope="col">{t('habits.habit')}</th>
            {days.map((d, i) => <th key={d} scope="col" className={d === todayIso ? 'today-col' : ''}>{i + 1}</th>)}
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {data.habits.map((habit) => (
            <HabitRow key={`${grid.round}-${habit.id}`} habit={habit} days={days} todayIso={todayIso} reload={load} />
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Habits ✨</h1>
        <div className="chips" role="group" aria-label={t('common.monthPick')}>
          <button type="button" className="chip" id="prev-month" aria-label={t('common.prevMonth')} onClick={() => shift(-1)}>←</button>
          <strong id="month-label" aria-live="polite" style={{ minWidth: '9em', textAlign: 'center', alignSelf: 'center' }}>{label ? `${monthName(label.month)} ${label.year}` : ''}</strong>
          <button type="button" className="chip" id="next-month" aria-label={t('common.nextMonth')} onClick={() => shift(1)}>→</button>
        </div>
      </div>

      <section className="card" aria-labelledby="new-habit-title">
        <h2 id="new-habit-title" className="visually-hidden">{t('habits.newHabit')}</h2>
        <form id="habit-form" noValidate onSubmit={addHabit}>
          <div className="capsule">
            <label htmlFor="habit-emoji" className="visually-hidden">{t('habits.emoji')}</label>
            <select id="habit-emoji" name="emoji" style={{ flex: '0 0 auto', width: 'auto', border: 0, background: 'transparent', borderRadius: '999px' }}>
              <option>🌷</option><option>💧</option><option>🏃‍♀️</option><option>📖</option>
              <option>🇫🇷</option><option>🧘‍♀️</option><option>🍎</option><option>😴</option><option>✍️</option>
            </select>
            <label htmlFor="habit-title" className="visually-hidden">{t('habits.habitTitle')}</label>
            <input type="text" id="habit-title" name="title" maxLength="150" placeholder={t('habits.placeholder')} autoComplete="off" />
            <button type="submit" className="btn" disabled={busy}>{t('habits.add')}</button>
          </div>
          <FormError error={error} />
        </form>
      </section>

      <section className="panel" aria-labelledby="grid-title" style={{ marginTop: '16px' }}>
        <h2 id="grid-title" className="visually-hidden">{t('habits.grid')}</h2>
        <div className="scroll-x" id="habit-grid" ref={boxRef}>{content}</div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>{t('habits.hint')}</p>
      </section>
    </>
  );
}
