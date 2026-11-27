import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/ai-suggestion-notes/index';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { invokeChatbotVertexAI, SIGN_REVIEW_PROMPT } = vi.hoisted(() => ({
  invokeChatbotVertexAI: vi.fn(),
  SIGN_REVIEW_PROMPT: 'Every note must state the duration of the presenting symptoms.',
}));

vi.mock('../../src/shared/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/ai')>()),
  invokeChatbotVertexAI,
}));

vi.mock('../../src/shared/progress-note-config', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/shared/progress-note-config')>();
  return {
    ...original,
    getProgressNoteConfigPayload: async (...args: Parameters<typeof original.getProgressNoteConfigPayload>) => ({
      ...(await original.getProgressNoteConfigPayload(...args)),
      signReviewPrompt: SIGN_REVIEW_PROMPT,
    }),
  };
});

describe('ai-suggestion-notes integration', () => {
  let oystehrAdmin: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let hpiConditionId: string | undefined;
  const historyOfPresentIllness = `Dry cough ${randomUUID()}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('ai-suggestion-notes.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const saved = await setup.oystehrTestUserM2M.zambda.execute({
      id: 'save-chart-data',
      encounterId: base.encounter.id,
      historyOfPresentIllness: { text: historyOfPresentIllness },
    });
    hpiConditionId = (saved.output as { chartData?: { historyOfPresentIllness?: { resourceId?: string } } }).chartData
      ?.historyOfPresentIllness?.resourceId;
    expect(hpiConditionId).toBeDefined();
  }, 60_000);

  afterAll(async () => {
    if (hpiConditionId) {
      await oystehrAdmin.fhir
        .delete({ resourceType: 'Condition', id: hpiConditionId })
        .catch((error) => console.warn(error));
    }
    await cleanup();
  });

  it('reviews the assembled progress note of the visit against the practice sign review prompt', async () => {
    invokeChatbotVertexAI.mockResolvedValue(JSON.stringify({ suggestions: ['State how long the cough has lasted.'] }));

    const { statusCode, output } = await invokeZambdaHandler<{ suggestions: string[] }>(
      index,
      { type: 'note-review', appointmentId: base.appointment.id, encounterId: base.encounter.id },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ suggestions: ['State how long the cough has lasted.'] });
    expect(invokeChatbotVertexAI).toHaveBeenCalledTimes(1);
    const [[{ text: prompt }], , feature] = invokeChatbotVertexAI.mock.calls[0] as [
      [{ text: string }],
      unknown,
      string,
    ];
    expect(feature).toBe('ai-suggestion-notes');
    expect(prompt).toContain(`<review_requirement>\n${SIGN_REVIEW_PROMPT}\n</review_requirement>`);
    const note = prompt.slice(prompt.indexOf('<progress_note id='));
    expect(note).toContain(`CHIEF COMPLAINT:\n${historyOfPresentIllness}`);
  });
});
