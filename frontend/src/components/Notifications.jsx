/*
  Notification bell on the Today page (GET /api/v1/notifications/):
  upcoming and overdue deadlines, overdue tasks and today's open tasks.
  Reloads when tasks/deadlines change (DATA_CHANGED) and when the window gets focus.
  A deadline within WARN_DAYS also shows a gentle toast, once per day.
*/
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuth } from '../auth.jsx';
import { DATA_CHANGED, PRIORITY_EMOJI, formatDate, toast } from '../lib/bloom.js';
import { Empty } from './ui.jsx';

const WARN_DAYS = 3;
const WARNED_KEY = 'bloom.deadlineWarning.';   // + username -> date of the last warning

function warningText(deadline, t) {
  const params = { subject: deadline.subject_name };
  if (deadline.days_left === 0) {
    return t('notifications.warnToday', { ...params, kind: t(`kinds.${deadline.kind}`) });
  }
  return t('notifications.warn', {
    ...params, kind: t(`kindsGenitive.${deadline.kind}`), count: deadline.days_left,
  });
}

function DeadlineItem({ deadline, overdue, onPick }) {
  const { t } = useTranslation();
  let when;
  if (overdue) when = t('notifications.overdueBy', { count: -deadline.days_left });
  else if (deadline.days_left === 0) when = t('notifications.dueToday');
  else when = t('notifications.daysLeft', { count: deadline.days_left });
  const soon = !overdue && deadline.days_left <= WARN_DAYS;
  return (
    <li className={'notif-item' + (overdue ? ' overdue' : '') + (soon ? ' soon' : '')}>
      <Link to="/study/#deadlines" onClick={onPick}>
        <span className="swatch" style={{ '--dot': deadline.subject_color }} />
        <span className="grow">
          <span className="notif-title">{deadline.title}</span>
          <span className="task-meta">
            <span className={'badge' + (deadline.kind === 'exam' ? ' high' : '')}>{t(`kinds.${deadline.kind}`)}</span>
            <span className="badge dot" style={{ '--dot': deadline.subject_color }}>{deadline.subject_name}</span>
            <span className="small notif-when">{`${formatDate(deadline.due_date)} · ${when}`}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function TaskItem({ task, overdue, onPick }) {
  const { t } = useTranslation();
  return (
    <li className={'notif-item' + (overdue ? ' overdue' : '')}>
      <Link to="/tasks/" onClick={onPick}>
        <span className="swatch" style={{ '--dot': task.subject_color || 'var(--soft-pink)' }} />
        <span className="grow">
          <span className="notif-title">{task.title}</span>
          <span className="task-meta">
            {task.subject_name && (
              <span className="badge dot" style={{ '--dot': task.subject_color }}>{task.subject_name}</span>
            )}
            <span className="badge" title={t('priority.title', { label: t(`priority.${task.priority}`) })}>
              {PRIORITY_EMOJI[task.priority]}
            </span>
            {overdue && (
              <span className="small notif-when">
                {`${formatDate(task.date)} · ${t('notifications.overdueBy', { count: task.days_overdue })}`}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => api('notifications/')
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { /* the bell simply keeps its last state */ });
    load();
    window.addEventListener('focus', load);
    window.addEventListener(DATA_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
      window.removeEventListener(DATA_CHANGED, load);
    };
  }, []);

  // the nearest deadline within WARN_DAYS: a toast once per day
  useEffect(() => {
    const next = data?.upcoming_deadlines[0];
    if (!next || next.days_left > WARN_DAYS) return;
    const key = WARNED_KEY + profile.username;
    try {
      if (localStorage.getItem(key) === data.date) return;
      localStorage.setItem(key, data.date);
    } catch {
      return;   // without storage we can't tell whether it was shown today
    }
    toast(warningText(next, t), 'info', 6000);
  }, [data, profile.username, t]);

  // close on Escape or a click outside
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpen(false); buttonRef.current.focus(); }
    };
    const onPointer = (event) => { if (!boxRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const upcoming = data ? data.upcoming_deadlines : [];
  const overdueDeadlines = data ? data.overdue_deadlines : [];
  const overdueTasks = data ? data.overdue_tasks : [];
  const overdueCount = data ? data.overdue_tasks_count : 0;
  const todayTasks = data ? data.today_tasks : [];
  const soon = upcoming.filter((d) => d.days_left <= WARN_DAYS);
  const count = soon.length + overdueDeadlines.length + overdueCount + todayTasks.length;
  const nothing = !upcoming.length && !overdueDeadlines.length && !overdueCount && !todayTasks.length;
  const close = () => setOpen(false);
  const today = data && new Date(`${data.date}T00:00`);
  const daysOverdue = (task) => Math.round((today - new Date(`${task.date}T00:00`)) / 86400000);

  return (
    <div className="bell" ref={boxRef}>
      <button
        type="button" ref={buttonRef} className={'bell-btn' + (count ? ' has-alerts' : '')}
        aria-expanded={String(open)} aria-controls="notif-menu"
        aria-label={count ? t('notifications.bellCount', { count }) : t('notifications.bell')}
        title={t('notifications.bell')}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="bell-icon" aria-hidden="true">🔔</span>
        {count > 0 && <span className="bell-badge" aria-hidden="true">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="notif-pop" id="notif-menu">
          <section className="card notif-menu" aria-labelledby="notif-title">
            <h2 id="notif-title">{t('notifications.title')}</h2>
            <div className="notif-scroll">
              {nothing && <Empty icon="🌷">{t('notifications.empty')}</Empty>}

              {(overdueDeadlines.length > 0 || overdueCount > 0) && (
                <>
                  <h3 className="notif-head overdue">{t('notifications.overdue')}</h3>
                  <ul className="list">
                    {overdueDeadlines.map((d) => <DeadlineItem key={`d${d.id}`} deadline={d} overdue onPick={close} />)}
                    {overdueTasks.map((task) => (
                      <TaskItem key={`t${task.id}`} task={{ ...task, days_overdue: daysOverdue(task) }} overdue onPick={close} />
                    ))}
                  </ul>
                  {overdueCount > overdueTasks.length && (
                    <p className="small" style={{ margin: '4px 0 0' }}>
                      <Link to="/tasks/" onClick={close}>{t('notifications.moreOverdue', { count: overdueCount - overdueTasks.length })}</Link>
                    </p>
                  )}
                </>
              )}

              {upcoming.length > 0 && (
                <>
                  <h3 className="notif-head">{t('notifications.upcoming')}</h3>
                  <ul className="list">
                    {upcoming.map((d) => <DeadlineItem key={d.id} deadline={d} onPick={close} />)}
                  </ul>
                </>
              )}

              {todayTasks.length > 0 && (
                <>
                  <h3 className="notif-head">{t('notifications.todayTasks')}</h3>
                  <ul className="list">
                    {todayTasks.map((task) => <TaskItem key={task.id} task={task} onPick={close} />)}
                  </ul>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
