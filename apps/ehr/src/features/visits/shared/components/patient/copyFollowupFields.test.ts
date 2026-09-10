/**
 * @vitest-environment node
 */

import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { describe, expect, it, vi } from 'vitest';
import { ChartDataApiClient, COPYABLE_FOLLOWUP_FIELDS, fetchCopySourceChartData } from './copyFollowupFields';

const chartWith = (overrides: Record<string, unknown> = {}): GetChartDataResponse =>
  ({ patientId: 'p1', patientHasPreviousVisits: false, ...overrides }) as unknown as GetChartDataResponse;

const fieldByKey = (key: string): NonNullable<(typeof COPYABLE_FOLLOWUP_FIELDS)[number]> =>
  COPYABLE_FOLLOWUP_FIELDS.find((f) => f.key === key)!;

describe('COPYABLE_FOLLOWUP_FIELDS', () => {
  it('has all six expected keys in declared order', () => {
    expect(COPYABLE_FOLLOWUP_FIELDS.map((f) => f.key)).toEqual([
      'chiefComplaint',
      'historyOfPresentIllness',
      'mechanismOfInjury',
      'diagnosis',
      'examObservations',
      'rosObservations',
    ]);
  });

  it('diagnosis is the only field WITHOUT extract (server-side handled)', () => {
    const noExtract = COPYABLE_FOLLOWUP_FIELDS.filter((f) => f.extract === undefined).map((f) => f.key);
    expect(noExtract).toEqual(['diagnosis']);
  });

  describe('Chief Complaint / HPI swap', () => {
    // "Chief Complaint" = the whole Chief Complaint section: staff-confirmed Reason for visit
    // (reasonForVisit) + Additional Information (historyOfPresentIllness, storage key swapped).
    // "HPI" = History of Present Illness, backed by the chiefComplaint key.
    const chiefComplaint = fieldByKey('chiefComplaint');
    const hpi = fieldByKey('historyOfPresentIllness');

    it('"Chief Complaint" copies both reasonForVisit and Additional Information', () => {
      const data = chartWith({
        reasonForVisit: { resourceId: 'rfv', text: 'ear pain' },
        historyOfPresentIllness: { resourceId: 'r1', text: 'sore throat' },
        chiefComplaint: { resourceId: 'r2', text: 'unused for this checkbox' },
      });
      expect(chiefComplaint.isEmpty(data)).toBe(false);
      expect(chiefComplaint.extract!(data)).toEqual({
        reasonForVisit: { resourceId: undefined, text: 'ear pain' },
        historyOfPresentIllness: { resourceId: undefined, text: 'sore throat' },
      });
    });

    it('"Chief Complaint" is non-empty when only reasonForVisit is present', () => {
      const data = chartWith({ reasonForVisit: { resourceId: 'rfv', text: 'ear pain' } });
      expect(chiefComplaint.isEmpty(data)).toBe(false);
      expect(chiefComplaint.extract!(data)).toEqual({
        reasonForVisit: { resourceId: undefined, text: 'ear pain' },
      });
    });

    it('"Chief Complaint" is non-empty when only Additional Information is present', () => {
      const data = chartWith({ historyOfPresentIllness: { resourceId: 'r1', text: 'sore throat' } });
      expect(chiefComplaint.isEmpty(data)).toBe(false);
      expect(chiefComplaint.extract!(data)).toEqual({
        historyOfPresentIllness: { resourceId: undefined, text: 'sore throat' },
      });
    });

    it('"HPI" reads from chiefComplaint storage', () => {
      const data = chartWith({ chiefComplaint: { resourceId: 'r2', text: 'narrative' } });
      expect(hpi.isEmpty(data)).toBe(false);
      expect(hpi.extract!(data)).toEqual({
        chiefComplaint: { resourceId: undefined, text: 'narrative' },
      });
    });

    it('both checkboxes are empty on an empty chart', () => {
      expect(chiefComplaint.isEmpty(chartWith())).toBe(true);
      expect(hpi.isEmpty(chartWith())).toBe(true);
    });

    it('"Chief Complaint" is empty when reasonForVisit text is blank', () => {
      // get-chart-data returns { text: '' } for an absent reason-for-visit extension.
      expect(chiefComplaint.isEmpty(chartWith({ reasonForVisit: { text: '' } }))).toBe(true);
    });
  });

  describe('Mechanism of Injury (bundled with accident)', () => {
    const field = fieldByKey('mechanismOfInjury');

    it('is empty when mechanism text, accident.date, and accident.type are all empty', () => {
      expect(field.isEmpty(chartWith())).toBe(true);
      expect(
        field.isEmpty(chartWith({ mechanismOfInjury: { resourceId: 'r', text: '   ' }, accident: { type: [] } }))
      ).toBe(true);
    });

    it('is non-empty when mechanism text alone is present', () => {
      expect(field.isEmpty(chartWith({ mechanismOfInjury: { resourceId: 'r', text: 'fell down stairs' } }))).toBe(
        false
      );
    });

    it('is non-empty when only accident.date is present', () => {
      expect(field.isEmpty(chartWith({ accident: { date: '2025-01-01' } }))).toBe(false);
    });

    it('is non-empty when only accident.type is present', () => {
      expect(field.isEmpty(chartWith({ accident: { type: [{ code: { coding: [{ code: 'WORK' }] } }] } }))).toBe(false);
    });

    it('extract returns both mechanismOfInjury and accident, with resourceIds stripped', () => {
      const data = chartWith({
        mechanismOfInjury: { resourceId: 'm1', text: 'slip' },
        accident: { resourceId: 'a1', date: '2025-01-01', type: [] },
      });
      expect(field.extract!(data)).toEqual({
        mechanismOfInjury: { resourceId: undefined, text: 'slip' },
        accident: { resourceId: undefined, date: '2025-01-01', type: [] },
      });
    });
  });

  describe('array fields', () => {
    it.each([['diagnosis'], ['examObservations'], ['rosObservations']] as const)(
      '%s is empty on missing/empty array',
      (key) => {
        const field = fieldByKey(key);
        expect(field.isEmpty(chartWith())).toBe(true);
        expect(field.isEmpty(chartWith({ [key]: [] }))).toBe(true);
      }
    );

    it('examObservations extract strips resourceIds from every element', () => {
      const data = chartWith({
        examObservations: [
          { resourceId: 'e1', field: 'hr', value: true },
          { resourceId: 'e2', field: 'rr', value: false },
        ],
      });
      expect(fieldByKey('examObservations').extract!(data)).toEqual({
        examObservations: [
          { resourceId: undefined, field: 'hr', value: true },
          { resourceId: undefined, field: 'rr', value: false },
        ],
      });
    });
  });
});

