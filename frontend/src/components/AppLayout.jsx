/*
  Layout of every page after login (the old templates/app.html):
  sidebar on desktop, bottom bar with 5 icons + "Ещё" sheet on phones.
*/
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/client.js';
import { useAuth } from '../auth.jsx';
import heartMid from '../img/hearts/heart-mid.svg';

// (path, label, icon, shown in the mobile bottom bar?)
export const NAV_ITEMS = [
  ['/today/', 'Сегодня', '🏠', true],
  ['/month/', 'Мой месяц', '🗓️', true],
  ['/tasks/', 'Задачи', '💗', true],
  ['/study/', 'Учёба', '📚', false],
  ['/habits/', 'Привычки', '✨', false],
  ['/focus/', 'Помодоро', '⏳', true],
  ['/diary/', 'Дневник', '💌', false],
  ['/garden/', 'Мой сад', '🌸', false],
  ['/profile/', 'Профиль', '🎀', false],
];

const linkClass = (base) => () => base;   // no extra "active" class, aria-current marks the page

function NavItem({ path, label, icon, className }) {
  return (
    <NavLink className={linkClass(className)} to={path}>
      <span className="icon" aria-hidden="true">{icon}</span>{label}
    </NavLink>
  );
}

export default function AppLayout({ children }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // a new page always starts at the top with the "Ещё" sheet closed (like a page load)
  useEffect(() => {
    setMoreOpen(false);
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  async function onLogout(event) {
    event.preventDefault();
    await logout();
    // no state update before navigating (see AuthForm): the provider notices the new URL
    navigate('/');
  }

  return (
    <>
      <div className="app">
        <aside className="sidebar" aria-label="Главное меню">
          <Link className="brand" to="/today/">
            <img src={heartMid} alt="" /> Bloom
          </Link>
          <nav>
            {NAV_ITEMS.map(([path, label, icon]) => (
              <NavItem key={path} path={path} label={label} icon={icon} className="nav-link" />
            ))}
          </nav>

          <div className="sidebar-user">
            {profile.avatar
              ? <img className="avatar" src={profile.avatar} alt="" />
              : <span className="avatar" aria-hidden="true">🌷</span>}
            {' '}{/* same whitespace as the old template (not rendered between flex items) */}
            <div className="who">
              <strong>{profile.first_name || profile.username}</strong>{' '}
              <form method="post" onSubmit={onLogout}>
                <button type="submit" className="icon-btn small">Выйти ↩</button>
              </form>
            </div>
          </div>
        </aside>

        <main className="main" id="main">
          {children}
        </main>
      </div>

      {/* Mobile navigation: 4 main pages + "Ещё" (TZ 6.3: menu at the bottom, 5 icons) */}
      <nav className="bottom-nav" aria-label="Меню">
        {NAV_ITEMS.filter((item) => item[3]).map(([path, label, icon]) => (
          <NavLink key={path} to={path} className={linkClass(undefined)}>
            <span className="icon" aria-hidden="true">{icon}</span>{label}
          </NavLink>
        ))}
        <button
          type="button" data-more-toggle aria-expanded={String(moreOpen)} aria-controls="more-sheet"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <span className="icon" aria-hidden="true">🌸</span>Ещё
        </button>
      </nav>
      <div className="more-sheet" id="more-sheet" hidden={!moreOpen}>
        {NAV_ITEMS.filter((item) => !item[3]).map(([path, label, icon]) => (
          <NavItem key={path} path={path} label={label} icon={icon} className="nav-link" />
        ))}
        <form method="post" onSubmit={onLogout}>
          <button type="submit" className="nav-link icon-btn" style={{ width: '100%' }}>
            <span className="icon" aria-hidden="true">↩</span>Выйти
          </button>
        </form>
      </div>
    </>
  );
}
