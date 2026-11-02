/* Study (/study/): subjects, deadlines with countdown, weekly schedule */
import { useEffect, useRef, useState } from 'react';
import { api, getAll } from '../api/client.js';
import { KINDS, KINDS_GENITIVE, daysWord, formValues, formatDate, pageTitle, toast, today } from '../lib/bloom.js';
import { ConfirmButton, Empty, Failed, FormError, SubjectOptions, useBusy } from '../components/ui.jsx';

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

/**
 * A form that creates items, or edits one item after startEdit(item).
 * Used for subjects and deadlines.
 */
function useEditableForm({ endpoint, addLabel, toValues, fill, afterSave }) {
  const formRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const { busy, error, setError, run } = useBusy();

  function stopEdit() {
    setEditingId(null);
    formRef.current.reset();
    setError(null);
  }

  function onSubmit(event) {
    event.preventDefault();
    run(async () => {
      const body = toValues(formValues(formRef.current));
      if (editingId) await api(`${endpoint}${editingId}/`, { method: 'PATCH', body });
      else await api(endpoint, { method: 'POST', body });
      toast(editingId ? 'Сохранено 💗' : 'Добавлено 🌷');
      stopEdit();
      await afterSave();
    });
  }

  function startEdit(item) {
    setEditingId(item.id);
    fill(formRef.current.elements, item);
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    formRef.current.querySelector('input').focus();
  }

  return {
    formRef, onSubmit, startEdit, stopEdit, busy, error,
    submitLabel: editingId ? 'Сохранить' : addLabel,
    cancelHidden: !editingId,
  };
}

function DeleteButton({ label, url, after }) {
  return (
    <ConfirmButton className="icon-btn delete" aria-label={`Удалить: ${label}`} title="Удалить"
      action={async () => { await api(url, { method: 'DELETE' }); toast('Удалено'); await after(); }}>✕</ConfirmButton>
  );
}

function countdownText(d) {
  if (d.days_left < 0) return `прошло ${-d.days_left} ${daysWord(-d.days_left)} назад`;
  if (d.days_left === 0) return 'сегодня! 🌹';
  return `осталось ${d.days_left} ${daysWord(d.days_left)}`;
}

