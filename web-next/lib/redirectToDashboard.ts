import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * After login, send the user to the dashboard home (/home).
 */
export function redirectToDashboard(router: AppRouterInstance) {
  router.push('/home');
}
