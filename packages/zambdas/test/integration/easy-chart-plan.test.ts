import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ChartPlanResponse } from 'utils/lib/easy-chart/api';
import { getEmCodes } from 'utils/lib/helpers/em-codes';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/easy-chart-plan/index';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const { callModelForJson } = vi.hoisted(() => ({ callModelForJson: vi.fn() }));

vi.mock('../../src/ehr/easy-chart-shared/model', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/ehr/easy-chart-shared/model')>()),
  callModelForJson,
}));

const NARRATIVE = 'Patient seen for a dry cough for three days. Straightforward visit, supportive care only.';
const NON_EM_CPT_CODES = ['10021', '36415', '71046'];

describe('easy-chart-plan integration', () => {
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let enabledEmCode: string;
  let disabledEmCode: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('easy-chart-plan.test.ts', M2MClientMockType.provider);
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const practiceEmCodes = (await getEmCodes(setup.oystehr)).map((option) => option.code);
    expect(practiceEmCodes.length).toBeGreaterThan(0);
    enabledEmCode = practiceEmCodes.includes('99213') ? '99213' : practiceEmCodes[0];
    disabledEmCode = NON_EM_CPT_CODES.find((code) => !practiceEmCodes.includes(code))!;
    expect(disabledEmCode).toBeDefined();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('plans from the chart, visit and practice context and guards the actions against the practice E&M codes', async () => {
    callModelForJson.mockResolvedValue({
      parsed: {
        actions: [
          { kind: 'set-em-code', code: enabledEmCode, sourceText: 'Straightforward visit' },
          { kind: 'set-em-code', code: disabledEmCode },
        ],
      },
      usage: [],
      escalation: { attempts: 1, escalated: false, failures: [] },
    });

    const { statusCode, output } = await invokeZambdaHandler<ChartPlanResponse>(
      index,
      { narrative: NARRATIVE, encounterId: base.encounter.id },
      { token }
    );

    expect(statusCode).toBe(200);
    const { prompt } = callModelForJson.mock.calls[0][0] as { prompt: string };
    const age = Math.floor(DateTime.now().diff(DateTime.fromISO(base.patient.birthDate!), 'months').months / 12);
    expect(prompt).toContain(`PATIENT (authoritative — take age and sex from here, never from the narrative):`);
    expect(prompt).toContain(`Age: ${age} years, Sex: male`);
    expect(prompt).toContain('PATIENT STATUS (authoritative — from the chart): NEW patient');
    expect(prompt).toContain(NARRATIVE);

    expect(output.actions).toEqual([
      expect.objectContaining({
        kind: 'set-em-code',
        code: enabledEmCode,
        sourceText: 'Straightforward visit',
        sourceOrigin: 'narrative',
      }),
    ]);
    expect(output.rejected).toEqual([
      {
        kind: 'set-em-code',
        display: disabledEmCode,
        reason: `E&M code ${disabledEmCode} is not one this practice has enabled, so it could not be charted`,
      },
    ]);
    expect(output.escalation).toEqual({ attempts: 1, escalated: false, failures: [] });
  });
});
