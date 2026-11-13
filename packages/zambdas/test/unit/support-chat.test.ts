import { SupportChatTopic } from 'utils/lib/types/api/support-chat.types';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { describe, expect, it } from 'vitest';
import { BOT_TEXT, resolveStep } from '../../src/shared/support-chat/bot';
import { buildRequestTitle } from '../../src/shared/support-chat/request-task';
import { ThreadMessage } from '../../src/shared/support-chat/thread';

const visits = [
  { id: 'appointment-1', label: 'Sarah Black 07/11/2026' },
  { id: 'appointment-2', label: 'Oliver Black 07/09/2026' },
];

const greeting: ThreadMessage = { kind: 'greeting', options: [] };

const visitPrompt: ThreadMessage = {
  kind: 'visit-prompt',
  topic: SupportChatTopic.prescriptionRefill,
  options: visits,
};

const confirmation: ThreadMessage = { kind: 'confirmation', options: [] };
const text: ThreadMessage = { kind: 'text', options: [] };

describe('support chat bot', () => {
  it('stores the greeting before the first action of an empty thread', () => {
    const step = resolveStep({
      last: undefined,
      action: { action: 'select-topic', topic: SupportChatTopic.schoolWorkNote },
      visits,
      hasOpenTask: false,
    });
    expect(step.messages.map((m) => m.kind)).toEqual(['greeting', 'recap', 'visit-prompt']);
    expect(step.task).toBeUndefined();
  });

  it('starts a new request with the greeting', () => {
    const step = resolveStep({ last: text, action: { action: 'new-request' }, visits, hasOpenTask: true });
    expect(step.messages.map((m) => m.kind)).toEqual(['greeting']);
    expect(step.messages[0].options?.map((o) => o.label)).toEqual([
      'Prescription Refill',
      'School/Work Note',
      'Medical Record',
    ]);
  });

  it('asks for a visit after a topic', () => {
    const step = resolveStep({
      last: greeting,
      action: { action: 'select-topic', topic: SupportChatTopic.prescriptionRefill },
      visits,
      hasOpenTask: false,
    });
    expect(step.messages[0]).toMatchObject({ author: 'patient', text: 'Initiated request: Prescription Refill' });
    expect(step.messages[1]).toMatchObject({
      kind: 'visit-prompt',
      topic: SupportChatTopic.prescriptionRefill,
      options: visits,
    });
  });

  it('creates a task without a visit when the account has no visits', () => {
    const step = resolveStep({
      last: greeting,
      action: { action: 'select-topic', topic: SupportChatTopic.medicalRecord },
      visits: [],
      hasOpenTask: false,
    });
    expect(step.messages.map((m) => m.kind)).toEqual(['recap', 'confirmation']);
    expect(step.task).toMatchObject({ type: 'create', code: SupportChatTopic.medicalRecord });
  });

  it('creates a task for the selected visit', () => {
    const step = resolveStep({
      last: visitPrompt,
      action: { action: 'select-visit', appointmentId: 'appointment-1' },
      visits,
      hasOpenTask: false,
    });
    expect(step.messages[0].text).toBe('Specified: Prescription Refill for the visit of Sarah Black 07/11/2026');
    expect(step.messages[1].text).toBe(BOT_TEXT.confirmation);
    expect(step.task).toMatchObject({
      type: 'create',
      code: SupportChatTopic.prescriptionRefill,
      appointmentId: 'appointment-1',
    });
  });

  it('creates a follow-up task right away and asks for a visit after free text', () => {
    const step = resolveStep({ last: greeting, action: { action: 'text', text: 'Fax it' }, visits, hasOpenTask: true });
    expect(step.messages.map((m) => m.kind)).toEqual(['text', 'visit-prompt']);
    expect(step.messages[1].topic).toBeUndefined();
    expect(step.task).toEqual({ type: 'create', code: PATIENT_REQUEST_TASK.code.followUp, text: 'Fax it' });
  });

  it('sets the selected visit on the follow-up task', () => {
    const step = resolveStep({
      last: { kind: 'visit-prompt', options: visits },
      requestText: 'Fax it',
      action: { action: 'select-visit', appointmentId: 'appointment-2' },
      visits,
      hasOpenTask: true,
    });

    expect(step.messages.map((m) => m.text)).toEqual([
      'Initiated request: Fax it for Oliver Black 07/09/2026',
      BOT_TEXT.confirmation,
    ]);

    expect(step.task).toEqual({ type: 'set-visit', appointmentId: 'appointment-2', text: 'Fax it' });
  });

  it('adds text to the follow-up task when the patient types instead of selecting a visit', () => {
    const step = resolveStep({
      last: { kind: 'visit-prompt', options: visits },
      action: { action: 'text', text: 'More' },
      visits,
      hasOpenTask: true,
    });
    expect(step.task).toEqual({ type: 'attach', text: 'More' });
  });

  it('uses the only visit without asking', () => {
    const step = resolveStep({
      last: text,
      action: { action: 'text', text: 'Hi' },
      visits: [visits[0]],
      hasOpenTask: false,
    });
    expect(step.messages.map((m) => m.text)).toEqual([
      'Hi',
      'Initiated request: Hi for Sarah Black 07/11/2026',
      BOT_TEXT.confirmation,
    ]);
    expect(step.task).toMatchObject({ code: PATIENT_REQUEST_TASK.code.followUp, appointmentId: 'appointment-1' });
  });

  it('creates the pending request without a visit when the patient types instead of selecting', () => {
    const step = resolveStep({
      last: visitPrompt,
      action: { action: 'text', text: 'Asap' },
      visits,
      hasOpenTask: true,
    });
    expect(step.messages.map((m) => m.kind)).toEqual(['text', 'confirmation']);
    expect(step.task).toMatchObject({
      code: SupportChatTopic.prescriptionRefill,
      appointmentId: undefined,
      details: 'Asap',
    });
  });

  it('attaches text to the open task and acknowledges only the first details', () => {
    const first = resolveStep({ last: confirmation, action: { action: 'text', text: 'a' }, visits, hasOpenTask: true });
    expect(first.messages.map((m) => m.text)).toEqual(['a', BOT_TEXT.ack]);
    expect(first.task).toEqual({ type: 'attach', text: 'a' });

    const next = resolveStep({ last: text, action: { action: 'text', text: 'b' }, visits, hasOpenTask: true });
    expect(next.messages.map((m) => m.text)).toEqual(['b']);
  });

  it.each([
    [text, { action: 'select-topic' as const, topic: SupportChatTopic.prescriptionRefill }],
    [greeting, { action: 'select-visit' as const, appointmentId: 'appointment-1' }],
    [visitPrompt, { action: 'select-visit' as const, appointmentId: 'unknown' }],
  ])('rejects an action that does not match the active prompt', (last, action) => {
    expect(() => resolveStep({ last, action, visits, hasOpenTask: false })).toThrow();
  });
});

describe('visit selection', () => {
  it('rejects a chip whose visit is no longer available', () => {
    const action = { action: 'select-visit' as const, appointmentId: 'appointment-1' };
    expect(() => resolveStep({ last: visitPrompt, action, visits: [visits[1]], hasOpenTask: false })).toThrow();
  });
});

describe('buildRequestTitle', () => {
  it('builds a structured title', () => {
    expect(buildRequestTitle(SupportChatTopic.prescriptionRefill, 'Sarah Black 07/11/2026')).toBe(
      'Prescription Refill for Sarah Black 07/11/2026'
    );
  });

  it('quotes the message for a follow-up', () => {
    expect(buildRequestTitle(PATIENT_REQUEST_TASK.code.followUp, 'Oliver Black 07/09/2026', 'Fax it, please')).toBe(
      '“Fax it, please” for Oliver Black 07/09/2026'
    );
  });

  it('shortens a long follow-up message', () => {
    const title = buildRequestTitle(PATIENT_REQUEST_TASK.code.followUp, 'Oliver Black', 'x'.repeat(150));
    expect(title).toBe(`“${'x'.repeat(100)}…” for Oliver Black`);
  });
});
