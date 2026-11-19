import { useEffect, type ReactNode } from 'react';
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/features/auth';
import { SafeWelcome } from '@/features/safe-welcome';

/**
 * Nobody reaches the rooms without an account. The welcome screen is drawn
 * with plain React Native styles so it always appears on the phone.
 */
export function AccountGateScreen({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (session && pathname === '/entrar') router.replace('/');
  }, [session, pathname]);

  if (session) return <>{children}</>;
  // The staff panel has its own door: user name and password are checked on
  // the server, which refuses any account without a staff role.
  if (pathname.startsWith('/auth') || pathname === '/admin') return <>{children}</>;
  if (loading) return <SafeWelcome />;
  return <SafeWelcome />;
}
