import { describe, expect, it } from 'vitest';
import { isTaskProgressNoteSection } from './progress-note-sections';
import { CreateManualTaskRequestSchema } from './types';

const request = {
  category: 'manual-charting',
  taskTitle: 'Recheck vitals',
  location: { id: 'loc-1', name: 'Main clinic' },
};

describe('task progress note sections', () => {
  it.each([
    ['vitals', true],
    ['in-house-lab-orders', false],
    ['toString', false],
    [undefined, false],
  ])('recognises %j as a section: %j', (value, expected) => {
    expect(isTaskProgressNoteSection(value)).toBe(expected);
  });

  it('accepts a section linked to a visit', () => {
    const parsed = CreateManualTaskRequestSchema.parse({
      ...request,
      appointmentId: 'appt-1',
      progressNoteSection: 'vitals',
    });

    expect(parsed.progressNoteSection).toBe('vitals');
  });

  it('turns a cleared section into undefined', () => {
    expect(
      CreateManualTaskRequestSchema.parse({ ...request, progressNoteSection: null }).progressNoteSection
    ).toBeUndefined();
  });

  it.each([
    ['an unknown section', { appointmentId: 'appt-1', progressNoteSection: 'billing' }],
    ['a section without a visit', { progressNoteSection: 'vitals' }],
    [
      'a section together with an order',
      { appointmentId: 'appt-1', orderId: 'order-1', progressNoteSection: 'vitals' },
    ],
  ])('rejects %s', (_case, body) => {
    expect(CreateManualTaskRequestSchema.safeParse({ ...request, ...body }).success).toBe(false);
  });
});