describe('fetchCopySourceChartData', () => {
  const emptyNote = (): VisitNoteResponse =>
    ({
      patientId: 'p1',
      encounterNotes: { reasonForVisit: { text: '' } },
      history: {
        allergies: [],
        conditions: [],
        medications: [],
        inhouseMedications: [],
        surgicalHistory: [],
        episodeOfCare: [],
        birthHistory: [],
        practitioners: [],
      },
      screening: { observations: [] },
      exam: { examObservations: [], rosObservations: [] },
      assessment: { diagnosis: [], cptCodes: [], procedures: [] },
      plan: {
        instructions: [],
        schoolWorkNotes: [],
        prescribedMedications: [],
        preferredPharmacies: [],
        practitioners: [],
      },
      notes: { notes: [] },
      aiChat: { aiChat: { documents: [], providers: [] }, observations: [] },
      vitalsObservations: [],
      externalLabResults: { labOrderResults: [] },
      inHouseLabResults: { labOrderResults: [] },
      radiologyOrders: [],
      practitioners: [],
      patientHasPreviousVisits: false,
    }) as unknown as VisitNoteResponse;

  const makeClient = (
    note: VisitNoteResponse
  ): { client: ChartDataApiClient; getVisitNote: ReturnType<typeof vi.fn> } => {
    const getVisitNote = vi.fn().mockResolvedValue(note);
    return { client: { getVisitNote }, getVisitNote };
  };

  it('reads the source visit once, as a visit note', async () => {
    const { client, getVisitNote } = makeClient(emptyNote());
    await fetchCopySourceChartData(client, 'enc-1');
    expect(getVisitNote).toHaveBeenCalledTimes(1);
    expect(getVisitNote).toHaveBeenCalledWith({ encounterId: 'enc-1' });
  });

  it('presents the note fields, the diagnoses and the exam in the whole-chart shape the copy configs read', async () => {
    const note = emptyNote();
    note.encounterNotes = {
      chiefComplaint: { resourceId: 'r1', text: 'A' },
      historyOfPresentIllness: { resourceId: 'r2', text: 'B' },
      mechanismOfInjury: { resourceId: 'r3', text: 'C' },
      accident: { resourceId: 'r4', type: ['AA'], date: '2025-01-01' },
      reasonForVisit: { text: 'ear pain' },
    };
    note.assessment.diagnosis = [{ resourceId: 'd1', code: 'J02.9', display: 'Dx', isPrimary: true }];
    note.exam.examObservations = [{ resourceId: 'e1', field: 'hr', value: true }];
    note.exam.rosObservations = [{ resourceId: 'ro1', field: 'general', value: true }];
    const { client } = makeClient(note);
    const result = await fetchCopySourceChartData(client, 'enc-1');
    expect(result.chiefComplaint).toEqual(note.encounterNotes.chiefComplaint);
    expect(result.historyOfPresentIllness).toEqual(note.encounterNotes.historyOfPresentIllness);
    expect(result.mechanismOfInjury).toEqual(note.encounterNotes.mechanismOfInjury);
    expect(result.accident).toEqual(note.encounterNotes.accident);
    expect(result.reasonForVisit).toEqual(note.encounterNotes.reasonForVisit);
    expect(result.diagnosis).toEqual(note.assessment.diagnosis);
    expect(result.examObservations).toEqual(note.exam.examObservations);
    expect(result.rosObservations).toEqual(note.exam.rosObservations);
  });

  it('leaves absent single-valued fields undefined', async () => {
    const { client } = makeClient(emptyNote());
    const result = await fetchCopySourceChartData(client, 'enc-1');
    expect(result.chiefComplaint).toBeUndefined();
    expect(result.accident).toBeUndefined();
    expect(result.reasonForVisit).toEqual({ text: '' });
  });

  it('propagates rejections from get-visit-note so callers can handle them', async () => {
    const client = { getVisitNote: vi.fn().mockRejectedValue(new Error('forbidden')) };
    await expect(fetchCopySourceChartData(client, 'enc-1')).rejects.toThrow('forbidden');
  });
});
