/**
 * The request schemas of get-chart-section and get-visit-note are the access boundary of the chart read
 * path: a request names an encounter and a section, and for two sections a small enumerated option. Every
 * other key — above all anything that looks like a FHIR search parameter — is rejected.
 */
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { CHART_SECTIONS, GetChartSectionRequest } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { describe, expect, it } from 'vitest';
import { GetChartSectionSchema } from '../../src/ehr/get-chart-section/index';
import { GetVisitNoteSchema } from '../../src/ehr/get-visit-note/index';
import type { ZambdaInput } from '../../src/shared/types/common';
import { validateWithSchema } from '../../src/shared/validation';

const encounterId = '11111111-1111-4111-8111-111111111111';

const input = (body: unknown): ZambdaInput =>
  ({ headers: null, body: body === null ? null : JSON.stringify(body), secrets: { key: 'val' } }) as ZambdaInput;

describe('get-chart-section request validation', () => {
  it('accepts every section by name', () => {
    CHART_SECTIONS.forEach((section) => {
      const params = section === 'notes' ? { types: [NOTE_TYPE.INTAKE] } : undefined;
      const result = validateWithSchema(GetChartSectionSchema, input({ encounterId, section, params }));
      expect(result).toMatchObject({ encounterId, section, secrets: { key: 'val' } });
    });
  });

  it('accepts the enumerated options of the two sections that have them', () => {
    expect(
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'notes', params: { types: [NOTE_TYPE.VITALS, NOTE_TYPE.ADDENDUM] } })
      ).params
    ).toEqual({ types: ['vitals', 'addendum'] });
    expect(
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'history', params: { medicationCount: 100 } })
      ).params
    ).toEqual({ medicationCount: 100 });
    // The typed request agrees with the schema: history's option set may be left out.
    const historyWithoutParams: GetChartSectionRequest<'history'> = { encounterId, section: 'history' };
    expect(validateWithSchema(GetChartSectionSchema, input(historyWithoutParams)).params).toBeUndefined();
  });

  it('requires a body, a uuid encounter id and a known section', () => {
    expect(() => validateWithSchema(GetChartSectionSchema, input(null))).toThrow(
      'The request was missing a required request body'
    );
    expect(() => validateWithSchema(GetChartSectionSchema, input({ section: 'exam' }))).toThrow('encounterId');
    expect(() =>
      validateWithSchema(GetChartSectionSchema, input({ encounterId: 'not-a-uuid', section: 'exam' }))
    ).toThrow('encounterId');
    expect(() => validateWithSchema(GetChartSectionSchema, input({ encounterId, section: 'everything' }))).toThrow(
      'section'
    );
    expect(() => validateWithSchema(GetChartSectionSchema, input({ encounterId }))).toThrow('section');
  });

  it('rejects search parameters and every other extra key', () => {
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'history', requestedFields: { allergies: {} } })
      )
    ).toThrow('requestedFields');
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'history', params: { _tag: 'known-allergy' } })
      )
    ).toThrow('_tag');
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'history', params: { _revinclude: 'Observation:patient' } })
      )
    ).toThrow('_revinclude');
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'notes', params: { types: [NOTE_TYPE.INTAKE], _search_by: 'patient' } })
      )
    ).toThrow('_search_by');
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'plan', params: { encounterIds: ['another-encounter'] } })
      )
    ).toThrow('params');
  });

  it('rejects options a section does not take', () => {
    expect(() =>
      validateWithSchema(GetChartSectionSchema, input({ encounterId, section: 'exam', params: { medicationCount: 5 } }))
    ).toThrow('params');
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'history', params: { medicationCount: 0 } })
      )
    ).toThrow('medicationCount');
    expect(() =>
      validateWithSchema(
        GetChartSectionSchema,
        input({ encounterId, section: 'history', params: { medicationCount: 1001 } })
      )
    ).toThrow('medicationCount');
  });

  it('requires the notes section to name at least one known note type', () => {
    // @ts-expect-error the typed request agrees with the schema: a notes request without its types matches no shape
    const notesWithoutTypes: GetChartSectionRequest = { encounterId, section: 'notes' };
    expect(() => validateWithSchema(GetChartSectionSchema, input(notesWithoutTypes))).toThrow('params');
    expect(() =>
      validateWithSchema(GetChartSectionSchema, input({ encounterId, section: 'notes', params: { types: [] } }))
    ).toThrow('types');
    expect(() =>
      validateWithSchema(GetChartSectionSchema, input({ encounterId, section: 'notes', params: { types: ['diary'] } }))
    ).toThrow('types');
  });
});

describe('get-visit-note request validation', () => {
  it('accepts an encounter id and nothing else', () => {
    expect(validateWithSchema(GetVisitNoteSchema, input({ encounterId }))).toEqual({
      encounterId,
      secrets: { key: 'val' },
    });
    expect(() => validateWithSchema(GetVisitNoteSchema, input(null))).toThrow(
      'The request was missing a required request body'
    );
    expect(() => validateWithSchema(GetVisitNoteSchema, input({ encounterId: 'not-a-uuid' }))).toThrow('encounterId');
    expect(() =>
      validateWithSchema(GetVisitNoteSchema, input({ encounterId, requestedFields: { notes: {} } }))
    ).toThrow('requestedFields');
    expect(() => validateWithSchema(GetVisitNoteSchema, input({ encounterId, noteTypes: [NOTE_TYPE.INTAKE] }))).toThrow(
      'noteTypes'
    );
  });
});
