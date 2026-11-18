import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const defaultDatabasePath = () => resolve(process.env.ULBRIS_DATA_DIR
  ?? fileURLToPath(new URL('../.local-data/', import.meta.url)), 'accounts.sqlite');
