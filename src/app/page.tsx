import { getContent } from '@/lib/store';
import { LandingPage } from '@/components/site/landing-page';

// Content is admin-editable at runtime, so the homepage must not be cached
// statically — every request reads the current JSON store.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const content = await getContent();
  return <LandingPage content={content} />;
}
