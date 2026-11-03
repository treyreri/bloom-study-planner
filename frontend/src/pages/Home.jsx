import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pageTitle } from '../lib/bloom.js';
import LangSwitch from '../components/LangSwitch.jsx';
import heartMid from '../img/hearts/heart-mid.svg';

const FEATURES = [['🗓️', 'month'], ['📚', 'study'], ['✨', 'habits'], ['💐', 'garden']];

export default function Home() {
  const { t } = useTranslation();
  useEffect(() => { document.title = pageTitle(t('home.title')); }, [t]);

  return (
    <div className="public">
      <header className="public-top">
        <Link className="brand" to="/">
          <img src={heartMid} alt="" /> Bloom
        </Link>
        <nav>
          <LangSwitch />
          <Link className="btn ghost small" to="/login/">{t('home.login')}</Link>
        </nav>
      </header>

      <main className="hero">
        <div>
          <div className="flowers" aria-hidden="true">🌱 🌿 🌷 💐</div>
          <h1>Bloom</h1>
          <p className="lead">{t('home.lead')}</p>
          <Link className="btn big" to="/register/">{t('home.start')}</Link>
          <p className="small muted" style={{ marginTop: '12px' }}>
            {`${t('home.haveAccount')} `}<Link to="/login/">{t('home.login')}</Link>
          </p>
        </div>
      </main>

      <section className="features" aria-label={t('home.features')}>
        {FEATURES.map(([icon, key]) => (
          <div key={key} className="card feature">
            <div className="icon" aria-hidden="true">{icon}</div>
            <h3>{t(`home.${key}Title`)}</h3>
            <p className="muted">{t(`home.${key}Text`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
