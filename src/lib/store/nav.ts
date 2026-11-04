export interface StoreMenuLink {
  label: string;
  href: string;
}

interface StoreSection {
  name?: string;
  slug?: string;
}

export function storeMenuLinks(categories: StoreSection[]): StoreMenuLink[] {
  const sections = categories
    .filter((category) => category.name && category.slug)
    .map((category) => ({
      label: String(category.name),
      href: `/tienda?categoria=${category.slug}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));

  return [
    { label: 'Tienda', href: '/tienda' },
    { label: 'Portfolio', href: '/' },
    ...sections,
    { label: 'Carrito', href: '/tienda/carrito' },
  ];
}
