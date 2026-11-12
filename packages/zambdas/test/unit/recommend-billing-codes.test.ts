import { APIGatewayProxyResult } from 'aws-lambda';
import { ProcedureFactsInput } from 'utils/lib/procedure-coding/model.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../src/shared/types/common';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../src/shared/ai', () => ({ invokeChatbotVertexAI: invoke }));
vi.mock('../../src/shared/sentry', () => ({ wrapHandler: (_name: string, handler: unknown) => handler }));
import { index } from '../../src/ehr/recommend-billing-codes';

// The wrapper mock exposes the application handler instead of AWS's three-argument adapter.
const handler = index as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
const request = (body: unknown): ZambdaInput => ({ headers: {}, secrets: null, body: JSON.stringify(body) });
beforeEach(() => invoke.mockReset());
describe('recommend-billing-codes boundary', () => {
  it('never invokes AI for an exact known name with missing clinical answers', async () => {
    const response = await handler(request({ procedureType: 'Laceration Repair (Wound Closure)' }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ source: 'rules', outcome: { suggestions: [] } });
    expect(invoke).not.toHaveBeenCalled();
  });
  it('uses AI for a name differing by even one character and returns the shared interface', async () => {
    invoke.mockResolvedValue(JSON.stringify([{ code: '12001', description: 'Repair', useWhen: 'Documented repair' }]));
    const facts: ProcedureFactsInput = {
      procedureType: 'Laceration Repair (Wound Closure) ',
      structuredFacts: { length: 2 },
      procedureDetails: 'Clinical narrative',
    };
    const response = await handler(request({ ...facts, patientId: 'must-not-forward', cptCodes: [{ code: '99999' }] }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      source: 'ai',
      outcome: { suggestions: [{ code: '12001', units: 1 }] },
      codeAssessments: {},
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][5]).toEqual({ retryMode: 'sequential' });
    const prompt = invoke.mock.calls[0][0][0].text;
    expect(prompt).toContain('Clinical narrative');
    expect(prompt).toContain('"length":2');
    expect(prompt).not.toContain('must-not-forward');
    expect(prompt).not.toContain('99999');
  });
  it.each([
    '{invalid',
    JSON.stringify({ procedureType: '' }),
    JSON.stringify({ procedureType: 'Unknown', structuredFacts: { nested: { bad: true } } }),
  ])('rejects malformed input without calling AI', async (body) => {
    expect((await handler({ headers: {}, secrets: null, body })).statusCode).toBe(400);
    expect(invoke).not.toHaveBeenCalled();
  });
  it('splits a modifier the model appended to the code into the suggestion modifiers', async () => {
    invoke.mockResolvedValue(
      JSON.stringify([
        { code: '83036', description: 'Hemoglobin A1C', useWhen: 'Laboratory A1C' },
        { code: '83036QW', description: 'Hemoglobin A1C, CLIA-waived', useWhen: 'CLIA-waived device' },
        { code: '83036QW', description: 'Duplicate', useWhen: 'Duplicate' },
        { code: '20610-RT-RT', description: 'Arthrocentesis, major joint', useWhen: 'Right knee' },
      ])
    );
    const response = await handler(request({ procedureType: 'Unknown procedure' }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).outcome.suggestions).toEqual([
      expect.objectContaining({ code: '83036', modifiers: [], units: 1 }),
      expect.objectContaining({ code: '83036', modifiers: ['QW'], units: 1 }),
      expect.objectContaining({ code: '20610', modifiers: ['RT'], units: 1 }),
    ]);
  });
  it.each(['invalid', '83036Q', '83036-qw', '20610-RT-59-76-XS-GA'])(
    'does not return malformed AI billing code %s to the UI',
    async (code) => {
      invoke.mockResolvedValue(JSON.stringify([{ code, description: 'Bad', useWhen: 'Bad' }]));
      await expect(handler(request({ procedureType: 'Unknown procedure' }))).rejects.toThrow();
    }
  );
});
