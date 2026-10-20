import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { MANUAL_ERA_LIMITS, TAG_NAME_FORBIDDEN_CHARACTERS_ERROR } from './billing.constants';
import {
  AddEraAttachmentInputSchema,
  RecordBillingManualPaymentInputSchema,
  RenameEraAttachmentInputSchema,
  SaveBillingTagInputSchema,
} from './billing.schemas';
import { SYSTEM_MANAGED_TAGS } from './system-tags';

describe('SaveBillingTagInputSchema', () => {
  it.each(['&', '=', ':', ',', '|', '\\', '$', '#', '%'])('rejects a name containing %s', (character) => {
    const result = SaveBillingTagInputSchema.safeParse({ name: `Medicare ${character} Medicaid` });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(TAG_NAME_FORBIDDEN_CHARACTERS_ERROR);
  });

  it.each(['.', '/', '(', ')', '_', '+', '-', "'", 'é'])('accepts a name containing %s', (character) => {
    const result = SaveBillingTagInputSchema.safeParse({ name: `Medicare ${character} Medicaid` });
    expect(result.success).toBe(true);
  });

  it('rejects a rename onto a forbidden name, not just a create', () => {
    const result = SaveBillingTagInputSchema.safeParse({
      tagId: 'tag-1',
      name: 'A=B',
    });
    expect(result.success).toBe(false);
  });

  it.each(SYSTEM_MANAGED_TAGS.map((def) => def.name))('accepts the system-managed name %s', (name) => {
    expect(SaveBillingTagInputSchema.safeParse({ name }).success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = SaveBillingTagInputSchema.safeParse({ name: '  Medicare Advantage  ' });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Medicare Advantage');
  });

  it('collapses repeated spaces, which would otherwise read as a separate tag', () => {
    const result = SaveBillingTagInputSchema.safeParse({ name: 'Medicare   Advantage' });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Medicare Advantage');
  });

  it.each([
    ['newline', 'a\nb'],
    ['tab', 'a\tb'],
    ['null', 'a\u0000b'],
    ['zero-width space', 'a​b'],
    ['zero-width non-joiner', 'a‌b'],
    ['non-breaking space', 'a b'],
    ['narrow non-breaking space', 'a b'],
    ['ideographic space', 'a　b'],
    ['byte order mark', 'a﻿b'],
    ['right-to-left override', 'a‮b'],
  ])('rejects a name containing a %s', (_label, name) => {
    expect(SaveBillingTagInputSchema.safeParse({ name }).success).toBe(false);
  });
});

describe('RecordBillingManualPaymentInputSchema', () => {
  const base = {
    encounterId: '4f4c1f5e-7f2f-4b7a-9a89-2f4f3a2f1b0c',
    amountInCents: 1500,
    paymentMethod: 'cash',
    idempotencyKey: 'key-1',
  };

  it.each([
    ['past', '2020-01-15T12:00:00Z'],
    ['same-day', DateTime.now().toISO() ?? ''],
    // e.g. a payment scheduled per an ERA
    ['future', DateTime.now().plus({ days: 2 }).toISO() ?? ''],
  ])('accepts a %s payment date', (_label, paymentDateISO) => {
    expect(RecordBillingManualPaymentInputSchema.safeParse({ ...base, paymentDateISO }).success).toBe(true);
  });
});

describe('ERA attachment names', () => {
  const longest = 'n'.repeat(MANUAL_ERA_LIMITS.attachmentNameLength);
  it.each([
    ['added', (name: string) => AddEraAttachmentInputSchema.safeParse({ eraId: 'era-1', name, fileName: 'scan.pdf' })],
    [
      'renamed',
      (name: string) =>
        RenameEraAttachmentInputSchema.safeParse({ eraId: 'era-1', documentReferenceId: 'doc-1', name }),
    ],
  ])('can be as long when %s, and no longer', (_when, parse) => {
    expect(parse(longest).success).toBe(true);
    expect(parse(`${longest}n`).success).toBe(false);
  });
});
