/* Profile (/profile/): name, avatar, accent colour, semester goal */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { pageTitle, toast } from '../lib/bloom.js';
import { FormError, useBusy } from '../components/ui.jsx';

export default function Profile() {
  const { t } = useTranslation();
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

  useEffect(() => { document.title = pageTitle(t('profile.title')); }, [t]);

  useEffect(() => {
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
      toast(t('profile.saved'));
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>{t('profile.heading')}</h1>
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="profile-title">
          <h2 id="profile-title" className="visually-hidden">{t('profile.settings')}</h2>
          <form id="profile-form" noValidate ref={formRef} onSubmit={submit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div id="avatar-preview">
                {profile?.avatar
                  ? <img className="avatar large" src={profile.avatar} alt={t('profile.avatar')} />
                  : <span className="avatar large" aria-hidden="true">🌷</span>}
              </div>
              <div>
                <div id="profile-username" style={{ fontSize: '1.3rem' }}>{profile ? profile.username : ''}</div>
                <div className="muted small" id="profile-email">{profile ? (profile.email || t('profile.noEmail')) : ''}</div>
              </div>
            </div>
            <div className="field">
              <label htmlFor="avatar">{t('profile.avatarLabel')}</label>
              <input type="file" id="avatar" name="avatar" accept="image/*" />
            </div>
            <div className="field">
              <label htmlFor="first-name">{t('profile.firstName')}</label>
              <input type="text" id="first-name" name="first_name" maxLength="150" />
            </div>
            <fieldset className="accent-picker">
              <legend className="muted small" style={{ marginBottom: '6px' }}>{t('profile.accent')}</legend>
              <input type="radio" name="accent_color" id="accent-pink" value="pink" />
              <label htmlFor="accent-pink"><span className="swatch" style={{ '--dot': '#FF0080' }}></span>{t('profile.pink')}</label>
              <input type="radio" name="accent_color" id="accent-lavender" value="lavender" />
              <label htmlFor="accent-lavender"><span className="swatch" style={{ '--dot': '#8A3FE0' }}></span>{t('profile.lavender')}</label>
              <input type="radio" name="accent_color" id="accent-peach" value="peach" />
              <label htmlFor="accent-peach"><span className="swatch" style={{ '--dot': '#EC5B1E' }}></span>{t('profile.peach')}</label>
            </fieldset>
            <div className="field">
              <label htmlFor="semester-goal">{t('profile.goal')}</label>
              <textarea id="semester-goal" name="semester_goal" rows="3"></textarea>
            </div>
            <FormError error={error} />
            <button type="submit" className="btn" disabled={busy}>{t('common.save')}</button>
          </form>
        </section>

        {/* staff only (is_staff from GET /api/v1/profile/) */}
        {profile?.is_staff && (
          <section className="panel" aria-labelledby="api-title">
            <h2 id="api-title">{t('profile.devTitle')}</h2>
            <p>{t('profile.devText')}</p>
            <p><a className="btn secondary" href="/api/docs/">{t('profile.openSwagger')}</a></p>
            <p className="small muted">
              {t('profile.devHow1')}<code>POST /api/v1/auth/token/</code>{t('profile.devHow2')}
              <code>access</code>{t('profile.devHow3')}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
