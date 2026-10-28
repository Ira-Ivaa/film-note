import { ProfileForm } from '@/components/ProfileForm';
import { requireUser } from '@/lib/auth';

export const metadata = { title: 'Настройки — Film Note' };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-muted">
          Ваш логин <span className="text-fg">@{user.username}</span> — по нему друзья отправляют
          заявки. Email: {user.email}
        </p>
      </div>

      <ProfileForm initialDisplayName={user.displayName} initialVisibility={user.listVisibility} />
    </div>
  );
}
