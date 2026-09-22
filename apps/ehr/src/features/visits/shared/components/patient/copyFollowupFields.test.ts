/**
 * @vitest-environment node
 */

import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
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

    it('extract returns both mechanismOfInjury and accident, with resourceIds dropped', () => {
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

    it('examObservations extract drops resourceIds when there is no target to overwrite', () => {
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
  const makeClient = (
    noteFields: Record<string, unknown>,
    fullChart: Record<string, unknown>
  ): { client: ChartDataApiClient; getChartData: ReturnType<typeof vi.fn> } => {
    const getChartData = vi.fn().mockImplementation((params: { requestedFields?: unknown }) => {
      return Promise.resolve(params.requestedFields ? noteFields : fullChart);
    });
    return { client: { getChartData }, getChartData };
  };

  it('issues two get-chart-data calls in parallel — one scoped, one unscoped', async () => {
    const { client, getChartData } = makeClient({}, {});
    await fetchCopySourceChartData(client, 'enc-1');
    expect(getChartData).toHaveBeenCalledTimes(2);
    const calls = getChartData.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.requestedFields)).toBe(true);
    expect(calls.some((c) => !c.requestedFields)).toBe(true);
  });

  it('takes scalar note fields from the scoped call and array fields from the unscoped one', async () => {
    const note = {
      chiefComplaint: { resourceId: 'r1', text: 'A' },
      historyOfPresentIllness: { resourceId: 'r2', text: 'B' },
      mechanismOfInjury: { resourceId: 'r3', text: 'C' },
      accident: { resourceId: 'r4', date: '2025-01-01' },
      reasonForVisit: { text: 'ear pain' },
    };
    const full = {
      diagnosis: [{ resourceId: 'd1', display: 'Dx' }],
      examObservations: [{ resourceId: 'e1', field: 'hr' }],
      rosObservations: [{ resourceId: 'ro1', field: 'general' }],
    };
    const { client } = makeClient(note, full);
    const result = await fetchCopySourceChartData(client, 'enc-1');
    expect(result.chiefComplaint).toEqual(note.chiefComplaint);
    expect(result.historyOfPresentIllness).toEqual(note.historyOfPresentIllness);
    expect(result.mechanismOfInjury).toEqual(note.mechanismOfInjury);
    expect(result.accident).toEqual(note.accident);
    expect(result.reasonForVisit).toEqual(note.reasonForVisit);
    expect(result.diagnosis).toEqual(full.diagnosis);
    expect(result.examObservations).toEqual(full.examObservations);
    expect(result.rosObservations).toEqual(full.rosObservations);
  });

  it('treats empty-array scalar response as undefined (get-chart-data init artifact)', async () => {
    // get-chart-data inits requested fields to []; a scalar left as [] means "no data".
    const { client } = makeClient({ chiefComplaint: [], historyOfPresentIllness: { resourceId: 'r1', text: 'B' } }, {});
    const result = await fetchCopySourceChartData(client, 'enc-1');
    expect(result.chiefComplaint).toBeUndefined();
    expect(result.historyOfPresentIllness).toEqual({ resourceId: 'r1', text: 'B' });
  });

  it('propagates rejections from get-chart-data so callers can handle them', async () => {
    const client = { getChartData: vi.fn().mockRejectedValue(new Error('forbidden')) };
    await expect(fetchCopySourceChartData(client, 'enc-1')).rejects.toThrow('forbidden');
  });

  it('never falls back to the unscoped accident (it can belong to a different visit)', async () => {
    // Scoped call (selected visit) has no accident; unscoped call returns one from another
    // visit (its Conditions are fetched by-patient). The result must stay undefined. (OTR-2467)
    const { client } = makeClient({}, { accident: { resourceId: 'other-visit', date: '2020-01-01' } });
    const result = await fetchCopySourceChartData(client, 'enc-1');
    expect(result.accident).toBeUndefined();
  });
});

