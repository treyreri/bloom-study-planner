/* My garden (/garden/): the flower of every month */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAll } from '../api/client.js';
import { MONTHS, STAGES, pageTitle } from '../lib/bloom.js';
import { Empty, Failed, Loading } from '../components/ui.jsx';

export default function Garden() {
  const [months, setMonths] = useState(null);   // [] | {error}

  useEffect(() => {
    document.title = pageTitle('Мой сад');
    getAll('months/').then(setMonths).catch((error) => setMonths({ error }));
  }, []);

  const counts = { seedling: 0, stem: 0, bud: 0, bouquet: 0 };
  if (Array.isArray(months)) months.forEach((m) => { counts[m.progress.stage] += 1; });

  let content;
  if (months === null) content = <Loading />;
  else if (months.error) content = <Failed error={months.error} />;
  else if (!months.length) {
    content = <Empty icon="🌱">Сад пока пуст. Создай план месяца и выполняй задачи — здесь вырастет первый цветок!</Empty>;
  } else {
    content = months.map((m) => {
      const stage = STAGES[m.progress.stage];
      return (
        <Link
          key={m.id}
          className={'bouquet' + (m.is_finished ? '' : ' growing')}
          to={`/month/?year=${m.year}&month=${m.month}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
          aria-label={`${MONTHS[m.month - 1]} ${m.year}: ${stage.label}, ${m.progress.percent}%`}
        >
          <div className="flower-emoji" aria-hidden="true">{stage.emoji}</div>
          <h3 style={{ margin: '6px 0 2px' }}>{`${MONTHS[m.month - 1]} ${m.year}`}</h3>
          <div className="small">{m.title}</div>
          <div className="small muted">
            <span className="num">{`${m.progress.percent}%`}</span>{` · ${m.progress.done}/${m.progress.total} задач`}
          </div>
          <span className="badge" style={{ marginTop: '6px' }}>{m.is_finished ? 'сохранён 💐' : 'ещё растёт 🌱'}</span>
        </Link>
      );
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>Мой сад 🌸</h1>
        <p className="muted">Каждый месяц — новый цветок. Чем больше сделано, тем пышнее букет.</p>
      </div>

      <section className="panel" aria-labelledby="garden-summary-title" style={{ marginBottom: '16px' }}>
        <h2 id="garden-summary-title" className="visually-hidden">Итоги</h2>
        <div className="grid-3" id="garden-summary" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          {Array.isArray(months) && Object.entries(STAGES).map(([key, stage]) => (
            <div key={key} className="stat">
              <strong>{`${stage.emoji} ${counts[key]}`}</strong>
              <span className="muted small">{stage.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="garden-grid" id="garden">{content}</div>
      <p className="small muted" style={{ marginTop: '12px' }}>
        🌱 0–24% · 🌿 25–49% · 🌷 50–79% · 💐 80–100% выполненных задач.
        Когда месяц заканчивается, его цветок сохраняется навсегда.
      </p>
    </>
  );
}
