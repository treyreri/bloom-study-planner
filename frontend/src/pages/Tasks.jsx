/* To-do List page (/tasks/) */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getAll } from '../api/client.js';
import {
  addDays, celebrateIfAllDone, formValues, iso, monday, pageTitle, toast, today,
} from '../lib/bloom.js';
import { Empty, Failed, FormError, Loading, SubjectOptions } from '../components/ui.jsx';
import { PriorityOptions, TaskDialog, TaskItem, useQuickAdd } from '../components/tasks.jsx';

const VIEWS = [['today', 'tasks.viewToday'], ['week', 'tasks.viewWeek'], ['overdue', 'tasks.viewOverdue'], ['all', 'tasks.viewAll']];

export default function Tasks() {
  const { t } = useTranslation();
  const [view, setView] = useState('today');
  const [subjects, setSubjects] = useState(null);   // null = not loaded yet (empty <select>)
  // list.state: 'loading' | 'ready' | 'error'
  const [list, setList] = useState({ state: 'loading', tasks: [], count: null, next: null, round: 0 });
  const viewRef = useRef(view);
  const shownTasks = useRef([]);
  const nextUrl = useRef(null);
  const filtersRef = useRef(null);
  const addRef = useRef(null);
  const dialog = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => { document.title = pageTitle(t('tasks.pageTitle')); }, [t]);

  function query() {
    const params = new URLSearchParams();
    const day = today();
    const current = viewRef.current;
    if (current === 'today') params.set('date', iso(day));
    if (current === 'week') {
      const start = monday(day);
      params.set('date_from', iso(start));
      params.set('date_to', iso(addDays(start, 6)));
    }
    if (current === 'overdue') params.set('overdue', 'true');
    const values = formValues(filtersRef.current);
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    return 'tasks/?' + params.toString();
  }

  async function load(append = false) {
    if (!append) {
      shownTasks.current = [];
      setList((old) => ({ ...old, state: 'loading', tasks: [], next: null }));
    } else {
      setList((old) => ({ ...old, next: null }));   // the "show more" button hides while loading
    }
    try {
      const data = await api(append ? nextUrl.current : query());
      shownTasks.current.push(...data.results);
      nextUrl.current = data.next ? new URL(data.next).pathname + new URL(data.next).search : null;
      setList((old) => ({
        state: 'ready',
        tasks: [...shownTasks.current],
        count: data.count,
        next: nextUrl.current,
        round: append ? old.round : old.round + 1,
      }));
    } catch (error) {
      setList((old) => ({ ...old, state: 'error', error }));
    }
  }

  function onChange(kind) {
    if (kind === 'toggled' && viewRef.current === 'today') celebrateIfAllDone(shownTasks.current);
    if (kind === 'moved' || kind === 'updated' || kind === 'deleted') load();
  }

  function chooseView(value) {
    viewRef.current = value;
    setView(value);
    load();
  }

  function onFiltersInput() {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(), 300);
  }

  const quickAdd = useQuickAdd({ onCreated: () => { toast(t('tasks.added')); load(); } });

  useEffect(() => {
    addRef.current.elements.date.value = iso(today());
    (async () => {
      try {
        setSubjects(await getAll('subjects/'));
      } catch (error) { toast(error.message, 'error'); }
      load();
    })();
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let content;
  if (list.state === 'loading') content = <Loading />;
  else if (list.state === 'error') content = <Failed error={list.error} />;
  else if (!list.count) {
    content = view === 'overdue'
      ? <Empty icon="🎉">{t('tasks.noOverdue')}</Empty>
      : <Empty icon="🌱">{t('tasks.empty')}</Empty>;
  } else {
    content = list.tasks.map((task) => (
      <TaskItem key={`${list.round}-${task.id}`} task={task} isDone={task.is_done} onChange={onChange}
        onEdit={(t, cb) => dialog.current.open(t, cb)} />
    ));
  }

  return (
    <>
      <div id="tasks-page">
        <div className="page-head">
          <h1>To-do List 🌷</h1>
          <p className="muted" id="tasks-summary" aria-live="polite">
            {list.count === null ? '' : t('tasks.count', { count: list.count })}
          </p>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <section className="card" aria-labelledby="add-title">
            <h2 id="add-title" className="visually-hidden">{t('tasks.newTask')}</h2>
            <form id="task-add" noValidate ref={addRef} onSubmit={quickAdd.onSubmit}>
              <div className="capsule">
                <label htmlFor="add-title-input" className="visually-hidden">{t('tasks.taskTitle')}</label>
                <input type="text" id="add-title-input" name="title" maxLength="200" placeholder={t('tasks.placeholder')} autoComplete="off" />
                <button type="submit" className="btn" disabled={quickAdd.busy}>{t('tasks.add')}</button>
              </div>
              <div className="field-row" style={{ marginTop: '10px' }}>
                <div className="field">
                  <label htmlFor="add-date">{t('common.date')}</label>
                  <input type="date" id="add-date" name="date" />
                </div>
                <div className="field">
                  <label htmlFor="add-priority">{t('common.priority')}</label>
                  <select id="add-priority" name="priority" defaultValue="mid"><PriorityOptions /></select>
                </div>
                <div className="field">
                  <label htmlFor="add-subject">{t('common.subject')}</label>
                  <select id="add-subject" name="subject">{subjects && <SubjectOptions subjects={subjects} />}</select>
                </div>
              </div>
              <FormError error={quickAdd.error} />
            </form>

            <div className="chips" role="group" aria-label={t('tasks.whichTasks')} style={{ margin: '6px 0 10px' }}>
              {VIEWS.map(([value, label]) => (
                <button key={value} type="button" className="chip" data-view={value}
                  aria-pressed={String(view === value)} onClick={() => chooseView(value)}>{t(label)}</button>
              ))}
            </div>

            <form id="task-filters" className="field-row" role="search" ref={filtersRef}
              onInput={onFiltersInput} onSubmit={(event) => { event.preventDefault(); load(); }}>
              <div className="field">
                <label htmlFor="filter-search">{t('tasks.search')}</label>
                <input type="search" id="filter-search" name="search" placeholder={t('tasks.searchPlaceholder')} />
              </div>
              <div className="field">
                <label htmlFor="filter-subject">{t('common.subject')}</label>
                <select id="filter-subject" name="subject">
                  {subjects && <SubjectOptions subjects={subjects} emptyLabel={t('tasks.allSubjects')} />}
                </select>
              </div>
              <div className="field">
                <label htmlFor="filter-priority">{t('common.priority')}</label>
                <select id="filter-priority" name="priority">
                  <option value="">{t('tasks.anyPriority')}</option>
                  <PriorityOptions />
                </select>
              </div>
              <div className="field">
                <label htmlFor="filter-ordering">{t('tasks.ordering')}</label>
                <select id="filter-ordering" name="ordering">
                  <option value="">{t('tasks.byDate')}</option>
                  <option value="-priority">{t('tasks.importantFirst')}</option>
                  <option value="-date">{t('tasks.latestFirst')}</option>
                </select>
              </div>
            </form>

            <ul className="task-list" id="task-list" aria-live="polite">{content}</ul>
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button type="button" className="btn secondary" id="load-more" hidden={!list.next}
                onClick={() => load(true)}>{t('tasks.more')}</button>
            </div>
          </section>
        </div>
      </div>
      <TaskDialog ref={dialog} />
    </>
  );
}
