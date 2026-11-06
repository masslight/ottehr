import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter } from 'fhir/r4b';
import { buildFollowupEncounterType, FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { FAX_PACKET_CODE, MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { describe, expect, it, vi } from 'vitest';
import {
  collectPatientRecordAttachments,
  getPatientRecordDateSpan,
  getPatientRecordDocuments,
} from '../../src/shared/patient-documents';

const documentReference = (id: string, url: string, code?: string): DocumentReference => ({
  resourceType: 'DocumentReference',
  id,
  status: 'current',
  date: '2026-05-05T13:30:00.000Z',
  subject: { reference: 'Patient/patient-1' },
  type: code ? { coding: [{ code }] } : undefined,
  content: [{ attachment: { url, title: `${id}.pdf`, contentType: 'application/pdf' } }],
});

const dated = (id: string, date: string | undefined, context?: DocumentReference['context']): DocumentReference => ({
  ...documentReference(id, `https://z3.example/${id}.pdf`),
  date,
  ...(context && { context }),
});

const oystehrWith = (byType: Record<string, unknown[]>): Oystehr =>
  ({
    fhir: {
      search: vi.fn(({ resourceType }: { resourceType: string }) =>
        Promise.resolve({ unbundle: () => byType[resourceType] ?? [] })
      ),
    },
  }) as unknown as Oystehr;

describe('collectPatientRecordAttachments', () => {
  it('keeps generated exports and sent packets out of a downloaded medical-record archive', () => {
    const attachments = collectPatientRecordAttachments([
      documentReference('clinical-document', 'https://z3.example/clinical-document.pdf'),
      documentReference('old-archive', 'https://z3.example/old-archive.zip', MEDICAL_RECORD_EXPORT_CODE),
      documentReference('sent-fax', 'https://z3.example/sent-fax.pdf', FAX_PACKET_CODE),
    ]);

    expect(attachments).toEqual([
      {
        url: 'https://z3.example/clinical-document.pdf',
        title: 'clinical-document.pdf',
        contentType: 'application/pdf',
        date: '2026-05-05T13:30:00.000Z',
      },
    ]);
  });
});

describe('getPatientRecordDocuments', () => {
  const MARCH = { from: '2026-03-01T00:00:00.000-05:00', to: '2026-03-31T23:59:59.999-04:00' };

  it('dates visit documents by their visit and everything else by when it was created', async () => {
    const oystehr = oystehrWith({
      DocumentReference: [
        dated('paperwork-before-visit', '2026-02-25T09:00:00.000Z', {
          related: [{ reference: 'Appointment/appointment-march' }],
        }),
        dated('note-after-visit', '2026-04-02T09:00:00.000Z', {
          encounter: [{ reference: 'Encounter/encounter-march' }],
        }),
        dated('march-upload', '2026-03-15T12:00:00.000Z', { related: [{ reference: 'Patient/patient-1' }] }),
        dated('april-upload', '2026-04-15T12:00:00.000Z'),
        dated('undated', undefined),
      ],
      Appointment: [{ resourceType: 'Appointment', id: 'appointment-march', start: '2026-03-10T14:00:00.000Z' }],
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'encounter-march',
          appointment: [{ reference: 'Appointment/appointment-march' }],
        },
      ],
    });

    const documents = await getPatientRecordDocuments(oystehr, 'patient-1', MARCH);

    expect(documents.map((document) => document.id)).toEqual([
      'paperwork-before-visit',
      'note-after-visit',
      'march-upload',
    ]);
  });

  it('keeps what falls exactly on either bound and drops the next millisecond past it', async () => {
    const oystehr = oystehrWith({
      DocumentReference: [
        dated('just-before-from', '2026-03-01T04:59:59.999Z'),
        dated('on-from', '2026-03-01T05:00:00.000Z'),
        dated('on-to', '2026-04-01T03:59:59.999Z'),
        dated('just-after-to', '2026-04-01T04:00:00.000Z'),
        dated('paperwork-for-visit-on-from', '2026-02-27T12:00:00.000Z', {
          related: [{ reference: 'Appointment/visit-on-from' }],
        }),
        dated('paperwork-for-visit-just-after-to', '2026-03-31T12:00:00.000Z', {
          related: [{ reference: 'Appointment/visit-just-after-to' }],
        }),
      ],
      Appointment: [
        { resourceType: 'Appointment', id: 'visit-on-from', start: '2026-03-01T05:00:00.000Z' },
        { resourceType: 'Appointment', id: 'visit-just-after-to', start: '2026-04-01T04:00:00.000Z' },
      ],
    });

    const documents = await getPatientRecordDocuments(oystehr, 'patient-1', MARCH);

    expect(documents.map((document) => document.id)).toEqual(['on-from', 'on-to', 'paperwork-for-visit-on-from']);
  });
});

