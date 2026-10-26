import { adminDb } from '../firebase-admin';
import { StoreError } from './errors';
import { centsToEuros, eurosToCents } from './money';
import { isResourceKey, resourceSpecs, type ResourceKey } from './resource-specs';
import { slugify } from './slug';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nowIso() {
  return new Date().toISOString();
}

function lines(value: unknown) {
  return asString(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export function assertResourceKey(value: string): ResourceKey {
  if (!isResourceKey(value)) throw new StoreError('Recurso no encontrado', 404);
  return value;
}

function emptyForm(key: ResourceKey) {
  const form: Record<string, unknown> = {};
  for (const field of resourceSpecs[key].fields) {
    if (field.type === 'checkbox') form[field.name] = key !== 'coupons';
    else if (field.type === 'number') form[field.name] = field.name === 'sortOrder' ? 0 : '';
    else if (field.type === 'select') form[field.name] = field.options?.[0]?.value || '';
    else if (field.type === 'products') form[field.name] = [];
    else form[field.name] = '';
  }
  return form;
}

export function toResourceForm(key: ResourceKey, id: string, data: FirebaseFirestore.DocumentData) {
  const form = emptyForm(key);
  form.id = id;

  if (key === 'coupons') {
    form.code = asString(data.code);
    form.type = data.type === 'fixed' ? 'fixed' : 'percent';
    form.amount = data.type === 'fixed' && typeof data.amount === 'number' ? centsToEuros(data.amount) : (data.amount ?? 0);
    form.startsAt = asString(data.startsAt).slice(0, 10);
    form.endsAt = asString(data.endsAt).slice(0, 10);
    form.usageLimit = data.usageLimit ?? '';
    form.usageCount = typeof data.usageCount === 'number' ? data.usageCount : 0;
    form.isActive = data.isActive !== false;
    return form;
  }

  if (key === 'menus') {
    const items = Array.isArray(data.items) ? data.items : [];
    form.name = asString(data.name);
    form.itemsText = items
      .map((item) => `${asString(item?.label)} | ${asString(item?.href)}`.trim())
      .filter((line) => line !== '|')
      .join('\n');
    form.isActive = data.isActive !== false;
    return form;
  }

  if (key === 'campaigns') {
    form.name = asString(data.name);
    form.startsAt = asString(data.startsAt).slice(0, 10);
    form.endsAt = asString(data.endsAt).slice(0, 10);
    form.notes = asString(data.notes);
    form.featuredProductIds = Array.isArray(data.featuredProductIds)
      ? data.featuredProductIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
      : [];
    form.isActive = data.isActive !== false;
    return form;
  }

  for (const field of resourceSpecs[key].fields) {
    if (data[field.name] != null) form[field.name] = data[field.name];
  }
  if ('isActive' in form && data.isActive == null) form.isActive = true;
  if ('published' in form && data.published == null) form.published = false;
  return form;
}

const slugResources = new Set<ResourceKey>(['categories', 'brands', 'collections', 'pages']);

export function resourceHasSlug(key: ResourceKey) {
  return slugResources.has(key);
}

async function uniqueSlug(collection: string, slug: string, excludeId?: string) {
  let base = slugify(slug);
  if (!base) throw new StoreError('El slug no es válido');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const snapshot = await adminDb.collection(collection).where('slug', '==', candidate).limit(2).get();
    if (!snapshot.docs.some((doc) => doc.id !== excludeId)) return candidate;
  }
  throw new StoreError('No se ha podido generar un slug único');
}

export async function assertResourceSlug(key: ResourceKey, slug: string, excludeId?: string) {
  if (!resourceHasSlug(key)) throw new StoreError('Este recurso no usa slug');
  const normalized = slug.trim();
  if (!normalized) throw new StoreError('El slug es obligatorio');
  if (slugify(normalized) !== normalized) {
    throw new StoreError('El slug solo puede tener minúsculas, números y guiones');
  }
  const snapshot = await adminDb.collection(resourceSpecs[key].collection).where('slug', '==', normalized).limit(2).get();
  if (snapshot.docs.some((doc) => doc.id !== excludeId)) {
    throw new StoreError('Ese slug ya está en uso');
  }
  return normalized;
}

export async function suggestResourceSlug(key: ResourceKey, base: string, excludeId?: string) {
  if (!resourceHasSlug(key)) throw new StoreError('Este recurso no usa slug');
  return uniqueSlug(resourceSpecs[key].collection, base, excludeId);
}

function idList(value: unknown, max = 30) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
          return (item as { id: string }).id.trim();
        }
        return '';
      })
      .filter(Boolean)
      .slice(0, max);
  }
  return lines(value).slice(0, max);
}

