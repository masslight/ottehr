import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { phone } from 'phone';
import {
  convertOutreachTextToHtml,
  FEATURE_FLAGS_CONFIG,
  getFullestAvailableName,
  getPatientContactEmail,
  getPhoneNumberForIndividual,
  getSecret,
  getTaskResource,
  isEmailValid,
  maskEmail,
  maskPhoneNumber,
  Secrets,
  SecretsKeys,
  TaskIndicator,
} from 'utils';
import { NotificationMedium } from '../../../rcm/scheduled-outreach-config/helpers';
import {
  checkOrCreateM2MClientToken,
  createOutreachEmailCommunication,
  createOystehrClient,
  fillOutreachTemplate,
  getEmailClient,
  resolveTemplatePlaceholders,
  sendSmsForPatient,
  StatementType,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

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

  // Mark as in-progress with optimistic locking to guard against duplicate
  // subscription deliveries racing to execute the same task. If another
  // invocation already claimed it, the version will be stale (412) and we skip.
  try {
    await oystehr.fhir.patch<Task>(
      {
        resourceType: 'Task',
        id: task.id!,
        operations: [{ op: 'replace', path: '/status', value: 'in-progress' }],
      },
      { optimisticLockingVersionId: task.meta?.versionId }
    );
  } catch (err) {
    if (err instanceof Oystehr.OystehrFHIRError && err.code === 412) {
      console.log(`Task ${task.id} was already claimed by another invocation (version conflict), skipping`);
      return { statusCode: 200, body: JSON.stringify({ message: 'Task already claimed, skipped' }) };
    }
    throw err;
  }

  try {
    const mediums = extractMediums(task);
    const smsTemplate = extractInputValue(task, 'sms-template');
    const emailTemplate = extractInputValue(task, 'email-template');
    const patientRef = task.for?.reference;

    // Fetch the Patient once for the whole task. All mediums validate against and send to the same
    // snapshot, avoiding redundant FHIR reads and validate-vs-send inconsistencies. Missing reference
    // or a failed fetch is a system/data error (not an invalid contact), so we throw and fail the task.
    const patientId = patientRef?.replace('Patient/', '');
    if (!patientId) throw new Error('Task has no patient reference');
    let patient: Patient;
    try {
      patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
    } catch {
      throw new Error(`Failed to fetch patient ${patientId} for notification`);
    }

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

    const results: { medium: NotificationMedium; success: boolean; error?: string; skippedReason?: string }[] = [];

    for (const medium of mediums) {
      try {
        switch (medium) {
          case 'sms': {
            const smsValidation = validatePatientPhone(patient);
            if (!smsValidation.valid) {
              console.log(`[SMS] Skipping SMS for task ${task.id}, patient ${patientRef}: ${smsValidation.reason}`);
              results.push({
                medium,
                success: false,
                error: smsValidation.reason,
                skippedReason: smsValidation.reason,
              });
              break;
            }
            await sendOutreachSms(task, smsTemplate || '', oystehr, input.secrets, patient);
            console.log(`[SMS] Successfully sent SMS notification for task ${task.id}, patient ${patientRef}`);
            results.push({ medium, success: true });
            break;
          }
          case 'email': {
            const emailValidation = validatePatientEmail(patient);
            if (!emailValidation.valid) {
              console.log(
                `[Email] Skipping email for task ${task.id}, patient ${patientRef}: ${emailValidation.reason}`
              );
              results.push({
                medium,
                success: false,
                error: emailValidation.reason,
                skippedReason: emailValidation.reason,
              });
              break;
            }
            await sendOutreachEmail(task, emailTemplate || '', oystehr, input.secrets, patient);
            console.log(`[Email] Successfully sent email notification for task ${task.id}, patient ${patientRef}`);
            results.push({ medium, success: true });
            break;
          }
          case 'paper-mail': {
            if (!FEATURE_FLAGS_CONFIG.mailingPaperStatementsEnabled) {
              console.error(
                `[Paper Mail] Paper mail statements feature is disabled but task ${task.id} requested paper-mail for patient ${patientRef}. Marking medium as failed.`
              );
              results.push({ medium, success: false, error: 'Paper mail statements feature is disabled' });
              break;
            }
            const statementType = extractInputValue(task, 'statement-type') || 'standard';
            await sendPaperMail(task, statementType, oystehr, input.secrets, patient);
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
    const anySucceeded = results.some((r) => r.success);
    const allSkippedDueToContacts = !allSucceeded && results.every((r) => r.success || !!r.skippedReason);

    // If at least one medium succeeded, treat the task as completed.
    // Only cancel if every medium was skipped due to invalid contacts.
    // Only fail if no medium succeeded and at least one had a real (non-contact) error.
    const finalStatus = allSucceeded || anySucceeded ? 'completed' : allSkippedDueToContacts ? 'cancelled' : 'failed';

    // Log per-medium failures even when the task overall succeeds
    const failedMediums = results.filter((r) => !r.success);
    if (failedMediums.length > 0 && finalStatus === 'completed') {
      console.log(
        `Task ${task.id} completed with partial medium failures: ${failedMediums
          .map((r) => `${r.medium}: ${r.error || r.skippedReason}`)
          .join('; ')}`
      );
    }

    const patchOps: { op: 'replace' | 'add'; path: string; value: unknown }[] = [
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
    ];

    if (allSkippedDueToContacts) {
      const reasons = results.filter((r) => r.skippedReason).map((r) => `${r.medium}: ${r.skippedReason}`);
      patchOps.push({
        op: 'add',
        path: '/statusReason',
        value: { text: `No valid contact methods: ${reasons.join('; ')}` },
      });
    }

    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: patchOps,
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

// ── Contact validation ─────────────────────────────────────────────────────

function validatePatientPhone(patient: Patient): { valid: boolean; reason?: string } {
  const rawPhone = getPhoneNumberForIndividual(patient);
  if (!rawPhone) {
    return { valid: false, reason: 'No phone number on file' };
  }
  const result = phone(rawPhone, { country: 'USA' });
  if (!result.isValid) {
    console.log(`Invalid phone number for patient ${patient.id}: ${maskPhoneNumber(rawPhone)}`);
    // Store a generic reason on the Task — never persist the raw/masked contact value.
    return { valid: false, reason: 'Invalid phone number' };
  }
  return { valid: true };
}

function validatePatientEmail(patient: Patient): { valid: boolean; reason?: string } {
  const rawEmail = getPatientContactEmail(patient);
  if (!rawEmail) {
    return { valid: false, reason: 'No email address on file' };
  }
  if (!isEmailValid(rawEmail)) {
    console.log(`Invalid email address for patient ${patient.id}: ${maskEmail(rawEmail)}`);
    // Store a generic reason on the Task — never persist the raw/masked contact value.
    return { valid: false, reason: 'Invalid email address' };
  }
  return { valid: true };
}

// ── Integration placeholders ───────────────────────────────────────────────
// These will be replaced with actual integrations (Twilio, SendGrid, Lob, etc.)

async function sendOutreachSms(
  task: Task,
  template: string,
  oystehr: Oystehr,
  secrets: Secrets | null,
  patient: Patient
): Promise<void> {
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
  secrets: Secrets | null,
  patient: Patient
): Promise<void> {
  const patientId = patient.id!;

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

  // Record email as a FHIR Communication resource
  await createOutreachEmailCommunication({
    oystehr,
    patientId,
    encounterRef: task.focus?.reference,
    recipientEmail: email,
    htmlContent,
    resolvedMessage,
  });
}

const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';

async function sendPaperMail(
  task: Task,
  statementType: string,
  oystehr: Oystehr,
  _secrets: Secrets | null,
  patient: Patient
): Promise<void> {
  const patientId = patient.id!;

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

  const appointment = await oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId });

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
