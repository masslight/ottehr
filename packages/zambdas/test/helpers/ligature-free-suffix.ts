import { randomUUID } from 'crypto';

export const ligatureFreeSuffix = (): string => randomUUID().replace(/[-f]/g, '').slice(0, 8);