describe('getPatientRecordDateSpan', () => {
  const firstVisit = { resourceType: 'Appointment', id: 'appointment-first', start: '2026-03-10T14:00:00.000Z' };
  const upcomingVisit = { resourceType: 'Appointment', id: 'appointment-upcoming', start: '2026-11-02T15:00:00.000Z' };

  it('spans from a per-patient upload before the first visit to paperwork for an upcoming visit', async () => {
    const oystehr = oystehrWith({
      DocumentReference: [
        dated('insurance-card', '2026-01-20T16:00:00.000Z'),
        dated('first-visit-note', '2026-03-11T09:00:00.000Z', {
          related: [{ reference: 'Appointment/appointment-first' }],
        }),
        dated('upcoming-visit-consent', '2026-10-12T09:00:00.000Z', {
          related: [{ reference: 'Appointment/appointment-upcoming' }],
        }),
      ],
      Appointment: [firstVisit, upcomingVisit],
    });

    expect(await getPatientRecordDateSpan(oystehr, 'patient-1')).toEqual({
      earliest: '2026-01-20T16:00:00.000Z',
      latest: '2026-11-02T15:00:00.000Z',
    });
  });

  it('ignores what an export leaves out: archives, sent faxes, attachment-less and undated documents', async () => {
    const oystehr = oystehrWith({
      DocumentReference: [
        dated('clinical-note', '2026-03-11T09:00:00.000Z'),
        {
          ...dated('old-archive', '2025-01-01T00:00:00.000Z'),
          type: { coding: [{ code: MEDICAL_RECORD_EXPORT_CODE }] },
        },
        { ...dated('sent-fax', '2027-01-01T00:00:00.000Z'), type: { coding: [{ code: FAX_PACKET_CODE }] } },
        { ...dated('no-attachment', '2025-06-01T00:00:00.000Z'), content: [{ attachment: {} }] },
        dated('undated', undefined),
      ],
    });

    expect(await getPatientRecordDateSpan(oystehr, 'patient-1')).toEqual({
      earliest: '2026-03-11T09:00:00.000Z',
      latest: '2026-03-11T09:00:00.000Z',
    });
  });

  it('returns no dates when nothing would be exported', async () => {
    const oystehr = oystehrWith({ DocumentReference: [dated('undated', undefined)] });

    expect(await getPatientRecordDateSpan(oystehr, 'patient-1')).toEqual({});
  });
});