describe('copying onto an already-documented encounter', () => {
  const exam = fieldByKey('examObservations');
  const ros = fieldByKey('rosObservations');

  it('reuses the target observation id for a field both visits documented', () => {
    const source = chartWith({ examObservations: [{ resourceId: 'src-1', field: 'hr', value: true }] });
    const target = chartWith({ examObservations: [{ resourceId: 'tgt-1', field: 'hr', value: false }] });
    expect(exam.extract!(source, target)).toEqual({
      examObservations: [{ resourceId: 'tgt-1', field: 'hr', value: true }],
    });
    expect(exam.stale!(source, target)).toEqual({});
  });

  it('creates a fresh observation for a field only the initial visit has', () => {
    const source = chartWith({ examObservations: [{ resourceId: 'src-1', field: 'hr', value: true }] });
    const target = chartWith({ examObservations: [{ resourceId: 'tgt-2', field: 'rr', value: true }] });
    expect(exam.extract!(source, target)).toEqual({
      examObservations: [{ resourceId: undefined, field: 'hr', value: true }],
    });
  });

  it('marks target observations the initial visit never touched as stale', () => {
    const source = chartWith({ examObservations: [{ resourceId: 'src-1', field: 'hr', value: true }] });
    const target = chartWith({
      examObservations: [
        { resourceId: 'tgt-1', field: 'hr', value: false },
        { resourceId: 'tgt-2', field: 'rr', value: true },
      ],
    });
    expect(exam.stale!(source, target)).toEqual({
      examObservations: [{ resourceId: 'tgt-2', field: 'rr', value: true }],
    });
  });

  it('sweeps a duplicate row an earlier copy left behind', () => {
    const source = chartWith({ examObservations: [{ resourceId: 'src-1', field: 'hr', value: true }] });
    const target = chartWith({
      examObservations: [
        { resourceId: 'tgt-1', field: 'hr', value: false },
        { resourceId: 'tgt-1-dup', field: 'hr', value: true },
      ],
    });
    const written = exam.extract!(source, target).examObservations!;
    expect(written).toHaveLength(1);
    // Exactly one of the two is overwritten; the other has to go or the field stays doubled up.
    expect(exam.stale!(source, target).examObservations).toEqual([
      target.examObservations!.find((o) => o.resourceId !== written[0].resourceId),
    ]);
  });

  it('treats ROS the same way as the exam', () => {
    const source = chartWith({ rosObservations: [{ resourceId: 'src-1', field: 'general', value: true }] });
    const target = chartWith({
      rosObservations: [
        { resourceId: 'tgt-1', field: 'general', value: false },
        { resourceId: 'tgt-2', field: 'skin', value: true },
      ],
    });
    expect(ros.extract!(source, target)).toEqual({
      rosObservations: [{ resourceId: 'tgt-1', field: 'general', value: true }],
    });
    expect(ros.stale!(source, target)).toEqual({
      rosObservations: [{ resourceId: 'tgt-2', field: 'skin', value: true }],
    });
  });

  it('overwrites the target Conditions behind Chief Complaint and HPI', () => {
    const source = chartWith({
      reasonForVisit: { text: 'ear pain' },
      historyOfPresentIllness: { resourceId: 'src-hpi', text: 'from the initial visit' },
      chiefComplaint: { resourceId: 'src-cc', text: 'narrative' },
    });
    const target = chartWith({
      reasonForVisit: { text: 'sore throat' },
      historyOfPresentIllness: { resourceId: 'tgt-hpi', text: 'typed on this visit' },
      chiefComplaint: { resourceId: 'tgt-cc', text: 'also typed here' },
    });
    expect(fieldByKey('chiefComplaint').extract!(source, target)).toEqual({
      reasonForVisit: { resourceId: undefined, text: 'ear pain' },
      historyOfPresentIllness: { resourceId: 'tgt-hpi', text: 'from the initial visit' },
    });
    expect(fieldByKey('historyOfPresentIllness').extract!(source, target)).toEqual({
      chiefComplaint: { resourceId: 'tgt-cc', text: 'narrative' },
    });
  });

  it('drops the target Additional Information when the initial visit has none', () => {
    // The checkbox is still offered: the initial visit has a reason for visit to copy.
    const source = chartWith({ reasonForVisit: { text: 'ear pain' } });
    const target = chartWith({ historyOfPresentIllness: { resourceId: 'tgt-hpi', text: 'typed on this visit' } });
    expect(fieldByKey('chiefComplaint').stale!(source, target)).toEqual({
      historyOfPresentIllness: { resourceId: 'tgt-hpi', text: 'typed on this visit' },
    });
  });

  it('drops the target accident when the initial visit only has a mechanism', () => {
    const source = chartWith({ mechanismOfInjury: { resourceId: 'src-m', text: 'slip' } });
    const target = chartWith({
      mechanismOfInjury: { resourceId: 'tgt-m', text: 'fall' },
      accident: { resourceId: 'tgt-a', date: '2025-01-01', type: [] },
    });
    expect(fieldByKey('mechanismOfInjury').extract!(source, target)).toEqual({
      mechanismOfInjury: { resourceId: 'tgt-m', text: 'slip' },
    });
    expect(fieldByKey('mechanismOfInjury').stale!(source, target)).toEqual({
      accident: { resourceId: 'tgt-a', date: '2025-01-01', type: [] },
    });
  });

  it('leaves diagnosis alone — create-appointment merges codes server-side', () => {
    expect(fieldByKey('diagnosis').stale).toBeUndefined();
  });
});
