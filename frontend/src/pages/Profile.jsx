/* Profile (/profile/): name, avatar, accent colour, semester goal */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { pageTitle, toast } from '../lib/bloom.js';
import { FormError, useBusy } from '../components/ui.jsx';

export default function Profile() {
  const formRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const { busy, error, setError, run } = useBusy();

  function render(data) {
    const form = formRef.current;
    setProfile(data);
    form.elements.first_name.value = data.first_name;
    form.elements.semester_goal.value = data.semester_goal;
    form.querySelectorAll('input[name="accent_color"]').forEach((radio) => {
      radio.checked = radio.value === data.accent_color;
    });
  }

  useEffect(() => {
    document.title = pageTitle('Профиль');
    api('profile/').then(render).catch(setError);
    // preview the accent colour immediately (native "change", as before)
    const form = formRef.current;
    const onChange = (event) => {
      if (event.target.name === 'accent_color') document.body.dataset.accent = event.target.value;
    };
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event) {
    event.preventDefault();
    const form = formRef.current;
    const data = new FormData(form);
    if (!form.elements.avatar.files.length) data.delete('avatar');
    run(async () => {
      const saved = await api('profile/', { method: 'PATCH', formData: data });
      render(saved);
      form.elements.avatar.value = '';
      toast('Профиль сохранён 🎀');
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>Профиль 🎀</h1>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="profile-title">
          <h2 id="profile-title" className="visually-hidden">Настройки профиля</h2>
          <form id="profile-form" noValidate ref={formRef} onSubmit={submit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div id="avatar-preview">
                {profile?.avatar
                  ? <img className="avatar large" src={profile.avatar} alt="Аватар" />
                  : <span className="avatar large" aria-hidden="true">🌷</span>}
              </div>
              <div>
                <div id="profile-username" style={{ fontSize: '1.3rem' }}>{profile ? profile.username : ''}</div>
                <div className="muted small" id="profile-email">{profile ? (profile.email || 'email не указан') : ''}</div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="avatar">Аватар (до 2 МБ)</label>
              <input type="file" id="avatar" name="avatar" accept="image/*" />
            </div>
            <div className="field">
              <label htmlFor="first-name">Имя</label>
              <input type="text" id="first-name" name="first_name" maxLength="150" />
            </div>
            <fieldset className="accent-picker">
              <legend className="muted small" style={{ marginBottom: '6px' }}>Цвет-акцент</legend>
              <input type="radio" name="accent_color" id="accent-pink" value="pink" />
              <label htmlFor="accent-pink"><span className="swatch" style={{ '--dot': '#FF0080' }}></span>Розовый</label>
              <input type="radio" name="accent_color" id="accent-lavender" value="lavender" />
              <label htmlFor="accent-lavender"><span className="swatch" style={{ '--dot': '#8A3FE0' }}></span>Лавандовый</label>
              <input type="radio" name="accent_color" id="accent-peach" value="peach" />
              <label htmlFor="accent-peach"><span className="swatch" style={{ '--dot': '#EC5B1E' }}></span>Персиковый</label>
            </fieldset>
            <div className="field">
              <label htmlFor="semester-goal">Цель на семестр</label>
              <textarea id="semester-goal" name="semester_goal" rows="3"></textarea>
            </div>
            <FormError error={error} />
            <button type="submit" className="btn" disabled={busy}>Сохранить</button>
          </form>
        </section>

        {/* staff only (is_staff from GET /api/v1/profile/) */}
        {profile?.is_staff && (
          <section className="panel" aria-labelledby="api-title">
            <h2 id="api-title">Для разработчиков</h2>
            <p>У Bloom есть REST API с документацией Swagger.</p>
            <p><a className="btn secondary" href="/api/docs/">Открыть Swagger</a></p>
            <p className="small muted">
              Чтобы попробовать API в Swagger: выполни <code>POST /api/v1/auth/token/</code> со своим
              логином и паролем, нажми «Authorize» и вставь значение <code>access</code> из ответа
              (слово Bearer Swagger добавит сам).
            </p>
          </section>
        )}
      </div>
    </>
  );
}
