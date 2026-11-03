import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthForm from '../components/AuthForm.jsx';

// Same fields and attributes as Django's AuthenticationForm (label = locale key)
const FIELDS = [
  { name: 'username', label: 'auth.username', type: 'text',
    attrs: { autoCapitalize: 'none', autoComplete: 'username', maxLength: 150, required: true } },
  { name: 'password', label: 'auth.password', type: 'password',
    attrs: { autoComplete: 'current-password', required: true } },
];

export default function Login() {
  const { t } = useTranslation();
  return (
    <AuthForm
      kind="login" title={t('auth.loginTitle')} heading={t('auth.loginHeading')} fields={FIELDS}
      submitLabel={t('auth.loginSubmit')}
      footer={<>{`${t('auth.noAccount')} `}<Link to="/register/">{t('auth.register')}</Link></>}
    />
  );
}
