import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';

/** Entry point: straight to the library when signed in, otherwise to login. */
export default async function IndexPage() {
  const user = await getCurrentUser();
  redirect(user ? '/library' : '/login');
}
