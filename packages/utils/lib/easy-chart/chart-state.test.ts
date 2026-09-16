import { describe, expect, it } from 'vitest';
import { GetChartDataResponse } from '../types/api/chart-data/get-chart-data.types';
import { NonNormalResult } from '../types/api/lab';
import { buildChartStateSummary } from './chart-state';

const chart = (partial: Partial<GetChartDataResponse>): GetChartDataResponse =>
  ({ patientId: 'p-1', ...partial }) as GetChartDataResponse;

describe('buildChartStateSummary — labs and radiology', () => {
  // A resulted test is a FINDING of this visit, and used to be listed as "already ordered" — a name with no
  // value — so a positive rapid strep the provider never read aloud was invisible to the diagnoses and MDM.
  it('states a resulted lab with its value and flag, and a pending one as already ordered', () => {
    const summary = buildChartStateSummary(
      chart({
        inHouseLabResults: {
          resultsPending: ['Urinalysis'],
          reflexTestsPending: undefined,
          labOrderResults: [
            {
              name: 'Rapid strep',
              url: 'https://example.test/strep.pdf',
              simpleResultValue: 'Positive',
              nonNormalResultContained: [NonNormalResult.Abnormal],
            },
          ],
        },
        externalLabResults: {
          resultsPending: ['Throat culture'],
          labOrderResults: [
            {
              name: 'CBC',
              url: 'https://example.test/cbc.pdf',
              resultValues: ['WBC 14.2 (H)', 'Hgb 13.1'],
              nonNormalResultContained: [NonNormalResult.Abnormal, NonNormalResult.Neutral],
            },
          ],
        },
      })
    );
    expect(summary).toBe(
      [
        '- External lab already ordered: Throat culture',
        '- External lab resulted: Test: CBC | Results: WBC 14.2 (H), Hgb 13.1 | Flag: abnormal',
        '- In-house lab already ordered: Urinalysis',
        '- In-house lab resulted: Test: Rapid strep | Result: Positive | Flag: abnormal',
      ].join('\n')
    );
  });

  it('states a radiology report on one line, and an unread study as already ordered', () => {
    const summary = buildChartStateSummary(
      chart({
        radiologyOrders: [
          {
            serviceRequestId: 'sr-1',
            cptCodeDisplay: 'Chest X-ray',
            studyType: 'XR Chest 2 views',
            diagnosis: 'R05.9 — Cough',
            finalReport: btoa('IMPRESSION:\nNo acute cardiopulmonary process.'),
          },
          { serviceRequestId: 'sr-2', cptCodeDisplay: 'Ankle X-ray', studyType: 'XR Ankle 3 views', diagnosis: '' },
        ],
      })
    );
    expect(summary).toBe(
      [
        '- Radiology reported: XR Chest 2 views (Final): IMPRESSION: No acute cardiopulmonary process.',
        '- Radiology already ordered: XR Ankle 3 views',
      ].join('\n')
    );
  });
});
