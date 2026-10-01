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
    expect(invoke.mock.calls[0][4]).toEqual({ retryMode: 'sequential' });
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
  it('does not return malformed AI billing codes to the UI', async () => {
    invoke.mockResolvedValue(JSON.stringify([{ code: 'invalid', description: 'Bad', useWhen: 'Bad' }]));
    await expect(handler(request({ procedureType: 'Unknown procedure' }))).rejects.toThrow();
  });
});
