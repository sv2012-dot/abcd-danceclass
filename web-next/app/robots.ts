// app/robots.ts — Next.js App Router file-convention.
// Tells crawlers what NOT to index. /ops/* is our internal recovery
// surface (e.g. ops/signin password sign-in) and should never appear
// in search results. The per-page metadata.robots tag in each /ops
// page is the second line of defense for bots that ignore robots.txt.

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/ops/'],
    },
  };
}
