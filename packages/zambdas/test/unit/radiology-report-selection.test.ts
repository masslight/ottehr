import { DiagnosticReport } from 'fhir/r4b';
import { ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { describe, expect, it } from 'vitest';
import {
  collapsePacsMirrorReports,
  pickPacsMirrorToKeep,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../../src/shared/radiology';

const PACS_ID = '01a0c95c-7620-7200-aac2-bdded8587cd9';
const AUTHOR = { reference: 'Practitioner/c822b761', display: 'Magnus Carlsen, PA' };

const report = (overrides: Partial<DiagnosticReport> & { id: string }): DiagnosticReport =>
  ({
    resourceType: 'DiagnosticReport',
    status: 'preliminary',
    code: {},
    ...overrides,
  }) as DiagnosticReport;

const mirrorOf = (pacsId: string, overrides: Partial<DiagnosticReport> & { id: string }): DiagnosticReport =>
  report({ identifier: [{ system: ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM, value: pacsId }], ...overrides });

describe('pickPacsMirrorToKeep', () => {
  it('keeps the read written here, so the PACS webhook never retires our own copy', () => {
    const webhookCopy = mirrorOf(PACS_ID, { id: 'webhook-copy' });
    const ourCopy = mirrorOf(PACS_ID, { id: 'our-copy', performer: [AUTHOR] });

    expect(pickPacsMirrorToKeep([webhookCopy, ourCopy]).id).toBe('our-copy');
    expect(pickPacsMirrorToKeep([ourCopy, webhookCopy]).id).toBe('our-copy');
  });

  it('keeps the most recent when neither copy was written here', () => {
    const older = mirrorOf(PACS_ID, { id: 'older', issued: '2026-09-22T13:44:35.000Z' });
    const newer = mirrorOf(PACS_ID, { id: 'newer', issued: '2026-09-22T13:44:36.000Z' });

    expect(pickPacsMirrorToKeep([older, newer]).id).toBe('newer');
  });
});

describe('collapsePacsMirrorReports', () => {
  it('keeps the authored copy when the webhook mirrored the same PACS report', () => {
    const webhookCopy = mirrorOf(PACS_ID, { id: 'webhook-copy' });
    const ourCopy = mirrorOf(PACS_ID, { id: 'our-copy', performer: [AUTHOR] });

    expect(collapsePacsMirrorReports([webhookCopy, ourCopy]).map((r) => r.id)).toEqual(['our-copy']);
  });

  it('keeps the authored copy whichever order the search returned the mirrors in', () => {
    const webhookCopy = mirrorOf(PACS_ID, { id: 'webhook-copy' });
    const ourCopy = mirrorOf(PACS_ID, { id: 'our-copy', performer: [AUTHOR] });

    expect(collapsePacsMirrorReports([ourCopy, webhookCopy]).map((r) => r.id)).toEqual(['our-copy']);
  });

  it('leaves a lone authorless read in place, so a read written outside this EHR stays uneditable', () => {
    const teleradiologyRead = mirrorOf(PACS_ID, { id: 'teleradiology-read', status: 'final' });

    expect(collapsePacsMirrorReports([teleradiologyRead]).map((r) => r.id)).toEqual(['teleradiology-read']);
  });

  it('never collapses reports that carry no PACS identifier, such as the preliminary snapshot', () => {
    const snapshot = report({ id: 'snapshot', performer: [AUTHOR] });
    const otherSnapshot = report({ id: 'other-snapshot' });

    expect(collapsePacsMirrorReports([snapshot, otherSnapshot]).map((r) => r.id)).toEqual([
      'snapshot',
      'other-snapshot',
    ]);
  });

  it('keeps mirrors of different PACS reports apart', () => {
    const first = mirrorOf('pacs-one', { id: 'first' });
    const second = mirrorOf('pacs-two', { id: 'second' });

    expect(collapsePacsMirrorReports([first, second]).map((r) => r.id)).toEqual(['first', 'second']);
  });

  it('falls back to the most recent mirror when none of them has an author', () => {
    const older = mirrorOf(PACS_ID, { id: 'older', issued: '2026-09-22T13:44:35.000Z' });
    const newer = mirrorOf(PACS_ID, { id: 'newer', issued: '2026-09-22T13:44:36.000Z' });

    expect(collapsePacsMirrorReports([older, newer]).map((r) => r.id)).toEqual(['newer']);
  });
});

describe('report selection with mirrored reports', () => {
  it('takes our preliminary read rather than the webhook copy that shadows it', () => {
    const webhookCopy = mirrorOf(PACS_ID, { id: 'webhook-copy' });
    const ourCopy = mirrorOf(PACS_ID, { id: 'our-copy', performer: [AUTHOR] });

    expect(takeMostRecentPreliminaryReport([webhookCopy, ourCopy])?.id).toBe('our-copy');
  });

  it('takes our final read rather than the webhook copy that shadows it', () => {
    const webhookCopy = mirrorOf(PACS_ID, { id: 'webhook-copy', status: 'final' });
    const ourCopy = mirrorOf(PACS_ID, { id: 'our-copy', status: 'final', performer: [AUTHOR] });

    expect(takeTheBestFinalDiagnosticReport([webhookCopy, ourCopy])?.id).toBe('our-copy');
  });

  it('still prefers an amended read over a final one', () => {
    const final = mirrorOf('pacs-one', { id: 'final', status: 'final', performer: [AUTHOR] });
    const amended = mirrorOf('pacs-two', { id: 'amended', status: 'amended' });

    expect(takeTheBestFinalDiagnosticReport([final, amended])?.id).toBe('amended');
  });
});