export default function Study() {
  const [subjects, setSubjects] = useState(null);         // null = not loaded yet
  const [subjectsError, setSubjectsError] = useState(null);
  const [deadlines, setDeadlines] = useState(null);       // {upcoming, all} | {error}
  const [slots, setSlots] = useState(null);               // [] | {error}
  const slotBusy = useBusy();
  const slotForm = useRef(null);

  useEffect(() => { document.title = pageTitle('Учёба'); }, []);

  async function loadDeadlines() {
    try {
      const [upcoming, all] = await Promise.all([api('deadlines/upcoming/'), getAll('deadlines/')]);
      setDeadlines({ upcoming, all });
    } catch (error) { setDeadlines((old) => ({ ...old, error })); }
  }

  async function loadSchedule() {
    try {
      setSlots(await getAll('schedule/'));
    } catch (error) { setSlots({ error }); }
  }

  async function loadAll() {
    try {
      setSubjects(await getAll('subjects/'));
      setSubjectsError(null);
    } catch (error) { setSubjectsError(error); }
    await Promise.all([loadDeadlines(), loadSchedule()]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subjectEditor = useEditableForm({
    endpoint: 'subjects/',
    addLabel: 'Добавить предмет',
    toValues: (v) => ({ name: v.name || '', color: v.color, teacher: v.teacher || '', room: v.room || '' }),
    fill: (fields, s) => {
      fields.name.value = s.name;
      fields.color.value = s.color;
      fields.teacher.value = s.teacher;
      fields.room.value = s.room;
    },
    afterSave: loadAll,
  });

  const deadlineEditor = useEditableForm({
    endpoint: 'deadlines/',
    addLabel: 'Добавить дедлайн',
    toValues: (v) => v,
    fill: (fields, d) => {
      fields.title.value = d.title;
      fields.kind.value = d.kind;
      fields.due_date.value = d.due_date;
      fields.subject.value = d.subject;
    },
    afterSave: loadDeadlines,
  });

  function addSlot(event) {
    event.preventDefault();
    slotBusy.run(async () => {
      await api('schedule/', { method: 'POST', body: formValues(slotForm.current) });
      toast('Пара добавлена 📚');
      await loadSchedule();
    });
  }

  // ---------- render pieces ----------------------------------------------

  let subjectList = null;
  if (subjectsError) subjectList = <Failed error={subjectsError} />;
  else if (subjects && !subjects.length) {
    subjectList = <Empty icon="📚">Добавь свои предметы — они понадобятся для задач, дедлайнов и помодоро.</Empty>;
  } else if (subjects) {
    subjectList = subjects.map((s) => (
      <li key={s.id}>
        <span className="swatch" style={{ '--dot': s.color }} />
        <div className="grow">
          <div>{s.name}</div>
          <div className="small muted">{[s.teacher, s.room && `каб. ${s.room}`].filter(Boolean).join(' · ')}</div>
        </div>
        <button type="button" className="icon-btn" aria-label={`Редактировать: ${s.name}`} onClick={() => subjectEditor.startEdit(s)}>✎</button>
        <DeleteButton label={s.name} url={`subjects/${s.id}/`} after={loadAll} />
      </li>
    ));
  }

  const subjectOptions = subjects && (
    <SubjectOptions subjects={subjects} emptyLabel={subjects.length ? 'Выбери предмет' : 'Сначала добавь предмет'} />
  );

  let deadlineList = null;
  if (deadlines?.error) deadlineList = <Failed error={deadlines.error} />;
  else if (deadlines && !deadlines.all.length) deadlineList = <Empty icon="🎈">Дедлайнов нет.</Empty>;
  else if (deadlines) {
    deadlineList = deadlines.all.map((d) => (
      <li key={d.id} style={d.days_left < 0 ? { opacity: '.5' } : undefined}>
        <span className="swatch" style={{ '--dot': d.subject_color }} />
        <div className="grow">
          <div>{d.title}</div>
          <div className="task-meta">
            <span className={'badge' + (d.kind === 'exam' ? ' high' : '')}>{KINDS[d.kind]}</span>
            <span className="badge">{d.subject_name}</span>
            <span className="small muted">{`${formatDate(d.due_date)} · ${countdownText(d)}`}</span>
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label={`Редактировать: ${d.title}`} onClick={() => deadlineEditor.startEdit(d)}>✎</button>
        <DeleteButton label={d.title} url={`deadlines/${d.id}/`} after={loadDeadlines} />
      </li>
    ));
  }

  let weekGrid = null;
  if (slots?.error) weekGrid = <Failed error={slots.error} />;
  else if (slots) {
    const todayIndex = (today().getDay() + 6) % 7;
    weekGrid = WEEKDAYS.map((name, weekday) => {
      const daySlots = slots.filter((s) => s.weekday === weekday);
      return (
        <div key={name} className={'week-day' + (weekday === todayIndex ? ' today' : '')}>
          <h3>{name}</h3>
          {daySlots.length ? daySlots.map((s) => (
            <div key={s.id} className="slot" style={{ '--dot': s.subject_color }}>
              <div className="grow">
                <div className="num small">{`${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`}</div>
                <div>{s.subject_name}</div>
                {s.subject_room && <div className="small muted">{`каб. ${s.subject_room}`}</div>}
              </div>
              <DeleteButton label={s.subject_name} url={`schedule/${s.id}/`} after={loadSchedule} />
            </div>
          )) : <p className="small muted" style={{ textAlign: 'center' }}>свободно 🌿</p>}
        </div>
      );
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>Study 📚</h1>
        <nav className="chips" aria-label="Разделы">
          <a className="chip" href="#subjects">Предметы</a>
          <a className="chip" href="#deadlines">Дедлайны</a>
          <a className="chip" href="#schedule">Расписание</a>
        </nav>
      </div>

      <div className="grid-2">
        <section className="card" id="subjects" aria-labelledby="subjects-title">
          <h2 id="subjects-title">Предметы</h2>
          <form id="subject-form" noValidate ref={subjectEditor.formRef} onSubmit={subjectEditor.onSubmit}>
            <div className="field-row">
              <div className="field" style={{ flex: '2 1 180px' }}>
                <label htmlFor="subject-name">Название</label>
                <input type="text" id="subject-name" name="name" maxLength="100" required />
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label htmlFor="subject-color">Цвет</label>
                <input type="color" id="subject-color" name="color" defaultValue="#FF0080" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="subject-teacher">Преподаватель</label>
                <input type="text" id="subject-teacher" name="teacher" maxLength="150" />
              </div>
              <div className="field">
                <label htmlFor="subject-room">Кабинет</label>
                <input type="text" id="subject-room" name="room" maxLength="50" />
              </div>
            </div>
            <FormError error={subjectEditor.error} />
            <div className="dialog-actions">
              <button type="button" className="btn ghost" data-cancel hidden={subjectEditor.cancelHidden} onClick={subjectEditor.stopEdit}>Отмена</button>
              <button type="submit" className="btn" disabled={subjectEditor.busy}>{subjectEditor.submitLabel}</button>
            </div>
          </form>
          <ul className="list" id="subject-list" style={{ marginTop: '8px' }}>{subjectList}</ul>
        </section>

        <section className="panel" id="deadlines" aria-labelledby="deadlines-title">
          <h2 id="deadlines-title">Дедлайны и экзамены ⏰</h2>
          <div id="upcoming" style={{ marginBottom: '10px' }}>
            {deadlines?.upcoming?.map((d) => (
              <p key={d.id} className="countdown" style={{ margin: '0 0 4px' }}>
                {`До ${KINDS_GENITIVE[d.kind]} по ${d.subject_name} `}
                {d.days_left === 0 ? 'сегодня! 🌹' : (
                  <>
                    {'осталось '}
                    <span className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{d.days_left}</span>
                    {` ${daysWord(d.days_left)} 🌷`}
                  </>
                )}
              </p>
            ))}
          </div>
          <form id="deadline-form" noValidate ref={deadlineEditor.formRef} onSubmit={deadlineEditor.onSubmit}>
            <div className="field">
              <label htmlFor="deadline-title">Что сдаём</label>
              <input type="text" id="deadline-title" name="title" maxLength="200" required />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="deadline-kind">Тип</label>
                <select id="deadline-kind" name="kind">
                  <option value="exam">Экзамен</option>
                  <option value="test">Зачёт</option>
                  <option value="coursework">Курсовая</option>
                  <option value="homework">ДЗ</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="deadline-date">Дата</label>
                <input type="date" id="deadline-date" name="due_date" required />
              </div>
              <div className="field">
                <label htmlFor="deadline-subject">Предмет</label>
                <select id="deadline-subject" name="subject" required>{subjectOptions}</select>
              </div>
            </div>
            <FormError error={deadlineEditor.error} />
            <div className="dialog-actions">
              <button type="button" className="btn ghost" data-cancel hidden={deadlineEditor.cancelHidden} onClick={deadlineEditor.stopEdit}>Отмена</button>
              <button type="submit" className="btn" disabled={deadlineEditor.busy}>{deadlineEditor.submitLabel}</button>
            </div>
          </form>
          <ul className="list" id="deadline-list" style={{ marginTop: '8px' }}>{deadlineList}</ul>
        </section>
      </div>

      <section className="panel" id="schedule" aria-labelledby="schedule-title" style={{ marginTop: '16px' }}>
        <h2 id="schedule-title">Расписание недели</h2>
        <form id="slot-form" className="field-row" noValidate style={{ alignItems: 'flex-end' }} ref={slotForm} onSubmit={addSlot}>
          <div className="field">
            <label htmlFor="slot-subject">Предмет</label>
            <select id="slot-subject" name="subject" required>{subjectOptions}</select>
          </div>
          <div className="field">
            <label htmlFor="slot-weekday">День</label>
            <select id="slot-weekday" name="weekday">
              {WEEKDAYS.map((name, i) => <option key={name} value={i}>{name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="slot-start">Начало</label>
            <input type="time" id="slot-start" name="start_time" defaultValue="09:00" required />
          </div>
          <div className="field">
            <label htmlFor="slot-end">Конец</label>
            <input type="time" id="slot-end" name="end_time" defaultValue="10:30" required />
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <button type="submit" className="btn" disabled={slotBusy.busy}>Добавить пару</button>
          </div>
          <p className="form-error" role="alert" style={{ flexBasis: '100%' }}>{slotBusy.error ? slotBusy.error.message : ''}</p>
        </form>
        <div className="scroll-x"><div className="week-grid" id="week-grid">{weekGrid}</div></div>
      </section>
    </>
  );
}
