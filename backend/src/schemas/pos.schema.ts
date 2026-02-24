import { z } from 'zod';

export const saleSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1, { message: "Debe incluir al menos un producto" }),
  sellerId: z.string().uuid().optional(), // ID del staff que realiza la venta para comisiones
});

export const expenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(5),
});
