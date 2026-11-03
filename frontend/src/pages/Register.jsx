import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthForm from '../components/AuthForm.jsx';

// Same fields, help texts and attributes as the RegisterForm (UserCreationForm);
// label and help are locale keys (a help key may hold a list)
const FIELDS = [
  { name: 'username', label: 'auth.username', type: 'text',
    attrs: { maxLength: 150, autoCapitalize: 'none', autoComplete: 'username', required: true },
    help: 'auth.usernameHelp' },
  { name: 'email', label: 'auth.email', type: 'email', attrs: { maxLength: 320 } },
  { name: 'password1', label: 'auth.password', type: 'password',
    attrs: { autoComplete: 'new-password', required: true },
    help: 'auth.passwordHelp' },
  { name: 'password2', label: 'auth.password2', type: 'password',
    attrs: { autoComplete: 'new-password', required: true },
    help: 'auth.password2Help' },
];

export default function Register() {
  const { t } = useTranslation();
  return (
    <AuthForm
      kind="register" title={t('auth.registerTitle')} heading={t('auth.registerHeading')} fields={FIELDS}
      submitLabel={t('auth.registerSubmit')}
      footer={<>{`${t('auth.haveAccount')} `}<Link to="/login/">{t('auth.login')}</Link></>}
    />
  );
}
