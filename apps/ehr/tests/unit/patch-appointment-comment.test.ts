// @vitest-environment jsdom
import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { patchAppointmentComment } from '../../src/helpers';

const appointment = (comment?: string): Appointment => ({
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'booked',
  participant: [],
  ...(comment !== undefined ? { comment } : {}),
});

const commentOperations = async (stored: Appointment, comment: string): Promise<Operation[] | undefined> => {
  const patch = vi.fn().mockResolvedValue(stored);
  const oystehr = { fhir: { get: vi.fn().mockResolvedValue(stored), patch } } as unknown as Oystehr;
  await patchAppointmentComment(stored, comment, undefined, oystehr);
  if (patch.mock.calls.length === 0) return undefined;
  return (patch.mock.calls[0][0].operations as Operation[]).filter((op) => op.path === '/comment');
};

describe('patchAppointmentComment', () => {
  it.each([' ', '\n', ' \n\t '])('removes the stored comment when the new comment is %j', async (comment) => {
    expect(await commentOperations(appointment('old note'), comment)).toEqual([{ op: 'remove', path: '/comment' }]);
  });

  it.each(['', ' ', '\n'])(
    'sends no comment operation when nothing is stored and the new comment is %j',
    async (comment) => {
      const operations = await commentOperations(appointment(), comment);
      expect(operations ?? []).toEqual([]);
    }
  );

  it('returns the stored appointment unpatched when a blank comment meets no stored comment', async () => {
    const stored = appointment();
    const patch = vi.fn();
    const oystehr = { fhir: { get: vi.fn().mockResolvedValue(stored), patch } } as unknown as Oystehr;
    expect(await patchAppointmentComment(stored, '  ', undefined, oystehr)).toBe(stored);
    expect(patch).not.toHaveBeenCalled();
  });

  it('adds a non-blank comment as typed when nothing is stored', async () => {
    expect(await commentOperations(appointment(), ' call back ')).toEqual([
      { op: 'add', path: '/comment', value: ' call back ' },
    ]);
  });

  it('replaces the stored comment with a non-blank comment as typed', async () => {
    expect(await commentOperations(appointment('old note'), 'new note\n')).toEqual([
      { op: 'replace', path: '/comment', value: 'new note\n' },
    ]);
  });
});
