import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type Meta = PaginationMeta | { total: number };

export function ok(res: Response, data: unknown, meta?: Meta): void {
  const body: { data: unknown; meta?: Meta } = { data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  res.status(200).json(body);
}
