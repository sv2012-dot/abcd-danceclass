import { Metadata } from 'next';
import { recitals } from '@/lib/api';
import { RecitalClient } from './_client';

type Props = {
  params: Promise<{ schoolSlug: string; recitalSlug: string }>;
};

// This runs on the SERVER and generates OG metadata for social media previews
// (WhatsApp, Facebook, Twitter). Next.js injects these tags into <head> before rendering.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { schoolSlug, recitalSlug } = await params;
    const data = await recitals.getPublic(schoolSlug, recitalSlug);

    const title = `${data.recital.title} — ${data.school.name}`;
    const description = data.recital.description || `Join ${data.school.name} for ${data.recital.title}`;
    const imageUrl = data.recital.poster_url || 'https://manchq.com/ManchQ-Logo.png';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://manchq.com/${schoolSlug}/${recitalSlug}`,
        siteName: 'ManchQ',
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: data.recital.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    return {
      title: 'ManchQ Recital',
      description: 'View recital details on ManchQ',
    };
  }
}

// Server Component: fetches data and passes to Client Component
export default async function RecitalPage({ params }: Props) {
  const { schoolSlug, recitalSlug } = await params;

  let initialData = null;
  try {
    initialData = await recitals.getPublic(schoolSlug, recitalSlug);
  } catch (error) {
    console.error('Failed to load recital:', error);
  }

  return <RecitalClient schoolSlug={schoolSlug} recitalSlug={recitalSlug} initialData={initialData} />;
}
