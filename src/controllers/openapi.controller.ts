import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';

let cachedSpec: unknown = null;

async function loadSpec(): Promise<unknown> {
  if (cachedSpec === null) {
    const raw = await readFile(path.join(process.cwd(), 'openapi.json'), 'utf8');
    cachedSpec = JSON.parse(raw);
  }
  return cachedSpec;
}

export async function openapiJson(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await loadSpec());
}
