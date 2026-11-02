import { Link } from 'react-router-dom';
import AuthForm from '../components/AuthForm.jsx';

// Same fields, help texts and attributes as the RegisterForm (UserCreationForm)
const FIELDS = [
  { name: 'username', label: 'Имя пользователя', type: 'text',
    attrs: { maxLength: 150, autoCapitalize: 'none', autoComplete: 'username', required: true },
    help: 'Обязательное поле. Не более 150 символов. Только буквы, цифры и символы @/./+/-/_.' },
  { name: 'email', label: 'Email (необязательно)', type: 'email', attrs: { maxLength: 320 } },
  { name: 'password1', label: 'Пароль', type: 'password',
    attrs: { autoComplete: 'new-password', required: true },
    help: [
      'Пароль не должен быть слишком похож на другую вашу личную информацию.',
      'Ваш пароль должен содержать как минимум 8 символов.',
      'Пароль не должен быть слишком простым и распространенным.',
      'Пароль не может состоять только из цифр.',
    ] },
  { name: 'password2', label: 'Подтверждение пароля', type: 'password',
    attrs: { autoComplete: 'new-password', required: true },
    help: 'Для подтверждения введите, пожалуйста, пароль ещё раз.' },
];

export default function Register() {
  return (
    <AuthForm
      kind="register" title="Регистрация" heading="Начать цвести 🌱" fields={FIELDS}
      submitLabel="Создать аккаунт"
      footer={<>Уже есть аккаунт? <Link to="/login/">Войти</Link></>}
    />
  );
}
