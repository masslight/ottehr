import { GenerateAdHocReportInputSchema } from 'utils/lib/types/adhoc/generation/generate.types';
import { rejectedStepsError } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInvokeVertex } = vi.hoisted(() => ({ mockInvokeVertex: vi.fn() }));

vi.mock('../../src/shared/ai', () => ({
  invokeChatbotVertexAI: mockInvokeVertex,
  invokeChatbot: vi.fn(),
}));

import { generateAdHocReportCode } from '../../src/shared/adhoc-generate';

// A request without a dataset schema is a fetch-plan report: the model gets the request and the data map
// only — never fetched records — and answers with a plan (checked here against the data map) and the code.
const CODE = 'function ReportRoot() { return null; }\nreturn ReportRoot;';

const visitsPlan = {
  version: 1,
  steps: [
    {
      id: 'visits',
      resourceType: 'Appointment',
      params: [
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
        { name: '_tag', value: 'OTTEHR-IP,OTTEHR-TM' },
      ],
    },
  ],
};

const prompt = (call = 0): string => mockInvokeVertex.mock.calls[call][0][0].text as string;

describe('fetch-plan generation', () => {
  beforeEach(() => mockInvokeVertex.mockReset());

  it('gives the model the request and the data map, and returns the validated plan with the code', async () => {
    const input = GenerateAdHocReportInputSchema.parse({ request: 'visits per day last month' });
    mockInvokeVertex.mockResolvedValue(JSON.stringify({ title: 'Visits per day', plan: visitsPlan, code: CODE }));

    const result = await generateAdHocReportCode(input, 'defaultVertexModel', {});

    expect(result.title).toBe('Visits per day');
    expect(result.code).toBe(CODE);
    // The schema fills in the defaults the runner relies on (mode "auto").
    expect(result.plan).toMatchObject({ version: 1, steps: [{ id: 'visits', mode: 'auto' }] });

    expect(prompt()).toContain("DATA MAP (what Ottehr's FHIR data means");
    expect(prompt()).toContain('FETCH PLAN FORMAT');
    expect(prompt()).toContain('visits per day last month');
    expect(prompt()).not.toContain('DATASET SCHEMA');
    // The response schema asks for the plan and the code together.
    expect(mockInvokeVertex.mock.calls[0][3]).toMatchObject({ required: ['plan', 'code'] });
  });

  it('sends an invalid plan back with its issues and keeps the next valid one', async () => {
    const input = GenerateAdHocReportInputSchema.parse({ request: 'medication lot numbers used last week' });
    const badPlan = { version: 1, steps: [{ id: 'lots', resourceType: 'InventoryItem', params: [] }] };
    mockInvokeVertex
      .mockResolvedValueOnce(JSON.stringify({ plan: badPlan, code: CODE }))
      .mockResolvedValueOnce(JSON.stringify({ plan: visitsPlan, code: CODE }));

    const result = await generateAdHocReportCode(input, 'defaultVertexModel', {});

    expect(result.plan?.steps[0].resourceType).toBe('Appointment');
    expect(mockInvokeVertex).toHaveBeenCalledTimes(2);
    expect(prompt(1)).toContain('the plan was invalid');
    expect(prompt(1)).toContain('"InventoryItem" is not described in the data map');
  });

  it('gives up after three attempts with a user-readable error', async () => {
    const input = GenerateAdHocReportInputSchema.parse({ request: 'anything' });
    mockInvokeVertex.mockResolvedValue('not json at all');

    await expect(generateAdHocReportCode(input, 'defaultVertexModel', {})).rejects.toMatchObject({
      message: expect.stringContaining('Could not generate a valid report after 3 attempts'),
    });
    expect(mockInvokeVertex).toHaveBeenCalledTimes(3);
  });

  it('quotes the previous plan and code when repairing a crashed report', async () => {
    const input = GenerateAdHocReportInputSchema.parse({
      request: 'visits per day',
      previousAttempt: { code: CODE, error: "Cannot read properties of null (reading 'useMemo')", plan: visitsPlan },
    });
    mockInvokeVertex.mockResolvedValue(JSON.stringify({ plan: visitsPlan, code: CODE }));

    await generateAdHocReportCode(input, 'defaultVertexModel', {});

    expect(prompt()).toContain('YOUR PREVIOUS ATTEMPT');
    expect(prompt()).toContain('The previous plan was:');
    expect(prompt()).toContain('OUTSIDE a component');
    expect(prompt()).not.toContain('REJECTED a search');
  });

  it('asks for a corrected plan, not corrected code, when the server rejected a search of the plan', async () => {
    const rejected = rejectedStepsError([
      {
        id: 'visits',
        resourceType: 'Appointment',
        ms: 12,
        count: 0,
        byType: {},
        bytes: 2,
        mode: 'normal',
        requests: 0,
        params: [],
        error: 'Unknown search parameter "foo"',
        rejected: true,
      },
    ]);
    const input = GenerateAdHocReportInputSchema.parse({
      request: 'visits per day',
      previousAttempt: { code: CODE, error: rejected, plan: visitsPlan },
    });
    mockInvokeVertex.mockResolvedValue(JSON.stringify({ plan: visitsPlan, code: CODE }));

    await generateAdHocReportCode(input, 'defaultVertexModel', {});

    expect(prompt()).toContain('the server REJECTED a search of your plan');
    expect(prompt()).toContain('step "visits" (Appointment): Unknown search parameter "foo"');
    expect(prompt()).toContain('The previous plan was:');
    expect(prompt()).toContain('Return a CORRECTED plan');
    expect(prompt()).not.toContain('CRASHED when it ran');
  });
});
