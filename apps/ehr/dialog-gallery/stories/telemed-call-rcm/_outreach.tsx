// Shared mock data for the scheduled-patient-outreach stories (not a story itself).
import type { Communication } from 'fhir/r4b';
import { FC, PropsWithChildren, useState } from 'react';
import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';
import type {
  OutreachActionDTO,
  OutreachConfigResponse,
  OutreachTaskSummary,
} from 'src/rcm/state/scheduled-outreach-config/scheduled-outreach-config.api';
import type { ConversationMessage } from 'utils/lib/types/api/messaging.types';
import type { FetchMock } from '../../harness/story';

const PATIENT_ID = 'pat-1';
const PATIENT_NAME = 'Maya Thompson';

const zambda = (output: unknown): { status: number; output: unknown } => ({ status: 200, output });

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

const SMS_TEMPLATE =
  'Hi {{patient-first-name}}, your balance of {{amount}} for your visit on {{visit-date}} is due {{due-date}}. Pay here: {{invoice-link}}';
const EMAIL_TEMPLATE =
  'Hello {{patient-first-name}},\n\nThis is a reminder that your balance of {{amount}} is due on {{due-date}}.\n\nPay online: {{invoice-link}}';

export const outreachActions: OutreachActionDTO[] = [
  {
    id: 'action-reminder',
    enabled: true,
    trigger: { event: 'invoice-due', daysAfter: 3, timeUnit: 'days', direction: 'before' },
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums: ['sms', 'email'],
      smsTemplate: SMS_TEMPLATE,
      emailTemplate: EMAIL_TEMPLATE,
      statementType: 'standard',
    },
  },
  {
    id: 'action-past-due',
    enabled: true,
    trigger: { event: 'invoice-due', daysAfter: 14, timeUnit: 'days', direction: 'after' },
    actionType: 'send-notification',
    sendNotificationConfig: {
      mediums: ['sms', 'email', 'paper-mail'],
      smsTemplate: SMS_TEMPLATE,
      emailTemplate: EMAIL_TEMPLATE,
      statementType: 'past-due',
    },
  },
  {
    id: 'action-collections',
    enabled: true,
    trigger: { event: 'invoice-due', daysAfter: 90, timeUnit: 'days', direction: 'after' },
    actionType: 'refer-to-collections',
    referToCollectionsConfig: {
      agency: 'Northside Recovery Services',
      minimumBalance: 50,
      includePaymentHistory: true,
    },
  },
];

const outreachConfig: OutreachConfigResponse = {
  planDefinition: { resourceType: 'PlanDefinition', id: '4f6f1c5e-1b53-4b0f-9f0e-0f0d5c0a7b11', status: 'active' },
  actions: outreachActions,
  notificationsTimeRestriction: {
    enabled: true,
    windowStart: '09:00',
    windowEnd: '20:00',
    timezone: 'America/New_York',
  },
};

const tasks: OutreachTaskSummary[] = [
  {
    id: 'task-1',
    status: 'completed',
    actionType: 'send-notification',
    triggerEvent: 'invoice-due',
    actionId: 'action-past-due',
    patientId: PATIENT_ID,
    patientName: PATIENT_NAME,
    patientFriendlyId: 'P-10482',
    appointmentId: 'appt-1',
    visitDate: '2026-10-02',
    focusReference: 'Invoice/inv-1',
    dueDateTime: hoursAgo(3),
    authoredOn: hoursAgo(8),
    completedDateTime: hoursAgo(3),
    description: 'Past-due balance reminder',
    mediums: 'sms,email,paper-mail',
    notificationResults: [
      { medium: 'sms', success: true },
      { medium: 'email', success: true },
      { medium: 'paper-mail', success: true },
    ],
  },
  {
    id: 'task-2',
    status: 'requested',
    actionType: 'send-notification',
    triggerEvent: 'invoice-due',
    actionId: 'action-reminder',
    patientId: 'pat-2',
    patientName: 'Daniel Okafor',
    patientFriendlyId: 'P-10377',
    visitDate: '2026-10-20',
    focusReference: 'Invoice/inv-2',
    dueDateTime: hoursAgo(-4),
    authoredOn: hoursAgo(6),
    description: 'Upcoming balance due reminder',
    mediums: 'sms,email',
  },
];

