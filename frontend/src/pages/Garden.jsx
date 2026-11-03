/* My garden (/garden/): the flower of every month */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAll } from '../api/client.js';
import { STAGE_EMOJI, monthName, pageTitle, stageLabel } from '../lib/bloom.js';
import { Empty, Failed, Loading } from '../components/ui.jsx';

export default function Garden() {
  const { t } = useTranslation();
  const [months, setMonths] = useState(null);   // [] | {error}

  useEffect(() => { document.title = pageTitle(t('garden.title')); }, [t]);

  useEffect(() => {
    getAll('months/').then(setMonths).catch((error) => setMonths({ error }));
  }, []);

  const counts = { seedling: 0, stem: 0, bud: 0, bouquet: 0 };
  if (Array.isArray(months)) months.forEach((m) => { counts[m.progress.stage] += 1; });

  let content;
  if (months === null) content = <Loading />;
  else if (months.error) content = <Failed error={months.error} />;
  else if (!months.length) {
    content = <Empty icon="🌱">{t('garden.empty')}</Empty>;
  } else {
    content = months.map((m) => {
      const name = `${monthName(m.month)} ${m.year}`;
      return (
        <Link
          key={m.id}
          className={'bouquet' + (m.is_finished ? '' : ' growing')}
          to={`/month/?year=${m.year}&month=${m.month}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
          aria-label={t('garden.monthLabel', { month: name, stage: stageLabel(m.progress.stage), percent: m.progress.percent })}
        >
          <div className="flower-emoji" aria-hidden="true">{STAGE_EMOJI[m.progress.stage]}</div>
          <h3 style={{ margin: '6px 0 2px' }}>{name}</h3>
          <div className="small">{m.title}</div>
          <div className="small muted">
            <span className="num">{`${m.progress.percent}%`}</span>{t('garden.tasks', { done: m.progress.done, total: m.progress.total })}
          </div>
          <span className="badge" style={{ marginTop: '6px' }}>{t(m.is_finished ? 'garden.kept' : 'garden.growing')}</span>
        </Link>
      );
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>{t('garden.heading')}</h1>
        <p className="muted">{t('garden.subtitle')}</p>
      </div>

      <section className="panel" aria-labelledby="garden-summary-title" style={{ marginBottom: '16px' }}>
        <h2 id="garden-summary-title" className="visually-hidden">{t('garden.summary')}</h2>
        <div className="grid-3" id="garden-summary" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          {Array.isArray(months) && Object.entries(STAGE_EMOJI).map(([key, emoji]) => (
            <div key={key} className="stat">
              <strong>{`${emoji} ${counts[key]}`}</strong>
              <span className="muted small">{stageLabel(key)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="garden-grid" id="garden">{content}</div>
      <p className="small muted" style={{ marginTop: '12px' }}>
        {`${t('garden.legend1')} ${t('garden.legend2')}`}
      </p>
    </>
  );
}