export async function sanitizeResource(key: ResourceKey, input: Record<string, unknown>, existing?: FirebaseFirestore.DocumentData, excludeId?: string) {
  const spec = resourceSpecs[key];
  const timestamp = nowIso();
  const base = {
    createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : timestamp,
    updatedAt: timestamp,
  };

  if (key === 'coupons') {
    const code = asString(input.code).toUpperCase();
    if (!code) throw new StoreError('El código es obligatorio');
    const type = input.type === 'fixed' ? 'fixed' : 'percent';
    const amount = type === 'fixed' ? eurosToCents(input.amount) : Math.round(Number(input.amount));
    if (type === 'percent' && (!Number.isInteger(amount) || amount < 0 || amount > 100)) {
      throw new StoreError('El porcentaje tiene que estar entre 0 y 100');
    }
    const usageLimitRaw = input.usageLimit == null || input.usageLimit === '' ? null : Number(input.usageLimit);
    if (usageLimitRaw != null && (!Number.isInteger(usageLimitRaw) || usageLimitRaw < 1)) {
      throw new StoreError('El límite de usos no es válido');
    }
    return {
      ...base,
      code,
      type,
      amount,
      startsAt: asString(input.startsAt),
      endsAt: asString(input.endsAt),
      usageLimit: usageLimitRaw,
      usageCount: typeof existing?.usageCount === 'number' ? existing.usageCount : 0,
      isActive: input.isActive !== false,
    };
  }

  if (key === 'menus') {
    const name = asString(input.name);
    if (!name) throw new StoreError('El nombre es obligatorio');
    const items = lines(input.itemsText).map((line) => {
      const [label, href] = line.split('|').map((part) => part.trim());
      if (!label || !href) throw new StoreError('Cada enlace tiene que usar el formato Texto | /ruta');
      return { label: label.slice(0, 80), href: href.slice(0, 300) };
    });
    return { ...base, name, items, isActive: input.isActive !== false };
  }

  if (key === 'campaigns') {
    const name = asString(input.name);
    if (!name) throw new StoreError('El nombre es obligatorio');
    return {
      ...base,
      name,
      startsAt: asString(input.startsAt),
      endsAt: asString(input.endsAt),
      notes: asString(input.notes).slice(0, 5000),
      featuredProductIds: idList(input.featuredProductIds),
      isActive: input.isActive !== false,
    };
  }

  const record: Record<string, unknown> = { ...base };
  for (const field of spec.fields) {
    if (field.type === 'checkbox') {
      record[field.name] = input[field.name] === true || input[field.name] === 'true';
      continue;
    }
    if (field.type === 'number') {
      const raw = input[field.name];
      record[field.name] = raw == null || raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(record[field.name] as number)) throw new StoreError(`${field.label} no es válido`);
      continue;
    }
    record[field.name] = asString(input[field.name]);
  }

  if (typeof record.name === 'string' && !record.name && spec.fields.some((field) => field.name === 'name')) {
    throw new StoreError('El nombre es obligatorio');
  }
  if (typeof record.title === 'string' && !record.title) throw new StoreError('El título es obligatorio');

  if ('slug' in record) {
    record.slug = await assertResourceSlug(key, asString(input.slug), excludeId);
  }

  if (key === 'banners' && !asString(input.imageUrl)) throw new StoreError('La imagen es obligatoria');
  if (key === 'blocks' && !asString(input.slot)) record.slot = 'home';
  return record;
}

export async function listResources(key: ResourceKey) {
  const spec = resourceSpecs[key];
  const snapshot = await adminDb.collection(spec.collection).orderBy(spec.orderBy).limit(200).get();
  return snapshot.docs.map((doc) => toResourceForm(key, doc.id, doc.data()));
}

export async function getResource(key: ResourceKey, id: string) {
  const doc = await adminDb.collection(resourceSpecs[key].collection).doc(id).get();
  if (!doc.exists) return null;
  return toResourceForm(key, doc.id, doc.data() || {});
}

export async function createResource(key: ResourceKey, input: Record<string, unknown>) {
  const data = await sanitizeResource(key, input);
  const ref = await adminDb.collection(resourceSpecs[key].collection).add(data);
  return getResource(key, ref.id);
}

export async function updateResource(key: ResourceKey, id: string, input: Record<string, unknown>) {
  const ref = adminDb.collection(resourceSpecs[key].collection).doc(id);
  const existing = await ref.get();
  if (!existing.exists) throw new StoreError('No encontrado', 404);
  const data = await sanitizeResource(key, input, existing.data(), id);
  await ref.set(data);
  return getResource(key, id);
}

export async function deleteResource(key: ResourceKey, id: string) {
  await adminDb.collection(resourceSpecs[key].collection).doc(id).delete();
}
