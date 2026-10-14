import { describe, expect, it } from 'vitest';
import {
  ChartNarrativeRequestSchema,
  ChartPlanRequestSchema,
  MAX_NARRATIVE_CHARS,
  SaveTranscriptRequestSchema,
} from './api';

describe('ChartPlanRequestSchema', () => {
  it('accepts the request the drawer sends', () => {
    const parsed = ChartPlanRequestSchema.parse({
      narrative: 'Provider: sore throat for two days.',
      encounterId: 'enc-1',
      providerEdits: { draft: 'Sore throat.', edited: 'Sore throat for two days.' },
    });
    expect(parsed).toEqual({
      narrative: 'Provider: sore throat for two days.',
      encounterId: 'enc-1',
      providerEdits: { draft: 'Sore throat.', edited: 'Sore throat for two days.' },
    });
  });

  it('rejects a blank or oversized narrative', () => {
    expect(ChartPlanRequestSchema.safeParse({ narrative: '   ' }).success).toBe(false);
    expect(ChartPlanRequestSchema.safeParse({ narrative: 'x'.repeat(MAX_NARRATIVE_CHARS + 1) }).success).toBe(false);
  });

  it('drops provider edits when either text is blank', () => {
    expect(ChartPlanRequestSchema.parse({ narrative: 'n', providerEdits: { draft: 'd', edited: ' ' } })).toEqual({
      narrative: 'n',
    });
  });

  it('rejects an unknown patient status and strips unknown keys', () => {
    expect(ChartPlanRequestSchema.safeParse({ narrative: 'n', patientStatus: 'returning' }).success).toBe(false);
    expect(ChartPlanRequestSchema.parse({ narrative: 'n', incremental: false })).toEqual({ narrative: 'n' });
  });
});

describe('ChartNarrativeRequestSchema', () => {
  it('requires a transcript and rejects an empty document id', () => {
    expect(ChartNarrativeRequestSchema.safeParse({ transcript: '' }).success).toBe(false);
    expect(ChartNarrativeRequestSchema.safeParse({ transcript: 't', documentId: '' }).success).toBe(false);
    expect(ChartNarrativeRequestSchema.parse({ transcript: 't', documentId: 'doc-1' })).toEqual({
      transcript: 't',
      documentId: 'doc-1',
    });
  });
});

describe('SaveTranscriptRequestSchema', () => {
  it('requires an encounter and trims the transcript', () => {
    expect(SaveTranscriptRequestSchema.safeParse({ transcript: 't' }).success).toBe(false);
    expect(SaveTranscriptRequestSchema.parse({ transcript: '  t  ', encounterId: 'enc-1' })).toEqual({
      transcript: 't',
      encounterId: 'enc-1',
    });
  });
});
