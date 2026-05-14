import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  convertOutreachTextToHtml,
  getFullestAvailableName,
  getPatientContactEmail,
  getSecret,
  getTaskResource,
  Secrets,
  SecretsKeys,
  TaskIndicator,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  fillOutreachTemplate,
  getEmailClient,
  resolveTemplatePlaceholders,
  sendSmsForPatient,
  StatementType,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { NotificationMedium } from '../../../scheduled-outreach-config/helpers';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-send-notification';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('Secrets are not defined');

  const task: Task = JSON.parse(input.body);

  if (task.resourceType !== 'Task') {
    throw new Error(`Expected Task resource but got ${task.resourceType}`);
  }

  if (task.status !== 'requested') {
    console.log(`Task ${task.id} is not in "requested" status (current: ${task.status}), skipping`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Task not in requested status, skipped' }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(m2mToken, input.secrets);

  // Mark as in-progress
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: task.id!,
    operations: [{ op: 'replace', path: '/status', value: 'in-progress' }],
  });

  try {
    const mediums = extractMediums(task);
    const smsTemplate = extractInputValue(task, 'sms-template');
    const emailTemplate = extractInputValue(task, 'email-template');
    const patientRef = task.for?.reference;

    console.log(`Executing send-notification for patient ${patientRef}, mediums: ${mediums.join(', ')}`);
    console.log('--- NOTIFICATION CONTENT ---');
    if (mediums.includes('sms') && smsTemplate) {
      console.log(`[SMS Template]: ${smsTemplate}`);
    }
    if (mediums.includes('email') && emailTemplate) {
      console.log(`[Email Template]: ${emailTemplate}`);
    }
    if (mediums.includes('paper-mail')) {
      console.log(`[Paper Mail]: Statement will be generated for patient ${patientRef}`);
    }
    console.log('--- END NOTIFICATION CONTENT ---');

    const results: { medium: NotificationMedium; success: boolean; error?: string }[] = [];

    for (const medium of mediums) {
      try {
        switch (medium) {
          case 'sms':
            await sendOutreachSms(task, smsTemplate || '', oystehr, input.secrets);
            console.log(`[SMS] Successfully sent SMS notification for task ${task.id}, patient ${patientRef}`);
            results.push({ medium, success: true });
            break;
          case 'email':
            await sendOutreachEmail(task, emailTemplate || '', oystehr, input.secrets);
            console.log(`[Email] Successfully sent email notification for task ${task.id}, patient ${patientRef}`);
            results.push({ medium, success: true });
            break;
          case 'paper-mail': {
            const statementType = extractInputValue(task, 'statement-type') || 'standard';
            await sendPaperMail(task, statementType, oystehr, input.secrets);
            console.log(`[Paper Mail] Successfully created paper mail task for task ${task.id}, patient ${patientRef}`);
            results.push({ medium, success: true });
            break;
          }
        }
      } catch (err: any) {
        const errorDetail = err.response?.body ? JSON.stringify(err.response.body) : err.message;
        console.error(
          `[${medium.toUpperCase()}] Failed to send ${medium} notification for task ${
            task.id
          }, patient ${patientRef}: ${errorDetail}`
        );
        results.push({ medium, success: false, error: errorDetail });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    const finalStatus = allSucceeded ? 'completed' : 'failed';

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: finalStatus },
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
        {
          op: 'add',
          path: '/output',
          value: [
            {
              type: { text: 'execution-result' },
              valueString: JSON.stringify(results),
            },
          ],
        },
      ],
    });

    console.log(`Task ${task.id} completed with status: ${finalStatus}`);
    return { statusCode: 200, body: JSON.stringify({ status: finalStatus, results }) };
  } catch (err: any) {
    console.error(`Unexpected error executing task ${task.id}:`, err.message);

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'failed' },
        { op: 'add', path: '/executionPeriod/end', value: DateTime.now().toISO() },
        {
          op: 'add',
          path: '/output',
          value: [{ type: { text: 'error' }, valueString: err.message }],
        },
      ],
    });

    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function extractMediums(task: Task): NotificationMedium[] {
  const mediumsInput = task.input?.find((i) => i.type?.text === 'mediums');
  if (!mediumsInput?.valueString) return [];
  return mediumsInput.valueString.split(',') as NotificationMedium[];
}

function extractInputValue(task: Task, key: string): string | undefined {
  return task.input?.find((i) => i.type?.text === key)?.valueString;
}

