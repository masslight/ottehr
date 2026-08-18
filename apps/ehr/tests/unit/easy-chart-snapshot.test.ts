import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { describe, expect, it } from 'vitest';
import { buildChartSnapshot } from '../../src/features/easy-chart/executor/chartSnapshot';

const chart = (partial: Partial<GetChartDataResponse>): GetChartDataResponse =>
  ({ patientId: 'p-1', ...partial }) as GetChartDataResponse;

describe('buildChartSnapshot', () => {
  it('survives an empty chart', () => {
    const snapshot = buildChartSnapshot(undefined);
    expect(snapshot.diagnoses).toEqual([]);
    expect(snapshot.hasEmCode).toBe(false);
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

  // A row with no resourceId cannot be removed or attributed, so it must not appear as removable.
  it('drops rows with no resourceId', () => {
    const snapshot = buildChartSnapshot(
      chart({ diagnosis: [{ code: 'J02.0', display: 'Strep', isPrimary: true }] as never })
    );
    expect(snapshot.diagnoses).toEqual([]);
  });

  it('lists only exam findings that are actually checked', () => {
    const snapshot = buildChartSnapshot(
      chart({
        examObservations: [
          { resourceId: 'e-1', field: 'general-normal-appearance-well', value: true, label: 'Well appearing' },
          { resourceId: 'e-2', field: 'general-abnormal-distress', value: false, label: 'In distress' },
        ],
      })
    );
    expect(snapshot.examFindings).toEqual([{ resourceId: 'e-1', display: 'Well appearing' }]);
  });

  // An encounter charted under an older exam layout carries fields the current config does not
  // define. An item the assistant cannot see is one it will happily chart a second time.
  it('keeps a finding whose field the current exam config no longer defines', () => {
    const snapshot = buildChartSnapshot(
      chart({ examObservations: [{ resourceId: 'e-9', field: 'legacy-field-from-2023', value: true }] })
    );
    expect(snapshot.examFindings).toEqual([{ resourceId: 'e-9', display: 'legacy-field-from-2023' }]);
  });

  it('resolves an exam label from the real config when the observation carries none', () => {
    const snapshot = buildChartSnapshot(
      // A REAL field from the default config, so the assertion proves the label was resolved rather
      // than proving a made-up field falls back to itself.
      chart({ examObservations: [{ resourceId: 'e-3', field: 'well-hydrated', value: true }] })
    );
    expect(snapshot.examFindings[0].display).not.toBe('well-hydrated');
    expect(snapshot.examFindings[0].display).toContain('Well-hydrated');
  });

  // The provider reads "Denies fever", so a removal must match that, not the bare symptom.
  it('rebuilds the ROS polarity verb into the display', () => {
    const snapshot = buildChartSnapshot(
      chart({
        rosObservations: [
          { resourceId: 'r-1', field: 'ros-constitutional-fever-denies', value: true },
          { resourceId: 'r-2', field: 'ros-constitutional-fatigue-reports', value: true },
        ],
      })
    );
    expect(snapshot.rosFindings[0].display).toMatch(/^Denies .*Fever/);
    expect(snapshot.rosFindings[1].display).toMatch(/^Reports .*Fatigue/);
  });

  it('names medications, allergies, conditions and procedures by what a provider would recognise', () => {
    const snapshot = buildChartSnapshot(
      chart({
        medications: [{ resourceId: 'm-1', name: 'Amoxicillin' }] as never,
        allergies: [{ resourceId: 'a-1', name: 'Penicillin' }],
        conditions: [{ resourceId: 'c-1', display: 'Asthma', code: 'J45.909' }],
        procedures: [{ resourceId: 'p-1', procedureType: 'Laceration repair' }],
        cptCodes: [{ resourceId: 'cpt-1', code: '96372', display: 'Therapeutic injection' }],
        emCode: { resourceId: 'em-1', code: '99214', display: 'Established, moderate' },
      })
    );
    expect(snapshot.medications).toEqual([{ resourceId: 'm-1', display: 'Amoxicillin' }]);
    expect(snapshot.allergies).toEqual([{ resourceId: 'a-1', display: 'Penicillin' }]);
    expect(snapshot.conditions).toEqual([{ resourceId: 'c-1', display: 'Asthma' }]);
    expect(snapshot.procedures).toEqual([{ resourceId: 'p-1', display: 'Laceration repair' }]);
    expect(snapshot.cptCodes).toEqual([{ resourceId: 'cpt-1', display: 'Therapeutic injection', code: '96372' }]);
    expect(snapshot.hasEmCode).toBe(true);
  });

  it('drops an unnamed row rather than offering a blank one for removal', () => {
    const snapshot = buildChartSnapshot(chart({ allergies: [{ resourceId: 'a-1' }] }));
    expect(snapshot.allergies).toEqual([]);
  });
});
