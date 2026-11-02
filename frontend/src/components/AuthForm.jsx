/*
  Login / registration card. The fields, help texts and error lists are the
  same markup the former Django template rendered for these forms, and
  the errors come from the same Django forms (api/v1/auth/form-login and form-register).
*/
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { submitAuthForm } from '../api/client.js';
import { pageTitle } from '../lib/bloom.js';
import heartMid from '../img/hearts/heart-mid.svg';

function ErrorList({ errors }) {
  if (!errors || !errors.length) return null;
  return <ul className="errorlist" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>;
}

/** Django's LoginView only follows a local "next" URL. */
function safeNext(next) {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;
  return '/today/';
}

/**
 * fields: [{name, label, type, attrs, help (string or array of list items)}]
 * Passwords are cleared after a failed submit, other values stay (like a re-rendered Django form).
 */
export default function AuthForm({ kind, title, heading, fields, submitLabel, footer }) {
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
      </header>
      <main className="auth-wrap">
        <form className="card auth-card" method="post" noValidate ref={formRef} onSubmit={submit}>
          <h1>{heading}</h1>
          <ErrorList errors={errors.__all__} />
          {fields.map((f) => {
            const fieldErrors = errors[f.name];
            const describedBy = [f.help && `id_${f.name}_helptext`, fieldErrors && `id_${f.name}_error`]
              .filter(Boolean).join(' ') || undefined;
            return (
              <div className="field" key={f.name}>
                <label htmlFor={`id_${f.name}`}>{f.label}</label>
                <input
                  type={f.type} name={f.name} id={`id_${f.name}`} {...f.attrs}
                  aria-invalid={fieldErrors ? 'true' : undefined} aria-describedby={describedBy}
                />
                {f.help && (
                  <span className="helptext">
                    {Array.isArray(f.help) ? <ul>{f.help.map((h) => <li key={h}>{h}</li>)}</ul> : f.help}
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