const conversation: ConversationMessage[] = [
  {
    id: 'msg-1',
    sender: 'Ottehr',
    sentDay: '10/28/2026',
    sentTime: '9:02 AM',
    content:
      'Hi Maya, your balance of $85.00 for your visit on 10/02/2026 is due 10/30/2026. Pay here: https://pay.example.com/i/8f3k2',
    isRead: true,
    isFromPatient: false,
  },
  {
    id: 'msg-2',
    sender: PATIENT_NAME,
    sentDay: '10/28/2026',
    sentTime: '9:15 AM',
    content: 'Thanks, can I pay half now and the rest next week?',
    isRead: true,
    isFromPatient: true,
  },
  {
    id: 'msg-3',
    sender: 'Ottehr',
    sentDay: '10/28/2026',
    sentTime: '9:31 AM',
    content: 'Yes, that works. You can make a partial payment using the same link.',
    isRead: true,
    isFromPatient: false,
  },
  {
    id: 'msg-4',
    sender: 'Ottehr',
    sentDay: '11/13/2026',
    sentTime: '9:00 AM',
    content: 'Hi Maya, your remaining balance of $42.50 is now past due. Pay here: https://pay.example.com/i/8f3k2',
    isRead: true,
    isFromPatient: false,
  },
];

const communication = (id: string, sent: string, text: string, recipient?: string): Communication => ({
  resourceType: 'Communication',
  id,
  status: 'completed',
  subject: { reference: `Patient/${PATIENT_ID}` },
  sent,
  recipient: recipient ? [{ reference: `Patient/${PATIENT_ID}`, display: recipient }] : undefined,
  payload: [{ contentString: text }],
});

export const outreachEmails: Communication[] = [
  communication(
    'email-2',
    '2026-11-13T14:00:00.000Z',
    'Hello Maya,\n\nYour remaining balance of $42.50 for your visit on 10/02/2026 is now past due.\n\nPay online: https://pay.example.com/i/8f3k2',
    'maya.thompson@example.com'
  ),
  communication(
    'email-1',
    '2026-10-28T13:02:00.000Z',
    'Hello Maya,\n\nThis is a reminder that your balance of $85.00 is due on 10/30/2026.\n\nPay online: https://pay.example.com/i/8f3k2',
    'maya.thompson@example.com'
  ),
];

export const outreachPaperMail: Communication[] = [
  communication('mail-3', '2026-11-13T14:00:00.000Z', 'Final notice statement mailed for invoice INV-20418 ($42.50)'),
  communication('mail-2', '2026-11-01T14:00:00.000Z', 'Past due statement mailed for invoice INV-20418 ($42.50)'),
  communication('mail-1', '2026-10-16T14:00:00.000Z', 'Statement mailed for invoice INV-20418 ($85.00)'),
];

/**
 * Answers the history dialogs' Communication search. The request's search params are not visible
 * to the fetch mock, so each story passes the list its one dialog should receive.
 */
export const communicationsMock = (resources: Communication[]): FetchMock => ({
  url: /\/fhir\/Communication/,
  response: () => bundle(resources),
});

const bundle = (resources: unknown[]): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({ resource })),
});

export const outreachMocks: FetchMock[] = [
  { url: 'get-scheduled-outreach-config', response: zambda(outreachConfig) },
  { url: 'save-scheduled-outreach-config', response: zambda(outreachConfig) },
  {
    url: 'list-outreach-tasks',
    response: zambda({ tasks, totalCount: tasks.length, pageSize: 25, offset: 0 }),
  },
  { url: 'get-conversation', response: zambda(conversation) },
  { url: 'payment-locations', response: zambda({ locations: [] }) },
];

/**
 * Stands in for the admin page shell: ScheduledPatientOutreach portals its header buttons
 * (settings / "Add Action" / "Save") into the node provided through AdminHeaderSlotProvider.
 */
export const AdminHeaderHost: FC<PropsWithChildren> = ({ children }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <div style={{ padding: 24 }}>
      <div ref={setSlot} style={{ display: 'flex', justifyContent: 'flex-end' }} />
      <AdminHeaderSlotProvider value={slot}>{children}</AdminHeaderSlotProvider>
    </div>
  );
};
