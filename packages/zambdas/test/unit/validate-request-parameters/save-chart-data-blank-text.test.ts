import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/save-chart-data/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

const ENCOUNTER_ID = '550e8400-e29b-41d4-a716-446655440000';

const note = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  type: NOTE_TYPE.SCREENING,
  text: 'Patient reports dizziness',
  authorId: 'prac-1',
  authorName: 'Dr. Smith',
  patientId: 'pat-1',
  encounterId: ENCOUNTER_ID,
  ...overrides,
});

const validateNotes = (notes: Record<string, unknown>[]): unknown =>
  validateRequestParameters(createMockZambdaInput({ encounterId: ENCOUNTER_ID, notes })).notes;

describe('save-chart-data - notes', () => {
  test.each([
    ['an empty note', ''],
    ['a spaces-only note', '   '],
    ['a newline-only note', '\n'],
    ['a tabs and newlines note', '\t\n \n'],
  ])('rejects %s with INVALID_INPUT', (_label, text) => {
    try {
      validateNotes([note({ text })]);
      expect.fail('expected the request to be rejected');
    } catch (error: any) {
      expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
      expect(error.message).toContain('notes');
    }
  });

  test('rejects an edit that blanks an existing note', () => {
    expect(() => validateNotes([note({ resourceId: 'comm-1', text: '  ' })])).toThrow('notes');
  });

  test('rejects a note without text', () => {
    expect(() => validateNotes([note({ text: undefined })])).toThrow('notes');
  });

  test('keeps non-blank note text exactly as typed', () => {
    const text = '  Follow up in 2 weeks\n  - recheck BP  ';
    expect(validateNotes([note({ text })])).toEqual([note({ text })]);
  });

  test('accepts a soft-delete tombstone whatever its text', () => {
    const tombstone = note({ resourceId: 'comm-1', type: NOTE_TYPE.ADDENDUM, text: '', deleted: true });
    expect(validateNotes([tombstone])).toEqual([tombstone]);
  });

  test('rejects the whole batch when one of several notes is blank', () => {
    expect(() => validateNotes([note({}), note({ text: ' ' })])).toThrow('notes');
  });
});

describe('save-chart-data - instructions', () => {
  const validateInstructions = (instructions: Record<string, unknown>[]): unknown =>
    validateRequestParameters(createMockZambdaInput({ encounterId: ENCOUNTER_ID, instructions })).instructions;

  test.each([
    ['whitespace-only text and no title', { text: ' \n ' }],
    ['a whitespace-only title and no text', { title: '  ' }],
    ['whitespace-only text and title', { text: '\n', title: ' ' }],
    ['no content at all', {}],
  ])('rejects an instruction with %s', (_label, instruction) => {
    try {
      validateInstructions([instruction]);
      expect.fail('expected the request to be rejected');
    } catch (error: any) {
      expect(error.code).toBe(APIErrorCode.INVALID_INPUT);
      expect(error.message).toContain('instructions');
    }
  });

  test.each([
    ['text only', { text: 'Drink fluids' }],
    ['a title and whitespace-only text', { title: 'Wound care', text: ' ' }],
    ['an education document with a title', { title: 'Asthma handout', educationDocRefId: 'doc-1' }],
    ['null text next to a title', { title: 'Wound care', text: null }],
  ])('accepts an instruction with %s as sent', (_label, instruction) => {
    expect(validateInstructions([instruction])).toEqual([instruction]);
  });
});