// ── Integration placeholders ───────────────────────────────────────────────
// These will be replaced with actual integrations (Twilio, SendGrid, Lob, etc.)

async function sendOutreachSms(task: Task, template: string, oystehr: Oystehr, secrets: Secrets | null): Promise<void> {
  const patientId = task.for?.reference?.replace('Patient/', '');
  if (!patientId) throw new Error('Task has no patient reference');

  const patient = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: patientId,
  });

  const placeholderInput = await resolveTemplatePlaceholders({
    patient,
    encounterRef: task.focus?.reference,
    oystehr,
    secrets,
  });
  const resolvedMessage = fillOutreachTemplate(template, placeholderInput);

  // Check for unresolved placeholders — any remaining {{key}} means data is missing
  const unresolved = resolvedMessage.match(/\{\{[\w-]+\}\}/g);
  if (unresolved) {
    const unique = [...new Set(unresolved)];
    throw new Error(`Unresolved template placeholders: ${unique.join(', ')}`);
  }

  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  await sendSmsForPatient(resolvedMessage, oystehr, patient, ENVIRONMENT);
}

async function sendOutreachEmail(
  task: Task,
  template: string,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<void> {
  const patientId = task.for?.reference?.replace('Patient/', '');
  if (!patientId) throw new Error('Task has no patient reference');

  const patient = await oystehr.fhir.get<Patient>({
    resourceType: 'Patient',
    id: patientId,
  });

  const email = getPatientContactEmail(patient);
  if (!email) {
    throw new Error(`Patient ${patientId} has no contact email address`);
  }

  const placeholderInput = await resolveTemplatePlaceholders({
    patient,
    encounterRef: task.focus?.reference,
    oystehr,
    secrets,
  });
  const resolvedMessage = fillOutreachTemplate(template, placeholderInput);

  // Check for unresolved placeholders
  const unresolved = resolvedMessage.match(/\{\{[\w-]+\}\}/g);
  if (unresolved) {
    const unique = [...new Set(unresolved)];
    throw new Error(`Unresolved template placeholders: ${unique.join(', ')}`);
  }

  const htmlContent = convertOutreachTextToHtml(resolvedMessage);

  const emailClient = getEmailClient(secrets);
  await emailClient.sendGenericOutreachEmail(email, {
    content: htmlContent,
    'subject-text': 'Important information about your visit',
  });
}

const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';

async function sendPaperMail(
  task: Task,
  statementType: string,
  oystehr: Oystehr,
  _secrets: Secrets | null
): Promise<void> {
  const patientId = task.for?.reference?.replace('Patient/', '');
  if (!patientId) throw new Error('Task has no patient reference');

  const encounterRef = task.focus?.reference;
  const encounterId = encounterRef?.replace('Encounter/', '');
  if (!encounterId) throw new Error('Task has no encounter focus reference');

  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });

  const appointmentRef = encounter.appointment?.[0]?.reference;
  const appointmentId = appointmentRef?.split('/')[1];
  if (!appointmentId) throw new Error(`No appointment reference in Encounter/${encounterId}`);

  const [patient, appointment] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId }),
  ]);

  const patientName = getFullestAvailableName(patient);
  const appointmentDate = appointment.start
    ? DateTime.fromISO(appointment.start, { setZone: true }).toFormat('yyyy-MM-dd')
    : 'unknown-date';

  const validType = (['standard', 'past-due', 'final-notice'] as StatementType[]).includes(
    statementType as StatementType
  )
    ? (statementType as StatementType)
    : 'standard';

  const mailTaskInputs: TaskInput[] = [
    {
      type: { coding: [{ system: MAIL_STATEMENT_TASK_INPUT_SYSTEM, code: 'statementType' }] },
      valueString: validType,
    },
    {
      type: { coding: [{ system: MAIL_STATEMENT_TASK_INPUT_SYSTEM, code: 'color' }] },
      valueString: 'false',
    },
  ];

  const mailTask: Task = {
    ...getTaskResource(
      TaskIndicator.sendPatientStatementByMail,
      `Send statement by mail for ${patientName} visit on ${appointmentDate} (outreach)`,
      appointmentId,
      encounterId
    ),
    for: { reference: `Patient/${patientId}` },
    input: mailTaskInputs,
  };

  const created = await oystehr.fhir.create<Task>(mailTask);
  console.log(`Created mail statement task ${created.id} (type: ${validType}) for patient ${patientId}`);
}
