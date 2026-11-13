import { Redirect } from 'expo-router';

/**
 * Performance moved under Admin → Support. The old link redirects rather than
 * 404s: it was in the admin tab row and in whatever people had bookmarked.
 */
export default function AdminPerformanceScreen() {
  return <Redirect href="/admin/support/performance" />;
}
