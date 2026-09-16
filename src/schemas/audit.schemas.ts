import { z } from 'zod';

export const AuditLogQuerySchema = z
  .object({
    entityType: z.string().min(1).max(100).optional(),
    entityId: z.string().min(1).max(100).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => value.from === undefined || value.to === undefined || value.from <= value.to, {
    message: 'from must be on or before to',
  });

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
