import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { describe, expect, it } from 'vitest';
import { buildChartSnapshot } from '../../src/features/easy-chart/executor/chartSnapshot';

const chart = (partial: Partial<GetChartDataResponse>): GetChartDataResponse =>
  ({ patientId: 'p-1', ...partial }) as GetChartDataResponse;

describe('buildChartSnapshot', () => {
  it('survives an empty chart', () => {
    const snapshot = buildChartSnapshot(undefined);
    expect(snapshot.diagnoses).toEqual([]);
    expect(snapshot.noteFields).toEqual({});
  });

  it('carries each note paragraph under its storage key, with the row that holds it', () => {
    const snapshot = buildChartSnapshot(
      chart({
        chiefComplaint: { resourceId: 'cc-1', text: 'Sinus pressure x 1 week.' },
        medicalDecision: { resourceId: 'mdm-1', text: 'Likely viral.' },
      })
    );
    expect(snapshot.noteFields).toEqual({
      chiefComplaint: { resourceId: 'cc-1', text: 'Sinus pressure x 1 week.' },
      medicalDecision: { resourceId: 'mdm-1', text: 'Likely viral.' },
    });
  });

  it('carries the diagnosis code and primary flag through', () => {
    const snapshot = buildChartSnapshot(
      chart({
        diagnosis: [
          { resourceId: 'dx-1', code: 'J02.0', display: 'Strep pharyngitis', isPrimary: true },
          { resourceId: 'dx-2', code: 'H66.91', display: 'AOM right', isPrimary: false },
        ],
      })
    );
    expect(snapshot.diagnoses).toEqual([
      { resourceId: 'dx-1', display: 'Strep pharyngitis', code: 'J02.0', isPrimary: true },
      { resourceId: 'dx-2', display: 'AOM right', code: 'H66.91', isPrimary: false },
    ]);
  });

  // A row with no resourceId cannot be updated or attributed, so the executor must not see it.
  it('drops rows with no resourceId', () => {
    const snapshot = buildChartSnapshot(
      chart({ diagnosis: [{ code: 'J02.0', display: 'Strep', isPrimary: true }] as never })
    );
    expect(snapshot.diagnoses).toEqual([]);
  });

  it('names a condition by its display, falling back to its code, and drops an unnamed one', () => {
    const snapshot = buildChartSnapshot(
      chart({
        conditions: [
          { resourceId: 'c-1', display: 'Asthma', code: 'J45.909' },
          { resourceId: 'c-2', code: 'E11.9' },
          { resourceId: 'c-3' },
        ] as never,
      })
    );
    expect(snapshot.conditions).toEqual([
      { resourceId: 'c-1', display: 'Asthma' },
      { resourceId: 'c-2', display: 'E11.9' },
    ]);
  });

  it('keys every exam row by its field, ticked or not, so a write updates it in place', () => {
    const rows = [
      { resourceId: 'e-1', field: 'general-normal-appearance-well', value: true, label: 'Well appearing' },
      { resourceId: 'e-2', field: 'general-comment', note: 'Appears comfortable' },
    ];
    expect(buildChartSnapshot(chart({ examObservations: rows })).examRows).toEqual({
      'general-normal-appearance-well': rows[0],
      'general-comment': rows[1],
    });
  });
});
