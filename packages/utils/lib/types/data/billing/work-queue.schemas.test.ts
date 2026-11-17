import { describe, expect, it } from 'vitest';
import { SaveBillingWorkQueueInputSchema } from './work-queue.schemas';

describe('SaveBillingWorkQueueInputSchema', () => {
  it('requires a name and keeps the description short enough for the list', () => {
    expect(SaveBillingWorkQueueInputSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(SaveBillingWorkQueueInputSchema.safeParse({ name: 'Q', description: 'x'.repeat(201) }).success).toBe(false);
    expect(SaveBillingWorkQueueInputSchema.parse({ name: 'Q' })).toEqual({ name: 'Q', filters: {}, layout: {} });
  });
});
