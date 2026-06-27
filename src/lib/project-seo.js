export const OG_TYPES = [
  'website',
  'article',
  'book',
  'profile',
  'music.song',
  'music.album',
  'music.playlist',
  'music.radio_station',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
  'business.business',
];

export const TWITTER_CARD_TYPES = [
  'summary',
  'summary_large_image',
  'app',
  'player',
];

export const META_DESCRIPTION_MAX_LENGTH = 160;
export const SEO_BRAND_PREFIX = 'Srta. Nognog | ';
export const CREATOR_NAME = 'Eva Nogueras';

const SEO_CONTENT_FIELDS = [
  'metaTitle',
  'metaDescription',
  'canonicalPath',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'jsonLd',
];

export function stripMarkdown(text) {
  if (!text) return '';

  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function truncateWithEllipsis(text, maxLength = META_DESCRIPTION_MAX_LENGTH) {
  if (!text || text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.6 ? truncated.slice(0, lastSpace) : truncated;

  return `${cut.trimEnd()}…`;
}

export function generateProjectSeo({ title = '', slug = '', description = '', thumb = '' }) {
  const metaTitle = `${SEO_BRAND_PREFIX}${title}`.trim();
  const metaDescription = truncateWithEllipsis(stripMarkdown(description));
  const canonicalPath = slug ? `/portfolio/${slug}` : '';

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: metaTitle,
      description: metaDescription,
      creator: {
        '@type': 'Person',
        name: CREATOR_NAME,
      },
    },
    null,
    2,
  );

  return {
    metaTitle,
    metaDescription,
    canonicalPath,
    ogTitle: metaTitle,
    ogDescription: metaDescription,
    ogImage: thumb || '',
    ogType: 'website',
    twitterCard: 'summary_large_image',
    noIndex: false,
    noFollow: false,
    jsonLd,
  };
}

export function isSeoEmpty(seo) {
  if (!seo) return true;

  return SEO_CONTENT_FIELDS.every((field) => !String(seo[field] ?? '').trim());
}

export function hasSeoContent(seo) {
  return !isSeoEmpty(seo);
}

export const EMPTY_PROJECT_SEO = {
  metaTitle: '',
  metaDescription: '',
  canonicalPath: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  noIndex: false,
  noFollow: false,
  jsonLd: '',
};
