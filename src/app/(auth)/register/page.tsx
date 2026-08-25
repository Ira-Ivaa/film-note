import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Регистрация — Film Note' };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
