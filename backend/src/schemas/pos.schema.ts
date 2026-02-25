import { z } from 'zod';

export const expenseTypeEnum = z.enum(['SUPPLIER_PAYMENT', 'OPERATIONAL_EXPENSE', 'CASH_DROP']);

export const saleSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1, { message: "Debe incluir al menos un producto" }),
  sellerId: z.string().uuid().optional(), // ID del staff que realiza la venta para comisiones
});

export const expenseSchema = z
  .object({
    amount: z.number().positive(),
    type: expenseTypeEnum,
    description: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'SUPPLIER_PAYMENT' || data.type === 'OPERATIONAL_EXPENSE') {
        return typeof data.description === 'string' && data.description.trim().length >= 5;
      }
      return true;
    },
    { message: 'La descripción es obligatoria (mín. 5 caracteres) para pagos a proveedores y gastos operativos.', path: ['description'] }
  );
