export const LINKTREE_KEYS = [
  'background',
  'containerStyle',
  'extraCss',
  'favicon',
  'headInsert',
  'headerDescription',
  'headerImg',
  'headerText',
  'linkStyle',
  'links',
  'seoDescription',
  'seoKeywords',
  'seoTitle',
] as const;

export type LinktreeKey = (typeof LINKTREE_KEYS)[number];

export type LinktreeData = Record<LinktreeKey, string>;

export interface LinktreeLinkItem {
  text: string;
  url: string;
}

export const EMPTY_LINKTREE_DATA: LinktreeData = Object.fromEntries(
  LINKTREE_KEYS.map((key) => [key, '']),
) as LinktreeData;

export const LINKTREE_FIELD_GROUPS: Array<{
  title: string;
  fields: Array<{
    key: LinktreeKey;
    label: string;
    type: 'text' | 'textarea';
    rows?: number;
    hint?: string;
  }>;
}> = [
  {
    title: 'Cabecera',
    fields: [
      { key: 'headerText', label: 'Texto de cabecera', type: 'text' },
      { key: 'headerDescription', label: 'Descripción de cabecera', type: 'textarea', rows: 3 },
      { key: 'headerImg', label: 'Imagen de cabecera (URL)', type: 'text' },
      { key: 'favicon', label: 'Favicon (URL)', type: 'text' },
    ],
  },
  {
    title: 'Estilos',
    fields: [
      { key: 'background', label: 'Fondo (CSS)', type: 'textarea', rows: 4 },
      { key: 'containerStyle', label: 'Estilo del contenedor (CSS)', type: 'textarea', rows: 4 },
      { key: 'linkStyle', label: 'Estilo de enlaces (CSS)', type: 'textarea', rows: 4 },
      { key: 'extraCss', label: 'CSS adicional', type: 'textarea', rows: 6 },
    ],
  },
  {
    title: 'SEO',
    fields: [
      { key: 'seoTitle', label: 'Título SEO', type: 'text' },
      { key: 'seoDescription', label: 'Descripción SEO', type: 'textarea', rows: 3 },
      { key: 'seoKeywords', label: 'Keywords SEO', type: 'text' },
    ],
  },
  {
    title: 'Avanzado',
    fields: [
      {
        key: 'headInsert',
        label: 'Inserción en <head> (HTML)',
        type: 'textarea',
        rows: 6,
      },
    ],
  },
];

export function parseLinktreeLinks(raw: string): LinktreeLinkItem[] {
  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => ({
      text: String(item?.text ?? ''),
      url: String(item?.url ?? ''),
    }));
  } catch {
    return [];
  }
}

export function serializeLinktreeLinks(items: LinktreeLinkItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      text: item.text,
      url: item.url,
    })),
  );
}

export function formatLinktreeValue(key: LinktreeKey, value: string): string {
  if (key !== 'links' || !value.trim()) {
    return value;
  }

  try {
    return serializeLinktreeLinks(parseLinktreeLinks(value));
  } catch {
    return value;
  }
}

export function validateLinktreeData(data: Partial<LinktreeData>): string | null {
  const links = data.links?.trim();

  if (links) {
    try {
      const parsed = JSON.parse(links);
      if (!Array.isArray(parsed)) {
        return 'El campo "links" debe ser un array JSON';
      }
    } catch {
      return 'El campo "links" debe contener JSON válido';
    }
  }

  return null;
}
