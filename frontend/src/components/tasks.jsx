/* ==========================================================================
   Tasks: shared task components (used on Today, Month and Tasks pages).
   Ported 1:1 from the former vanilla-JS tasks code (same markup).
   ========================================================================== */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getAll } from '../api/client.js';
import { PRIORITY_EMOJI, formValues, formatDate, iso, priorityText, toast, today } from '../lib/bloom.js';
import { FormError, HeartButton, SubjectOptions, useBusy } from './ui.jsx';

/**
 * One task row: heart checkbox, title, date/subject/priority, "→ завтра", ✕.
 * onChange(kind, task) is called after every successful change:
 * kind is 'toggled', 'updated', 'moved' or 'deleted'.
 * The task object is updated in place, as the old code did.
 * isDone is the state when the parent last drew the list: like before, the
 * "→" button only disappears when the list is redrawn (Today and Month redraw
 * after every change, the Tasks page only after reloading).
 */
export function TaskItem({ task, isDone, onChange = () => {}, onEdit, showDate = true }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(task.is_done);
  const [removed, setRemoved] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (removed) return null;

  const priorityLabel = t(`priority.${task.priority}`);
  const edit = () => onEdit(task, onChange);

  async function move() {
    setMoving(true);
    try {
      const moved = await api(`tasks/${task.id}/move-tomorrow/`, { method: 'POST' });
      Object.assign(task, moved);
      toast(t('tasks.moved', { date: formatDate(task.date) }));
      onChange('moved', task);
    } catch (error) {
      toast(error.message, 'error');
      setMoving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`tasks/${task.id}/`, { method: 'DELETE' });
      setRemoved(true);
      onChange('deleted', task);
    } catch (error) {
      toast(error.message, 'error');
      setDeleting(false);
    }
  }

  return (
    <li className={'task' + (done ? ' done' : '')} data-id={task.id}>
      <HeartButton
        checked={task.is_done}
        label={t('tasks.done', { title: task.title })}
        onToggle={async () => {
          const updated = await api(`tasks/${task.id}/toggle/`, { method: 'POST' });
          Object.assign(task, updated);
          setDone(task.is_done);
          onChange('toggled', task);
        }}
      />
      <div
        className="task-body" tabIndex="0" role="button" aria-label={t('tasks.edit', { title: task.title })}
        onClick={edit} onKeyDown={(event) => { if (event.key === 'Enter') edit(); }}
      >
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {showDate && <span className="badge">{formatDate(task.date, { day: 'numeric', month: 'short' })}</span>}
          {task.subject_name && (
            <span className="badge dot" style={{ '--dot': task.subject_color }}>{task.subject_name}</span>
          )}
          <span className={'badge' + (task.priority === 'high' ? ' high' : '')} title={t('priority.title', { label: priorityLabel })}>
            {PRIORITY_EMOJI[task.priority]} {priorityLabel}
          </span>
        </div>
      </div>
      <div className="actions">
        {!isDone && (
          <button
            type="button" className="icon-btn" title={t('tasks.moveTomorrow')}
            aria-label={t('tasks.moveTomorrowItem', { title: task.title })} disabled={moving} onClick={move}
          >→</button>
        )}
        <button
          type="button" className="icon-btn delete" title={t('common.delete')} aria-label={t('common.deleteItem', { name: task.title })}
          disabled={deleting} onClick={remove}
        >✕</button>
      </div>
    </li>
  );
}

/**
 * Edit-task window (the old _task_dialog.html).
 * Use: const dialog = useRef(); <TaskDialog ref={dialog} />; dialog.current.open(task, onChange)
 * Subjects are loaded once per page, like the old per-page cache.
 */
export const TaskDialog = forwardRef(function TaskDialog(_props, ref) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const subjectsCache = useRef(null);
  const [subjects, setSubjects] = useState([]);
  const [target, setTarget] = useState(null);   // {task, onChange, round}
  const { busy, error, setError, run } = useBusy();

  useImperativeHandle(ref, () => ({
    async open(task, onChange = () => {}) {
      if (!subjectsCache.current) subjectsCache.current = await getAll('subjects/');
      setSubjects(subjectsCache.current);
      setError(null);
      setTarget((old) => ({ task, onChange, round: (old?.round || 0) + 1 }));
    },
    subjects: async () => {
      if (!subjectsCache.current) subjectsCache.current = await getAll('subjects/');
      return subjectsCache.current;
    },
  }));

  // fill the fields after the subject options have been rendered, then open
  useEffect(() => {
    if (!target) return;
    const form = formRef.current;
    const { task } = target;
    form.elements.title.value = task.title;
    form.elements.description.value = task.description || '';
    form.elements.date.value = task.date;
    form.elements.priority.value = task.priority;
    form.elements.subject.value = task.subject || '';
    dialogRef.current.showModal();
    form.elements.title.focus();
  }, [target]);

  function submit(event) {
    event.preventDefault();
    const { task, onChange } = target;
    run(async () => {
      const values = formValues(formRef.current);
      values.description = values.description || '';
      const updated = await api(`tasks/${task.id}/`, { method: 'PATCH', body: values });
      Object.assign(task, updated);
      dialogRef.current.close();
      toast(t('common.saved'));
      onChange('updated', task);
    });
  }

  return (
    <dialog id="task-dialog" aria-labelledby="task-dialog-title" ref={dialogRef}>
      <form id="task-edit-form" noValidate ref={formRef} onSubmit={submit}>
        <h2 id="task-dialog-title">{t('tasks.dialogTitle')}</h2>
        <div className="field">
          <label htmlFor="edit-title">{t('common.title')}</label>
          <input type="text" id="edit-title" name="title" maxLength="200" required />
        </div>
        <div className="field">
          <label htmlFor="edit-description">{t('tasks.description')}</label>
          <textarea id="edit-description" name="description" rows="3"></textarea>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="edit-date">{t('common.date')}</label>
            <input type="date" id="edit-date" name="date" required />
          </div>
          <div className="field">
            <label htmlFor="edit-priority">{t('common.priority')}</label>
            <select id="edit-priority" name="priority"><PriorityOptions /></select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-subject">{t('common.subject')}</label>
          <select id="edit-subject" name="subject"><SubjectOptions subjects={subjects} /></select>
        </div>
        <FormError error={error} />
        <div className="dialog-actions">
          <button type="button" className="btn ghost" data-close onClick={() => dialogRef.current.close()}>{t('common.cancel')}</button>
          <button type="submit" className="btn" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </dialog>
  );
});

/** <option>s 🌸 низкий / 🌷 средний / 🌹 высокий */
export function PriorityOptions() {
  useTranslation();   // re-render on language change
  return ['low', 'mid', 'high'].map((p) => <option key={p} value={p}>{priorityText(p)}</option>);
}

/**
 * Quick add: a form with a "title" input (and optional date/priority/subject).
 * defaults() returns extra fields, e.g. {date: '2026-11-02'}.
 */
export function useQuickAdd({ defaults = () => ({}), onCreated = () => {} }) {
  const busy = useBusy();
  function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = { ...defaults(), ...formValues(form) };
    if (!values.title || !values.title.trim()) {
      form.elements.title.focus();
      return;
    }
    if (!values.date) values.date = iso(today());
    busy.run(async () => {
      const task = await api('tasks/', { method: 'POST', body: values });
      form.elements.title.value = '';
      form.elements.title.focus();
      onCreated(task);
    });
  }
  return { onSubmit, busy: busy.busy, error: busy.error };
}
