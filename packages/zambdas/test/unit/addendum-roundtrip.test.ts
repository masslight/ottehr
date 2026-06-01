import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { NOTE_TYPE, NoteDTO } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { makeNoteDTO, makeNoteResource, prepareAddendumNotes } from '../../src/shared/chart-data';
import { composePlanData } from '../../src/shared/pdf/sections/visit-note/plan';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const makeFakeOystehr = (existing: Communication[]): Oystehr =>
  ({
    fhir: {
      search: vi.fn(async () => ({
        unbundle: () => existing,
      })),
    },
  }) as unknown as Oystehr;

describe('addendum round-trip: DTO → Communication → DTO → PDF data', () => {
  it('preserves the soft-deleted state from saveChartData through the PDF composer', () => {
    const inputDTO: NoteDTO = {
      type: NOTE_TYPE.ADDENDUM,
      text: 'Late lab review',
      authorId: 'prac-1',
      authorName: 'Dr. Smith',
      patientId: 'pat-1',
      encounterId: 'enc-1',
      resourceId: 'comm-1',
      deleted: true,
    };

    // 1) FE/BE: NoteDTO → FHIR Communication (this is what save-chart-data PUTs). Reuse the
    //    prior resource's `sent` so the original creation timestamp is preserved on edit.
    const priorResource: Communication = {
      resourceType: 'Communication',
      id: 'comm-1',
      status: 'completed',
      sent: '2026-05-21T10:00:00.000Z',
    };
    const communication = makeNoteResource('enc-1', 'pat-1', inputDTO, priorResource);
    expect(communication.status).toBe('entered-in-error');
    expect(communication.sent).toBe('2026-05-21T10:00:00.000Z');

    // 2) Simulate FHIR returning that Communication on a later search (meta.lastUpdated bumped
    //    server-side when status was flipped to entered-in-error)
    communication.meta = { ...communication.meta, lastUpdated: '2026-05-21T15:48:00.000Z' };

    // 3) get-chart-data: Communication → NoteDTO
    const dtoFromServer = makeNoteDTO(communication);
    expect(dtoFromServer.deleted).toBe(true);
    expect(dtoFromServer.edited).toBe(true);
    expect(dtoFromServer.lastUpdated).toBe('2026-05-21T15:48:00.000Z');

    // 4) PDF composer: NoteDTO[] → PlanData.addendumNotes[]
    const allChartData: AllChartData = {
      chartData: { patientId: 'pat-1' } as AllChartData['chartData'],
      additionalChartData: { patientId: 'pat-1', notes: [dtoFromServer] } as AllChartData['additionalChartData'],
    };
    const plan = composePlanData({ allChartData });
    expect(plan.addendumNotes).toHaveLength(1);
    expect(plan.addendumNotes?.[0].deleted).toBe(true);
    expect(plan.addendumNotes?.[0].edited).toBe(false);
  });

  it('end-to-end soft delete: FE payload → authorize → makeNoteResource → status entered-in-error', async () => {
    // Simulate the resource already on the server (created earlier as a completed addendum)
    const existing: Communication = {
      resourceType: 'Communication',
      id: 'comm-1',
      status: 'completed',
      sender: { reference: 'Practitioner/prac-1', display: 'Dr. Smith' },
      sent: '2026-05-21T10:00:00.000Z',
      payload: [{ contentString: 'Original text' }],
    };

    // Exact payload the FE sends from useSoftDeleteNote.
    const fePayload: NoteDTO = {
      resourceId: 'comm-1',
      type: NOTE_TYPE.ADDENDUM,
      text: 'Original text',
      authorId: 'prac-1',
      authorName: 'Dr. Smith',
      patientId: 'pat-1',
      encounterId: 'enc-1',
      deleted: true,
    };

    const oystehr = makeFakeOystehr([existing]);
    const notes = [fePayload];
    const existingByAddendumId = await prepareAddendumNotes(oystehr, notes, 'prac-1', 'Dr. Smith');

    // After authorize, `deleted: true` MUST survive — otherwise makeNoteResource
    // won't flip status and the PDF will mis-render as "(edited)".
    expect(notes[0].deleted).toBe(true);
    expect(existingByAddendumId.get('comm-1')?.sent).toBe('2026-05-21T10:00:00.000Z');

    const resource = makeNoteResource('enc-1', 'pat-1', notes[0], existingByAddendumId.get('comm-1'));
    expect(resource.status).toBe('entered-in-error');
    expect(resource.sent).toBe('2026-05-21T10:00:00.000Z');
  });
});
