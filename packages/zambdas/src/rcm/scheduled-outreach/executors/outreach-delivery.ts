import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { phone } from 'phone';
import { getTaskResource } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName, getPatientContactEmail, getPhoneNumberForIndividual } from 'utils/lib/fhir/patient';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { convertOutreachTextToHtml, isEmailValid, maskEmail, maskPhoneNumber } from 'utils/lib/helpers/helpers';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { NotificationMedium, OutreachMediumResult } from 'utils/lib/types/api/scheduled-outreach.types';
import { TaskIndicator } from 'utils/lib/types/common';
import {
  createOutreachEmailCommunication,
  getEmailClient,
  isInvalidPhoneNumberError,
  sendSmsForPatient,
} from '../../../shared/communication';
import { StatementType } from '../../../shared/statements/get-statement-details';
import { fillOutreachTemplate, resolveTemplatePlaceholders } from '../../../shared/template-placeholders';

const INVALID_PHONE_REASON = 'Invalid phone number';

interface DeliverOutreachNotificationParams {
  oystehr: Oystehr;
  secrets: Secrets | null;
  patient: Patient;
  encounterRef: string | undefined;
  stripeAccount: string | undefined;
  mediums: NotificationMedium[];
  smsTemplate?: string;
  emailTemplate?: string;
  statementType?: string;
}

export async function deliverOutreachNotification(
  params: DeliverOutreachNotificationParams
): Promise<OutreachMediumResult[]> {
  const { oystehr, secrets, patient, encounterRef, stripeAccount, mediums, smsTemplate, emailTemplate, statementType } =
    params;
  const results: OutreachMediumResult[] = [];

  for (const medium of mediums) {
    try {
      switch (medium) {
        case 'sms': {
          const smsValidation = validatePatientPhone(patient);
          if (!smsValidation.valid) {
            console.log(`[SMS] Skipping SMS for Patient/${patient.id}: ${smsValidation.reason}`);
            results.push({
              medium,
              success: false,
              error: smsValidation.reason,
              skippedReason: smsValidation.reason,
            });
            break;
          }
          const smsSkippedReason = await sendOutreachSms(
            smsTemplate || '',
            oystehr,
            secrets,
            patient,
            encounterRef,
            stripeAccount
          );
          if (smsSkippedReason) {
            console.log(`[SMS] Skipping SMS for Patient/${patient.id}: ${smsSkippedReason}`);
            results.push({ medium, success: false, error: smsSkippedReason, skippedReason: smsSkippedReason });
            break;
          }
          console.log(`[SMS] Successfully sent SMS notification for Patient/${patient.id}`);
          results.push({ medium, success: true });
          break;
        }
        case 'email': {
          const emailValidation = validatePatientEmail(patient);
          if (!emailValidation.valid) {
            console.log(`[Email] Skipping email for Patient/${patient.id}: ${emailValidation.reason}`);
            results.push({
              medium,
              success: false,
              error: emailValidation.reason,
              skippedReason: emailValidation.reason,
            });
            break;
          }
          await sendOutreachEmail(emailTemplate || '', oystehr, secrets, patient, encounterRef, stripeAccount);
          console.log(`[Email] Successfully sent email notification for Patient/${patient.id}`);
          results.push({ medium, success: true });
          break;
        }
        case 'paper-mail': {
          if (!FEATURE_FLAGS_CONFIG.mailingPaperStatementsEnabled) {
            console.error(
              `[Paper Mail] Paper mail statements feature is disabled but Patient/${patient.id} requested paper-mail. Marking medium as failed.`
            );
            results.push({ medium, success: false, error: 'Paper mail statements feature is disabled' });
            break;
          }
          await sendPaperMail(statementType || 'standard', oystehr, patient, encounterRef);
          console.log(`[Paper Mail] Successfully created paper mail task for Patient/${patient.id}`);
          results.push({ medium, success: true });
          break;
        }
      }
    } catch (err: any) {
      const errorDetail = err.response?.body ? JSON.stringify(err.response.body) : err.message;
      console.error(
        `[${medium.toUpperCase()}] Failed to send ${medium} notification for Patient/${patient.id}: ${errorDetail}`
      );
      results.push({ medium, success: false, error: errorDetail });
    }
  }

  return results;
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
    return { valid: false, reason: INVALID_PHONE_REASON };
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

async function sendOutreachSms(
  template: string,
  oystehr: Oystehr,
  secrets: Secrets | null,
  patient: Patient,
  encounterRef: string | undefined,
  stripeAccount: string | undefined
): Promise<string | undefined> {
  const placeholderInput = await resolveTemplatePlaceholders({
    patient,
    encounterRef,
    stripeAccount,
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
  const { total, sent, failures } = await sendSmsForPatient(resolvedMessage, oystehr, patient, ENVIRONMENT);
  if (total === 0) return 'No SMS recipient';
  if (sent > 0) return undefined;
  const realFailure = failures.find((f) => !isInvalidPhoneNumberError(f.error));
  if (realFailure) throw realFailure.error;
  return INVALID_PHONE_REASON;
}

async function sendOutreachEmail(
  template: string,
  oystehr: Oystehr,
  secrets: Secrets | null,
  patient: Patient,
  encounterRef: string | undefined,
  stripeAccount: string | undefined
): Promise<void> {
  const patientId = patient.id!;

  const email = getPatientContactEmail(patient);
  if (!email) {
    throw new Error(`Patient ${patientId} has no contact email address`);
  }

  const placeholderInput = await resolveTemplatePlaceholders({
    patient,
    encounterRef,
    stripeAccount,
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
    encounterRef,
    recipientEmail: email,
    htmlContent,
    resolvedMessage,
  });
}

const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';

async function sendPaperMail(
  statementType: string,
  oystehr: Oystehr,
  patient: Patient,
  encounterRef: string | undefined
): Promise<void> {
  const patientId = patient.id!;

  const encounterId = getIdFromReference(encounterRef, 'Encounter');
  if (!encounterId) throw new Error('Task has no encounter focus reference');

  const encounter = await oystehr.fhir.get<Encounter>({
    resourceType: 'Encounter',
    id: encounterId,
  });

  const appointmentRef = encounter.appointment?.[0]?.reference;
  const appointmentId = getIdFromReference(appointmentRef);
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
