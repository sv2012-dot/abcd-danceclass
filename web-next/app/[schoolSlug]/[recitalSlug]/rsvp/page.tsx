import { Metadata } from 'next';
import { recitals } from '@/lib/api';
import { RecitalClient } from '../_client';

// Match parent /[recitalSlug]/page.tsx — fresh SSR every request so
// poster/details stay current after edits.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{ schoolSlug: string; recitalSlug: string }>;
};

// Mirror the parent recital page's metadata so shared /rsvp links also get
// rich previews on WhatsApp / Facebook / Twitter.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { schoolSlug, recitalSlug } = await params;
    const data = await recitals.getPublic(schoolSlug, recitalSlug);

    const title = `RSVP — ${data.recital.title} — ${data.school.name}`;
    const description = data.recital.description || `RSVP for ${data.recital.title} at ${data.school.name}`;
    const imageUrl = data.recital.poster_url || 'https://manchq.com/ManchQ-Logo.png';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://manchq.com/${schoolSlug}/${recitalSlug}/rsvp`,
        siteName: 'ManchQ',
        images: [{ url: imageUrl, width: 1200, height: 630, alt: data.recital.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: 'ManchQ Recital RSVP', description: 'RSVP for a recital on ManchQ' };
  }
}

// Renders the same RecitalClient as the parent route, but auto-scrolls to the
// inline RSVP section on mount. This keeps any previously-shared /rsvp links
// (QR codes, WhatsApp shares, etc.) working.
export default async function RecitalRsvpPage({ params }: Props) {
  const { schoolSlug, recitalSlug } = await params;

  let initialData = null;
  try {
    initialData = await recitals.getPublic(schoolSlug, recitalSlug);
  } catch (error) {
    console.error('Failed to load recital:', error);
  }

  return (
    <RecitalClient
      schoolSlug={schoolSlug}
      recitalSlug={recitalSlug}
      initialData={initialData}
      autoScrollToRsvp
    />
  );
}
