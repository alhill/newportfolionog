import { z } from 'zod';

const priceField = z.preprocess(
  (value) => (value == null ? '' : String(value).trim()),
  z.string().min(1, 'El precio es obligatorio').refine((value) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0;
  }, 'El precio no es válido'),
);

const stockField = z.preprocess(
  (value) => (value == null ? '' : String(value).trim()),
  z.string().min(1, 'El stock es obligatorio').refine((value) => /^\d+$/.test(value), 'El stock no es válido'),
);

const variantSchema = z.object({
  sku: z.string(),
  stock: z.union([z.string(), z.number()]),
  priceInherited: z.boolean(),
  priceEuros: z.union([z.string(), z.number()]),
});

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  slug: z.string().trim().min(1, 'El slug es obligatorio').regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'El slug solo puede tener minúsculas, números y guiones',
  ),
  priceEuros: priceField,
  hasVariants: z.boolean(),
  sku: z.string(),
  stock: z.union([z.string(), z.number()]),
  variants: z.array(variantSchema),
}).superRefine((data, ctx) => {
  if (!data.hasVariants) {
    if (!data.sku.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sku'], message: 'El SKU es obligatorio' });
    }
    const stock = stockField.safeParse(data.stock);
    if (!stock.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stock'],
        message: stock.error.issues[0]?.message || 'El stock no es válido',
      });
    }
    return;
  }

  if (data.variants.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants'], message: 'Añade al menos una variante' });
  }

  const seen = new Map<string, number>();
  data.variants.forEach((variant, index) => {
    const sku = variant.sku.trim();
    if (!sku) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants', index, 'sku'], message: 'El SKU es obligatorio' });
    } else {
      const key = sku.toLowerCase();
      const first = seen.get(key);
      if (first == null) {
        seen.set(key, index);
      } else {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants', index, 'sku'], message: 'Este SKU está repetido' });
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variants', first, 'sku'], message: 'Este SKU está repetido' });
      }
    }

    const stock = stockField.safeParse(variant.stock);
    if (!stock.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants', index, 'stock'],
        message: stock.error.issues[0]?.message || 'El stock no es válido',
      });
    }

    if (!variant.priceInherited) {
      const price = priceField.safeParse(variant.priceEuros);
      if (!price.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', index, 'priceEuros'],
          message: price.error.issues[0]?.message || 'El precio es obligatorio',
        });
      }
    }
  });
});

export interface ProductFormInput {
  name: string;
  slug: string;
  priceEuros: string | number;
  hasVariants: boolean;
  sku: string;
  stock: string | number;
  variants: {
    sku: string;
    stock: string | number;
    priceInherited: boolean;
    priceEuros: string | number;
  }[];
}

export function validateProductForm(input: ProductFormInput): Record<string, string> {
  const parsed = productFormSchema.safeParse(input);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join('.');
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