describe('annotation follow-up documents', () => {
  const OCTOBER = { from: '2026-10-01T00:00:00.000-04:00', to: '2026-10-31T23:59:59.999-04:00' };
  const SEPTEMBER = { from: '2026-09-01T00:00:00.000-04:00', to: '2026-09-30T23:59:59.999-04:00' };
  const SEPTEMBER_THROUGH_OCTOBER = { from: '2026-09-01T00:00:00.000-04:00', to: '2026-10-31T23:59:59.999-04:00' };
  const MAIN_VISIT_DAY = { from: '2026-09-14T00:00:00.000-04:00', to: '2026-09-14T23:59:59.999-04:00' };

  const MAIN_VISIT_START = '2026-09-14T14:00:00.000Z';
  const FOLLOW_UP_START = '2026-10-23T15:00:00.000Z';

  const mainAppointment = { resourceType: 'Appointment', id: 'appointment-main', start: MAIN_VISIT_START };
  const mainEncounter: Encounter = {
    resourceType: 'Encounter',
    id: 'encounter-main',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/appointment-main' }],
  };
  const followUpEncounter = (over: Partial<Encounter> = {}): Encounter => ({
    resourceType: 'Encounter',
    id: 'encounter-follow-up',
    status: 'finished',
    class: { code: 'VR' },
    type: buildFollowupEncounterType('annotation'),
    partOf: { reference: 'Encounter/encounter-main' },
    appointment: [{ reference: 'Appointment/appointment-main' }],
    period: { start: FOLLOW_UP_START },
    ...over,
  });
  const freeFormEncounter: Encounter = {
    resourceType: 'Encounter',
    id: 'encounter-free-form',
    status: 'finished',
    class: { code: 'VR' },
    type: buildFollowupEncounterType('free-form'),
    period: { start: '2026-10-10T12:00:00.000Z', end: '2026-10-10T12:00:00.000Z' },
  };
  const scheduledAppointment = {
    resourceType: 'Appointment',
    id: 'appointment-scheduled',
    start: '2026-10-23T15:00:00.000Z',
  };
  const scheduledEncounter = followUpEncounter({
    id: 'encounter-scheduled',
    type: buildFollowupEncounterType('scheduled'),
    appointment: [{ reference: 'Appointment/appointment-scheduled' }],
    period: { start: '2026-10-25T15:00:00.000Z' },
  });
  const typeWithoutSubtype: Encounter['type'] = [
    { coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] },
  ];

  const mainNote = dated('main-note', '2026-10-05T09:00:00.000Z', {
    related: [{ reference: 'Appointment/appointment-main' }],
    encounter: [{ reference: 'Encounter/encounter-main' }],
  });
  const mainUpload = dated('main-upload', '2026-10-06T09:00:00.000Z', {
    encounter: [{ reference: 'Encounter/encounter-main' }],
  });
  const followUpNote = dated('follow-up-note', '2026-11-02T09:00:00.000Z', {
    related: [{ reference: 'Appointment/appointment-main' }],
    encounter: [{ reference: 'Encounter/encounter-follow-up' }],
  });
  const followUpUpload = dated('follow-up-upload', '2026-11-03T09:00:00.000Z', {
    encounter: [{ reference: 'Encounter/encounter-follow-up' }],
  });
  const followUpLabResult = dated('follow-up-lab-result', '2026-11-04T09:00:00.000Z', {
    related: [{ reference: 'DiagnosticReport/lab-result' }],
    encounter: [{ reference: 'Encounter/encounter-follow-up' }],
  });
  const freeFormAttachment = dated('free-form-attachment', '2026-11-06T09:00:00.000Z', {
    encounter: [{ reference: 'Encounter/encounter-free-form' }],
  });
  const visitDocuments = [mainNote, mainUpload, followUpNote, followUpUpload, followUpLabResult];

  const visitWith = (documents: DocumentReference[], encounters: Encounter[]): Oystehr =>
    oystehrWith({ DocumentReference: documents, Appointment: [mainAppointment], Encounter: encounters });

  const idsWithin = async (oystehr: Oystehr, range: typeof OCTOBER): Promise<(string | undefined)[]> =>
    (await getPatientRecordDocuments(oystehr, 'patient-1', range)).map((document) => document.id);

  it("keeps a follow-up's documents in the follow-up's range and leaves the main visit's out", async () => {
    expect(await idsWithin(visitWith(visitDocuments, [mainEncounter, followUpEncounter()]), OCTOBER)).toEqual([
      'follow-up-note',
      'follow-up-upload',
      'follow-up-lab-result',
    ]);
  });

  it("keeps the main visit's documents in its range and leaves the follow-up's out", async () => {
    expect(await idsWithin(visitWith(visitDocuments, [mainEncounter, followUpEncounter()]), SEPTEMBER)).toEqual([
      'main-note',
      'main-upload',
    ]);
  });

  it('keeps both when the range spans both visits', async () => {
    expect(
      await idsWithin(visitWith(visitDocuments, [mainEncounter, followUpEncounter()]), SEPTEMBER_THROUGH_OCTOBER)
    ).toEqual(['main-note', 'main-upload', 'follow-up-note', 'follow-up-upload', 'follow-up-lab-result']);
  });

  it('leaves a follow-up out of a range covering only the main visit day', async () => {
    expect(await idsWithin(visitWith(visitDocuments, [mainEncounter, followUpEncounter()]), MAIN_VISIT_DAY)).toEqual([
      'main-note',
      'main-upload',
    ]);
  });

  it('spans from the main visit to its follow-up', async () => {
    expect(
      await getPatientRecordDateSpan(visitWith(visitDocuments, [mainEncounter, followUpEncounter()]), 'patient-1')
    ).toEqual({ earliest: MAIN_VISIT_START, latest: FOLLOW_UP_START });
  });

  it('keeps a free-form encounter from pulling in or pushing out the visits around it', async () => {
    const oystehr = visitWith(
      [...visitDocuments, freeFormAttachment],
      [mainEncounter, followUpEncounter(), freeFormEncounter]
    );

    expect(await idsWithin(oystehr, OCTOBER)).toEqual([
      'follow-up-note',
      'follow-up-upload',
      'follow-up-lab-result',
      'free-form-attachment',
    ]);
    expect(await idsWithin(oystehr, SEPTEMBER)).toEqual(['main-note', 'main-upload']);
  });

  const datingCases: {
    name: string;
    document: DocumentReference;
    encounters: Encounter[];
    appointments?: unknown[];
    expected: string;
  }[] = [
    {
      name: 'a follow-up document with related and encounter by the follow-up',
      document: followUpNote,
      encounters: [mainEncounter, followUpEncounter()],
      expected: FOLLOW_UP_START,
    },
    {
      name: 'a follow-up document with only an encounter by the follow-up',
      document: followUpUpload,
      encounters: [mainEncounter, followUpEncounter()],
      expected: FOLLOW_UP_START,
    },
    {
      name: 'a main visit document with related and encounter by the main visit',
      document: mainNote,
      encounters: [mainEncounter, followUpEncounter()],
      expected: MAIN_VISIT_START,
    },
    {
      name: 'a main visit document with only an encounter by the main visit',
      document: mainUpload,
      encounters: [mainEncounter, followUpEncounter()],
      expected: MAIN_VISIT_START,
    },
    {
      name: 'a follow-up without a period start by its status history',
      document: followUpNote,
      encounters: [
        mainEncounter,
        followUpEncounter({
          period: undefined,
          statusHistory: [{ status: 'finished', period: { start: '2026-10-25T18:00:00.000Z' } }],
        }),
      ],
      expected: '2026-10-25T18:00:00.000Z',
    },
    {
      name: 'a follow-up with no start at all by the document date, never the main visit',
      document: followUpNote,
      encounters: [mainEncounter, followUpEncounter({ period: undefined })],
      expected: '2026-11-02T09:00:00.000Z',
    },
    {
      name: 'a follow-up without a subtype coding by its own date',
      document: followUpUpload,
      encounters: [mainEncounter, followUpEncounter({ type: typeWithoutSubtype })],
      expected: FOLLOW_UP_START,
    },
    {
      name: 'a follow-up without a subtype coding, with related and encounter, by its own date',
      document: followUpNote,
      encounters: [mainEncounter, followUpEncounter({ type: typeWithoutSubtype })],
      expected: FOLLOW_UP_START,
    },
    {
      name: 'a scheduled follow-up document by its own appointment',
      document: dated('scheduled-note', '2026-11-02T09:00:00.000Z', {
        related: [{ reference: 'Appointment/appointment-scheduled' }],
        encounter: [{ reference: 'Encounter/encounter-scheduled' }],
      }),
      encounters: [mainEncounter, scheduledEncounter],
      appointments: [mainAppointment, scheduledAppointment],
      expected: '2026-10-23T15:00:00.000Z',
    },
    {
      name: 'an unresolved encounter with a related appointment by the appointment',
      document: dated('orphan-note', '2026-11-02T09:00:00.000Z', {
        related: [{ reference: 'Appointment/appointment-main' }],
        encounter: [{ reference: 'Encounter/missing' }],
      }),
      encounters: [mainEncounter],
      expected: MAIN_VISIT_START,
    },
    {
      name: 'an unresolved encounter alone by the document date',
      document: dated('orphan-upload', '2026-11-03T09:00:00.000Z', {
        encounter: [{ reference: 'Encounter/missing' }],
      }),
      encounters: [mainEncounter],
      expected: '2026-11-03T09:00:00.000Z',
    },
    {
      name: 'a document naming both the main visit and its follow-up by the follow-up',
      document: dated('two-encounters', '2026-11-02T09:00:00.000Z', {
        related: [{ reference: 'Appointment/appointment-main' }],
        encounter: [{ reference: 'Encounter/encounter-main' }, { reference: 'Encounter/encounter-follow-up' }],
      }),
      encounters: [mainEncounter, followUpEncounter()],
      expected: FOLLOW_UP_START,
    },
    {
      name: 'a free-form encounter document by its own date',
      document: freeFormAttachment,
      encounters: [freeFormEncounter],
      expected: '2026-10-10T12:00:00.000Z',
    },
    {
      name: 'a free-form encounter document with a related appointment by the appointment',
      document: dated('free-form-with-appointment', '2026-11-06T09:00:00.000Z', {
        related: [{ reference: 'Appointment/appointment-main' }],
        encounter: [{ reference: 'Encounter/encounter-free-form' }],
      }),
      encounters: [mainEncounter, freeFormEncounter],
      expected: MAIN_VISIT_START,
    },
    {
      name: 'a parentless follow-up without a subtype coding, with a related appointment, by the appointment',
      document: dated('legacy-parentless-with-appointment', '2026-11-06T09:00:00.000Z', {
        related: [{ reference: 'Appointment/appointment-main' }],
        encounter: [{ reference: 'Encounter/encounter-legacy-parentless' }],
      }),
      encounters: [
        mainEncounter,
        followUpEncounter({
          id: 'encounter-legacy-parentless',
          type: typeWithoutSubtype,
          partOf: undefined,
          appointment: undefined,
          period: { start: '2026-10-10T12:00:00.000Z' },
        }),
      ],
      expected: MAIN_VISIT_START,
    },
  ];

  it.each(datingCases.map((datingCase) => [datingCase.name, datingCase] as const))(
    'dates %s',
    async (_name, { document, encounters, appointments = [mainAppointment], expected }) => {
      const oystehr = oystehrWith({ DocumentReference: [document], Appointment: appointments, Encounter: encounters });

      expect(await getPatientRecordDateSpan(oystehr, 'patient-1')).toEqual({ earliest: expected, latest: expected });
    }
  );
});
