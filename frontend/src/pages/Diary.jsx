/* Weekly reflection diary (/diary/): one entry per week (week starts on Monday) */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n.js';
import { api, getAll } from '../api/client.js';
import { addDays, formValues, formatDate, iso, monday, pageTitle, parseDate, toast, today } from '../lib/bloom.js';
import { ConfirmButton, Empty, Failed, FormError, useBusy } from '../components/ui.jsx';

const MOODS = { 1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '🥰' };

export default function Diary() {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const reflections = useRef([]);
  const [feed, setFeed] = useState(null);          // [] | {error}
  const [weekStart, setWeekStart] = useState(null);   // Monday of the chosen week (Date)
  const [hasEntry, setHasEntry] = useState(false);
  const { busy, error, setError, run } = useBusy();

  useEffect(() => { document.title = pageTitle(t('diary.title')); }, [t]);

  const current = () => reflections.current.find((r) => r.week_start === formRef.current.elements.week_start.value);

  /** Snap any chosen date to the Monday of its week and show the existing entry. */
  function selectWeek(value) {
    const form = formRef.current;
    const start = monday(value ? parseDate(value) : today());
    form.elements.week_start.value = iso(start);
    setWeekStart(start);

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
      setError(new Error(i18n.t('diary.chooseMood')));
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
      toast(i18n.t('diary.saved'));
      await load(body.week_start);
    });
  }

  let feedContent = null;
  if (feed?.error) feedContent = <Failed error={feed.error} />;
  else if (feed && !feed.length) feedContent = <Empty icon="💌">{t('diary.empty')}</Empty>;
  else if (feed) {
    feedContent = feed.map((r) => {
      const start = parseDate(r.week_start);
      const parts = [
        [t('diary.proud'), r.proud_of], [t('diary.failed'), r.failed], [t('diary.carry'), r.carry_over],
      ].filter(([, text]) => text);
      return (
        <article key={r.id} className="diary-entry">
          <h3>
            <span>{`${formatDate(start)} — ${formatDate(addDays(start, 6))}`}</span>
            <span aria-label={t('diary.moodOf', { n: r.mood })}>{MOODS[r.mood]}</span>
          </h3>
          {parts.length
            ? <dl>{parts.map(([title, text]) => [<dt key={`t${title}`}>{title}</dt>, <dd key={`d${title}`}>{text}</dd>])}</dl>
            : <p className="muted">{t('diary.noNotes')}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn ghost small"
              onClick={() => { selectWeek(r.week_start); formRef.current.scrollIntoView({ behavior: 'smooth' }); }}>{t('diary.edit')}</button>
            <ConfirmButton className="btn ghost small"
              action={async () => { await api(`reflections/${r.id}/`, { method: 'DELETE' }); toast(t('diary.deleted')); load(); }}>{t('common.delete')}</ConfirmButton>
          </div>
        </article>
      );
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>Diary 💌</h1>
        <p className="muted">{t('diary.subtitle')}</p>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="reflection-title">
          <h2 id="reflection-title">{t('diary.reflection')}</h2>
          <form id="reflection-form" noValidate ref={formRef} onSubmit={submit}>
            <div className="field">
              <label htmlFor="week-start">{t('diary.week')}</label>
              <input type="date" id="week-start" name="week_start" required />
              <span className="helptext" id="week-range">{weekStart ? `${formatDate(weekStart)} — ${formatDate(addDays(weekStart, 6))}` : ''}</span>
            </div>
            <fieldset className="mood-picker">
              <legend>{t('diary.mood')}</legend>
              {[1, 2, 3, 4, 5].map((n) => [
                <input key={`i${n}`} type="radio" name="mood" id={`mood-${n}`} value={n} />,
                <label key={`l${n}`} htmlFor={`mood-${n}`} title={t('diary.moods', { returnObjects: true })[n - 1]}>{MOODS[n]}</label>,
              ])}
            </fieldset>
            <div className="field">
              <label htmlFor="proud-of">{t('diary.proud')}</label>
              <textarea id="proud-of" name="proud_of" rows="3"></textarea>
            </div>
            <div className="field">
              <label htmlFor="failed">{t('diary.failed')}</label>
              <textarea id="failed" name="failed" rows="3"></textarea>
            </div>
            <div className="field">
              <label htmlFor="carry-over">{t('diary.carryLabel')}</label>
              <textarea id="carry-over" name="carry_over" rows="3"></textarea>
            </div>
            <FormError error={error} />
            <button type="submit" className="btn" id="reflection-submit" disabled={busy}>{hasEntry ? t('diary.update') : t('common.save')}</button>
          </form>
        </section>

        <section aria-labelledby="feed-title">
          <h2 id="feed-title">{t('diary.feed')}</h2>
          <div className="grid" id="reflection-feed">{feedContent}</div>
        </section>
      </div>
    </>
  );
}
