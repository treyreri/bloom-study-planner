import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pageTitle } from '../lib/bloom.js';
import heartMid from '../img/hearts/heart-mid.svg';

export default function Home() {
  useEffect(() => { document.title = pageTitle('Милый планер для учёбы'); }, []);

  return (
    <div className="public">
      <header className="public-top">
        <Link className="brand" to="/">
          <img src={heartMid} alt="" /> Bloom
        </Link>
        <nav>
          <Link className="btn ghost small" to="/login/">Войти</Link>
        </nav>
      </header>

      <main className="hero">
        <div>
          <div className="flowers" aria-hidden="true">🌱 🌿 🌷 💐</div>
          <h1>Bloom</h1>
          <p className="lead">
            Милый планер для учёбы: план на месяц, задачи с сердечками, привычки,
            помодоро и рефлексия. Каждая выполненная задача поливает твой цветок месяца.
          </p>
          <Link className="btn big" to="/register/">Начать цвести 🌷</Link>
          <p className="small muted" style={{ marginTop: '12px' }}>
            Уже есть аккаунт? <Link to="/login/">Войти</Link>
          </p>
        </div>
      </main>

      <section className="features" aria-label="Возможности">
        <div className="card feature"><div className="icon" aria-hidden="true">🗓️</div><h3>План на месяц</h3><p className="muted">Цели месяца и календарь с сердечками задач.</p></div>
        <div className="card feature"><div className="icon" aria-hidden="true">📚</div><h3>Учёба</h3><p className="muted">Предметы, расписание и обратный отсчёт до экзаменов.</p></div>
        <div className="card feature"><div className="icon" aria-hidden="true">✨</div><h3>Привычки</h3><p className="muted">Отмечай дни и следи за серией 🔥.</p></div>
        <div className="card feature"><div className="icon" aria-hidden="true">💐</div><h3>Мой сад</h3><p className="muted">Букет за каждый месяц — коллекция твоих успехов.</p></div>
      </section>
    </div>
  );
}
