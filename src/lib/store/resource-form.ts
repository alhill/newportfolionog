import { z } from 'zod';
import { resourceSpecs, type ResourceField, type ResourceKey } from './resource-specs';

const slugField = z.string().trim().min(1, 'El slug es obligatorio').regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'El slug solo puede tener minúsculas, números y guiones',
);

function requiredMessage(field: ResourceField) {
  if (field.name === 'name') return 'El nombre es obligatorio';
  if (field.name === 'title') return 'El título es obligatorio';
  if (field.name === 'code') return 'El código es obligatorio';
  if (field.name === 'amount') return 'El valor es obligatorio';
  if (field.name === 'priceEuros') return 'El precio es obligatorio';
  return `${field.label} es obligatorio`;
}

function invalidMessage(field: ResourceField) {
  if (field.name === 'amount') return 'El valor no es válido';
  if (field.name === 'priceEuros') return 'El precio no es válido';
  if (field.name === 'usageLimit') return 'El límite de usos no es válido';
  if (field.name === 'sortOrder') return 'El orden no es válido';
  return `${field.label} no es válido`;
}

function numberField(field: ResourceField) {
  const invalid = invalidMessage(field);
  return z.preprocess(
    (value) => (value == null ? '' : String(value).trim()),
    field.required
      ? z.string().min(1, requiredMessage(field)).refine((value) => {
        const amount = Number(value);
        return Number.isFinite(amount) && amount >= 0;
      }, invalid)
      : z.string().refine((value) => value === '' || Number.isFinite(Number(value)), invalid),
  );
}

export function validateResourceForm(key: ResourceKey, input: Record<string, unknown>): Record<string, string> {
  const spec = resourceSpecs[key];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of spec.fields) {
    if (field.type === 'checkbox' || field.type === 'select' || field.type === 'products') continue;
    if (field.name === 'slug') {
      shape.slug = slugField;
      continue;
    }
    if (field.type === 'image') {
      shape[field.name] = z.string().trim().min(1, 'La imagen es obligatoria').regex(/^https?:\/\//i, 'La imagen no es válida');
      continue;
    }
    if (field.type === 'number') {
      shape[field.name] = numberField(field);
      continue;
    }
    shape[field.name] = field.required
      ? z.string().trim().min(1, requiredMessage(field))
      : z.string();
  }

  const schema = z.object(shape).passthrough().superRefine((data, ctx) => {
    if (key === 'coupons' && input.type === 'percent' && String(data.amount ?? '').trim() !== '') {
      const amount = Number(data.amount);
      if (!Number.isInteger(amount) || amount < 0 || amount > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'El porcentaje tiene que estar entre 0 y 100' });
      }
    }
    if (key === 'coupons' && String(data.usageLimit ?? '').trim() !== '') {
      const limit = Number(data.usageLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['usageLimit'], message: 'El límite de usos no es válido' });
      }
    }
    if (key === 'menus') {
      const broken = String(data.itemsText || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .some((line) => {
          const [label, href] = line.split('|').map((part) => part.trim());
          return !label || !href;
        });
      if (broken) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['itemsText'], message: 'Cada enlace tiene que usar el formato Texto | /ruta' });
      }
    }
  });

  const parsed = schema.safeParse(input);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String).join('.');
    if (path && !errors[path]) errors[path] = issue.message;
  }
  return errors;
}
