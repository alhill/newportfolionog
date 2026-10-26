export type ResourceFieldType = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'lines' | 'date' | 'image' | 'products';

export interface ResourceField {
  name: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface ResourceSpec {
  key: string;
  collection: string;
  title: string;
  singular: string;
  orderBy: string;
  fields: ResourceField[];
}

export const resourceSpecs = {
  categories: {
    key: 'categories',
    collection: 'storeCategories',
    title: 'Categorías',
    singular: 'Categoría',
    orderBy: 'name',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'isActive', label: 'Visible en la tienda', type: 'checkbox' },
    ],
  },
  brands: {
    key: 'brands',
    collection: 'storeBrands',
    title: 'Marcas',
    singular: 'Marca',
    orderBy: 'name',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'isActive', label: 'Activa', type: 'checkbox' },
    ],
  },
  collections: {
    key: 'collections',
    collection: 'storeCollections',
    title: 'Colecciones',
    singular: 'Colección',
    orderBy: 'name',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'textarea' },
      { name: 'isActive', label: 'Visible', type: 'checkbox' },
    ],
  },
  coupons: {
    key: 'coupons',
    collection: 'storeCoupons',
    title: 'Cupones',
    singular: 'Cupón',
    orderBy: 'code',
    fields: [
      { name: 'code', label: 'Código', type: 'text', required: true },
      {
        name: 'type',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'percent', label: 'Porcentaje' },
          { value: 'fixed', label: 'Importe fijo' },
        ],
      },
      { name: 'amount', label: 'Valor (% o €)', type: 'number', required: true },
      { name: 'startsAt', label: 'Empieza', type: 'date' },
      { name: 'endsAt', label: 'Termina', type: 'date' },
      { name: 'usageLimit', label: 'Límite de usos (vacío = sin límite)', type: 'number' },
      { name: 'isActive', label: 'Activo', type: 'checkbox' },
    ],
  },
  campaigns: {
    key: 'campaigns',
    collection: 'storeCampaigns',
    title: 'Campañas',
    singular: 'Campaña',
    orderBy: 'name',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'startsAt', label: 'Empieza', type: 'date' },
      { name: 'endsAt', label: 'Termina', type: 'date' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
      {
        name: 'featuredProductIds',
        label: 'Productos',
        type: 'products',
        help: 'Se guarda el enlace al producto. El nombre y la foto se leen de su ficha.',
      },
      { name: 'isActive', label: 'Activa', type: 'checkbox' },
    ],
  },
  banners: {
    key: 'banners',
    collection: 'storeBanners',
    title: 'Banners',
    singular: 'Banner',
    orderBy: 'sortOrder',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'imageUrl', label: 'Imagen', type: 'image', required: true },
      { name: 'href', label: 'Enlace', type: 'text' },
      { name: 'sortOrder', label: 'Orden', type: 'number' },
      { name: 'isActive', label: 'Visible', type: 'checkbox' },
    ],
  },
  pages: {
    key: 'pages',
    collection: 'storePages',
    title: 'Páginas de la tienda',
    singular: 'Página',
    orderBy: 'title',
    fields: [
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'slug', label: 'Slug', type: 'text', required: true, help: 'Usa "inicio" para el texto de la portada de /tienda.' },
      { name: 'body', label: 'Contenido', type: 'textarea' },
      { name: 'seoTitle', label: 'SEO: título', type: 'text' },
      { name: 'seoDescription', label: 'SEO: descripción', type: 'textarea' },
      { name: 'published', label: 'Publicada', type: 'checkbox' },
    ],
  },
  menus: {
    key: 'menus',
    collection: 'storeMenus',
    title: 'Menús',
    singular: 'Menú',
    orderBy: 'name',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      {
        name: 'itemsText',
        label: 'Enlaces',
        type: 'lines',
        help: 'Una línea por enlace: Texto | /ruta',
      },
      { name: 'isActive', label: 'Activo', type: 'checkbox' },
    ],
  },
  blocks: {
    key: 'blocks',
    collection: 'storeBlocks',
    title: 'Bloques',
    singular: 'Bloque',
    orderBy: 'sortOrder',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'slot', label: 'Hueco', type: 'text', help: 'Por ejemplo: home' },
      { name: 'body', label: 'Texto', type: 'textarea' },
      { name: 'imageUrl', label: 'Imagen (URL)', type: 'text' },
      { name: 'href', label: 'Enlace', type: 'text' },
      { name: 'sortOrder', label: 'Orden', type: 'number' },
      { name: 'isActive', label: 'Visible', type: 'checkbox' },
    ],
  },
} as const satisfies Record<string, ResourceSpec>;

export type ResourceKey = keyof typeof resourceSpecs;

export function isResourceKey(value: string): value is ResourceKey {
  return Object.prototype.hasOwnProperty.call(resourceSpecs, value);
}
