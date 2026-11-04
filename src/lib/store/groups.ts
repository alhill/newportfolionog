export interface CatalogMember {
  id: string;
  name: string;
  groupId: string | null;
}

export type CatalogBlock<T extends CatalogMember> =
  | { kind: 'product'; product: T }
  | { kind: 'group'; groupId: string; products: T[] };

export function arrangeCatalog<T extends CatalogMember>(products: T[]): CatalogBlock<T>[] {
  const byGroup = new Map<string, T[]>();
  for (const product of products) {
    const groupId = product.groupId?.trim() || '';
    if (!groupId) continue;
    const list = byGroup.get(groupId) || [];
    list.push(product);
    byGroup.set(groupId, list);
  }

  for (const list of byGroup.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  const sorted = products.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const emitted = new Set<string>();
  const blocks: CatalogBlock<T>[] = [];

  for (const product of sorted) {
    if (emitted.has(product.id)) continue;
    const groupId = product.groupId?.trim() || '';
    const members = groupId ? byGroup.get(groupId) || [] : [];
    if (members.length > 1) {
      members.forEach((item) => emitted.add(item.id));
      blocks.push({ kind: 'group', groupId, products: members });
      continue;
    }
    emitted.add(product.id);
    blocks.push({ kind: 'product', product });
  }

  return blocks;
}

export function resolveGroupJoin(currentGroupId: string, pickedGroupId: string, createId: () => string) {
  const current = currentGroupId.trim();
  const picked = pickedGroupId.trim();

  if (current && current === picked) {
    return { groupId: current, updatePicked: false, updateCurrent: false, already: true };
  }

  if (current) {
    return { groupId: current, updatePicked: true, updateCurrent: false, already: false };
  }

  if (picked) {
    return { groupId: picked, updatePicked: false, updateCurrent: true, already: false };
  }

  return { groupId: createId(), updatePicked: true, updateCurrent: true, already: false };
}
