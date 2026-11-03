/*
  Login / registration card. The fields, help texts and error lists are the
  same markup the former Django template rendered for these forms, and
  the errors come from the same Django forms (api/v1/auth/form-login and form-register).
*/
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { submitAuthForm } from '../api/client.js';
import { serverMessage } from '../i18n.js';
import { pageTitle } from '../lib/bloom.js';
import LangSwitch from './LangSwitch.jsx';
import heartMid from '../img/hearts/heart-mid.svg';

/** Django's messages are Russian: translated when shown in English */
function ErrorList({ errors }) {
  useTranslation();   // re-render on language change
  if (!errors || !errors.length) return null;
  return <ul className="errorlist" role="alert">{errors.map((e) => <li key={e}>{serverMessage(e)}</li>)}</ul>;
}

/** Django's LoginView only follows a local "next" URL. */
function safeNext(next) {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;
  return '/today/';
}

/**
 * fields: [{name, label, type, attrs, help}]: label and help are locale keys (help may hold a list)
 * Passwords are cleared after a failed submit, other values stay (like a re-rendered Django form).
 */
export default function AuthForm({ kind, title, heading, fields, submitLabel, footer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const formRef = useRef(null);
  const [errors, setErrors] = useState({});
  const busy = useRef(false);   // ignore double clicks (the old form had no disabled state)

  useEffect(() => { document.title = pageTitle(title); }, [title]);
  useEffect(() => { formRef.current.elements[fields[0].name].focus(); }, [fields]);

  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    const form = formRef.current;
    const values = Object.fromEntries(fields.map((f) => [f.name, form.elements[f.name].value]));
    busy.current = true;
    try {
      const result = await submitAuthForm(kind, values);
      if (!result.errors) {
        // no refresh() here: an urgent re-render would hit PublicOnly's redirect to /today/
        // before the router's (transition) navigation; the provider reloads on the new URL anyway
        navigate(kind === 'login' ? safeNext(params.get('next')) : '/today/');
        return;
      }
      setErrors(result.errors);
      fields.filter((f) => f.type === 'password').forEach((f) => { form.elements[f.name].value = ''; });
      window.scrollTo(0, 0);
      form.elements[fields[0].name].focus();
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="public">
      <header className="public-top">
        <Link className="brand" to="/"><img src={heartMid} alt="" /> Bloom</Link>
        <nav><LangSwitch /></nav>
      </header>
      <main className="auth-wrap">
        <form className="card auth-card" method="post" noValidate ref={formRef} onSubmit={submit}>
          <h1>{heading}</h1>
          <ErrorList errors={errors.__all__} />
          {fields.map((f) => {
            const help = f.help && t(f.help, { returnObjects: true });
            const fieldErrors = errors[f.name];
            const describedBy = [f.help && `id_${f.name}_helptext`, fieldErrors && `id_${f.name}_error`]
              .filter(Boolean).join(' ') || undefined;
            return (
              <div className="field" key={f.name}>
                <label htmlFor={`id_${f.name}`}>{t(f.label)}</label>
                <input
                  type={f.type} name={f.name} id={`id_${f.name}`} {...f.attrs}
                  aria-invalid={fieldErrors ? 'true' : undefined} aria-describedby={describedBy}
                />
                {help && (
                  <span className="helptext">
                    {Array.isArray(help) ? <ul>{help.map((h) => <li key={h}>{h}</li>)}</ul> : help}
                  </span>
                )}
                <ErrorList errors={fieldErrors} />
              </div>
            );
          })}
          {kind === 'login' && <input type="hidden" name="next" value={params.get('next') || ''} />}
          <button type="submit" className="btn">{submitLabel}</button>
          <p className="small muted" style={{ textAlign: 'center', marginTop: '12px' }}>{footer}</p>
        </form>
      </main>
    </div>
  );
}
