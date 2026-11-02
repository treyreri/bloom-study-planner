import { Link } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';

// Same fields and attributes as Django's AuthenticationForm
const FIELDS = [
  { name: 'username', label: 'Имя пользователя', type: 'text',
    attrs: { autoCapitalize: 'none', autoComplete: 'username', maxLength: 150, required: true } },
  { name: 'password', label: 'Пароль', type: 'password',
    attrs: { autoComplete: 'current-password', required: true } },
];

export default function Login() {
  return (
    <AuthForm
      kind="login" title="Вход" heading="С возвращением 🌷" fields={FIELDS} submitLabel="Войти"
      footer={<>Нет аккаунта? <Link to="/register/">Зарегистрироваться</Link></>}
    />
  );
}
