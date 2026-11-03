/* Small building blocks with the same markup as the old Bloom.* helpers. */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STAGE_EMOJI, stageLabel, toast } from '../lib/bloom.js';

/** <p class="loading">Загружаем</p> */
export function Loading({ text }) {
  const { t } = useTranslation();
  return <p className="loading">{text || t('common.loading')}</p>;
}

/** Empty state: big icon + text */
export function Empty({ icon, children }) {
  return (
    <div className="empty-state">
      <span className="icon" aria-hidden="true">{icon}</span>{children}
    </div>
  );
}

/** "Не удалось загрузить: …" */
export function Failed({ error }) {
  const { t } = useTranslation();
  return <p className="form-error" role="alert">{t('common.failed', { message: error.message })}</p>;
}

/** Inline form error paragraph (hidden by CSS when empty). */
export function FormError({ error }) {
  return <p className="form-error" role="alert">{error ? error.message : ''}</p>;
}

// ---------- pixel heart ---------------------------------------------------

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

export function HeartSvg({ filled }) {
  return (
    <svg viewBox="0 0 9 8" aria-hidden="true">
      <path d={filled ? FILLED : OUTLINE} className={filled ? 'fill' : 'outline'} />
      {filled && <path d="M2 1h1v1h-1z" fill="#fff" fillOpacity=".75" />}
    </svg>
  );
}

/**
 * A heart that works like a checkbox.
 * onToggle(newValue) returns a Promise; on failure the heart goes back.
 */
export function HeartButton({ checked, label, onToggle, disabled = false }) {
  const [state, setState] = useState({ value: Boolean(checked), pulse: false, round: 0 });
  const [pending, setPending] = useState(false);

  function set(value) {
    // a new key on the svg restarts the CSS "pulse" animation
    setState((s) => ({ value, pulse: value, round: s.round + 1 }));
  }

  async function click() {
    const next = !state.value;
    set(next);
    setPending(true);
    try {
      await onToggle(next);
    } catch (error) {
      set(!next);
      toast(error.message, 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button" className={'heart-check' + (state.pulse ? ' pulse' : '')} role="checkbox"
      aria-checked={String(state.value)} aria-label={label} title={label}
      disabled={disabled || pending} onClick={click}
    >
      <HeartSvg key={state.round} filled={state.value} />
    </button>
  );
}

/** Two-step delete: the first click asks "Точно?", the second one confirms. */
export function ConfirmButton({ action, children, question, ...props }) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function click() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    setBusy(true);
    try { await action(); } catch (error) { toast(error.message, 'error'); setBusy(false); }
  }

  return (
    <button type="button" {...props} disabled={busy} data-armed={String(armed)} onClick={click}>
      {armed ? (question || t('common.confirm')) : children}
    </button>
  );
}

/** Flower in a pot + vine progress bar. Animates when the stage changes. */
export function Flower({ progress, previousStage }) {
  const { t } = useTranslation();
  const label = stageLabel(progress.stage);
  const grow = previousStage && previousStage !== progress.stage;
  return (
    <>
      <div className="flower">
        <div className={'pot' + (grow ? ' grow' : '')} role="img" aria-label={t('flower.label', { stage: label })}>
          {STAGE_EMOJI[progress.stage]}
        </div>
        <strong>{`${label[0].toUpperCase()}${label.slice(1)}`}</strong>
        <span className="muted small">{t('flower.tasks', { done: progress.done, total: progress.total })}</span>
      </div>
      <div
        className="vine" role="progressbar" aria-valuemin="0" aria-valuemax="100"
        aria-valuenow={String(progress.percent)} aria-label={t('flower.progress')}
      >
        <div className="vine-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>
        <span className="num">{`${progress.percent}%`}</span>{` ${t('flower.done')}`}
      </div>
    </>
  );
}

/**
 * Keeps the previous flower stage so <Flower> can play the "grow" animation
 * when the stage changes (the old code stored it in data-stage).
 */
export function useFlower() {
  const [flower, setFlower] = useState(null);   // {progress, previousStage, round}
  function show(progress, { animate = true } = {}) {
    // "round" is used as the React key: every update draws a new pot, as before
    setFlower((old) => ({
      progress,
      previousStage: animate && old ? old.progress.stage : undefined,
      round: (old?.round || 0) + 1,
    }));
  }
  return [flower, show];
}

/**
 * The old Bloom.busy(form, work): disables the submit button while the
 * request runs and shows the error in the form's .form-error paragraph.
 */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function run(work) {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}

/** <option>s with the user's subjects (the old fillSubjectSelect). */
export function SubjectOptions({ subjects, emptyLabel }) {
  const { t } = useTranslation();
  return (
    <>
      <option value="">{emptyLabel || t('common.noSubject')}</option>
      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </>
  );
}
