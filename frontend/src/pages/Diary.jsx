/* Weekly reflection diary (/diary/): one entry per week (week starts on Monday) */
import { useEffect, useRef, useState } from 'react';
import { api, getAll } from '../api/client.js';
import { addDays, formValues, formatDate, iso, monday, pageTitle, parseDate, toast, today } from '../lib/bloom.js';
import { ConfirmButton, Empty, Failed, FormError, useBusy } from '../components/ui.jsx';

const MOODS = { 1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '🥰' };
const MOOD_TITLES = ['Очень грустно', 'Грустно', 'Нормально', 'Хорошо', 'Прекрасно'];

export default function Diary() {
  const formRef = useRef(null);
  const reflections = useRef([]);
  const [feed, setFeed] = useState(null);          // [] | {error}
  const [weekRange, setWeekRange] = useState('');
  const [hasEntry, setHasEntry] = useState(false);
  const { busy, error, setError, run } = useBusy();

  useEffect(() => { document.title = pageTitle('Дневник'); }, []);

  const current = () => reflections.current.find((r) => r.week_start === formRef.current.elements.week_start.value);

  /** Snap any chosen date to the Monday of its week and show the existing entry. */
  function selectWeek(value) {
    const form = formRef.current;
    const start = monday(value ? parseDate(value) : today());
    form.elements.week_start.value = iso(start);
    setWeekRange(`${formatDate(start)} — ${formatDate(addDays(start, 6))}`);

    const entry = current();
    form.querySelectorAll('input[name="mood"]').forEach((radio) => {
      radio.checked = entry ? Number(radio.value) === entry.mood : false;
    });
    form.elements.proud_of.value = entry ? entry.proud_of : '';
    form.elements.failed.value = entry ? entry.failed : '';
    form.elements.carry_over.value = entry ? entry.carry_over : '';
    setHasEntry(Boolean(entry));
    setError(null);
  }

  async function load(week) {
    try {
      reflections.current = await getAll('reflections/');
      setFeed(reflections.current);
    } catch (err) { setFeed({ error: err }); }
    selectWeek(week || formRef.current.elements.week_start.value || null);
  }

  useEffect(() => {
    load();
    const field = formRef.current.elements.week_start;
    const onChange = (event) => selectWeek(event.target.value);
    field.addEventListener('change', onChange);
    return () => field.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event) {
    event.preventDefault();
    const values = formValues(formRef.current);
    if (!values.mood) {
      setError(new Error('Выбери настроение недели.'));
      return;
    }
    const body = {
      week_start: values.week_start,
      mood: Number(values.mood),
      proud_of: values.proud_of || '',
      failed: values.failed || '',
      carry_over: values.carry_over || '',
    };
    const entry = current();
    run(async () => {
      if (entry) await api(`reflections/${entry.id}/`, { method: 'PATCH', body });
      else await api('reflections/', { method: 'POST', body });
      toast('Запись сохранена 💌');
      await load(body.week_start);
    });
  }

  let feedContent = null;
  if (feed?.error) feedContent = <Failed error={feed.error} />;
  else if (feed && !feed.length) feedContent = <Empty icon="💌">Здесь появятся твои рефлексии. Начни с этой недели!</Empty>;
  else if (feed) {
    feedContent = feed.map((r) => {
      const start = parseDate(r.week_start);
      const parts = [
        ['Чем горжусь', r.proud_of], ['Что не получилось', r.failed], ['Что переношу', r.carry_over],
      ].filter(([, text]) => text);
      return (
        <article key={r.id} className="diary-entry">
          <h3>
            <span>{`${formatDate(start)} — ${formatDate(addDays(start, 6))}`}</span>
            <span aria-label={`Настроение ${r.mood} из 5`}>{MOODS[r.mood]}</span>
          </h3>
          {parts.length
            ? <dl>{parts.map(([title, text]) => [<dt key={`t${title}`}>{title}</dt>, <dd key={`d${title}`}>{text}</dd>])}</dl>
            : <p className="muted">Без заметок.</p>}
          <div className="dialog-actions">
            <button type="button" className="btn ghost small"
              onClick={() => { selectWeek(r.week_start); formRef.current.scrollIntoView({ behavior: 'smooth' }); }}>Редактировать</button>
            <ConfirmButton className="btn ghost small"
              action={async () => { await api(`reflections/${r.id}/`, { method: 'DELETE' }); toast('Запись удалена'); load(); }}>Удалить</ConfirmButton>
          </div>
        </article>
      );
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>Diary 💌</h1>
        <p className="muted">Раз в неделю — честный разговор с собой.</p>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="reflection-title">
          <h2 id="reflection-title">Рефлексия недели</h2>
          <form id="reflection-form" noValidate ref={formRef} onSubmit={submit}>
            <div className="field">
              <label htmlFor="week-start">Неделя (с понедельника)</label>
              <input type="date" id="week-start" name="week_start" required />
              <span className="helptext" id="week-range">{weekRange}</span>
            </div>
            <fieldset className="mood-picker">
              <legend>Настроение</legend>
              {[1, 2, 3, 4, 5].map((n) => [
                <input key={`i${n}`} type="radio" name="mood" id={`mood-${n}`} value={n} />,
                <label key={`l${n}`} htmlFor={`mood-${n}`} title={MOOD_TITLES[n - 1]}>{MOODS[n]}</label>,
              ])}
            </fieldset>
            <div className="field">
              <label htmlFor="proud-of">Чем горжусь</label>
              <textarea id="proud-of" name="proud_of" rows="3"></textarea>
            </div>
            <div className="field">
              <label htmlFor="failed">Что не получилось</label>
              <textarea id="failed" name="failed" rows="3"></textarea>
            </div>
            <div className="field">
              <label htmlFor="carry-over">Что переношу на следующую неделю</label>
              <textarea id="carry-over" name="carry_over" rows="3"></textarea>
            </div>
            <FormError error={error} />
            <button type="submit" className="btn" id="reflection-submit" disabled={busy}>{hasEntry ? 'Обновить запись' : 'Сохранить'}</button>
          </form>
        </section>

        <section aria-labelledby="feed-title">
          <h2 id="feed-title">Прошлые недели</h2>
          <div className="grid" id="reflection-feed">{feedContent}</div>
        </section>
      </div>
    </>
  );
}
