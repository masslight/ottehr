import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, Task } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { NotificationMedium } from 'utils/lib/types/api/scheduled-outreach.types';
import { deliverOutreachNotification } from '../../../rcm/scheduled-outreach/executors/outreach-delivery';
import {
  claimOutreachTask,
  failOutreachTask,
  finishNotificationTask,
} from '../../../rcm/scheduled-outreach/executors/outreach-task-execution';
import { resolveOutreachTaskStripeAccount } from '../../../rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse } from '../../../shared/validation';

let m2mToken: string;

const ZAMBDA_NAME = 'sub-outreach-send-notification';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw new Error('No request body provided');
  if (!input.secrets) throw new Error('Secrets are not defined');

  const task: Task = safeJsonParse(input.body);

  if (task.resourceType !== 'Task') {
    throw new Error(`Expected Task resource but got ${task.resourceType}`);
  }

  if (task.status !== 'requested') {
    console.log(`Task ${task.id} is not in "requested" status (current: ${task.status}), skipping`);
    return { statusCode: 200, body: JSON.stringify({ message: 'Task not in requested status, skipped' }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  if (!(await claimOutreachTask(oystehr, task))) {
    return { statusCode: 200, body: JSON.stringify({ message: 'Task already claimed, skipped' }) };
  }

  try {
    const mediums = extractMediums(task);
    const smsTemplate = extractInputValue(task, 'sms-template');
    const emailTemplate = extractInputValue(task, 'email-template');
    const patientRef = task.for?.reference;

    // Fetch the Patient once for the whole task. All mediums validate against and send to the same
    // snapshot, avoiding redundant FHIR reads and validate-vs-send inconsistencies. Missing reference
    // or a failed fetch is a system/data error (not an invalid contact), so we throw and fail the task.
    if (!patientRef) throw new Error('Task has no patient reference');
    const patientId = patientRef.startsWith('Patient/') ? removePrefix('Patient/', patientRef) : undefined;
    if (!patientId || patientId.includes('/')) {
      throw new Error(`Task patient reference "${patientRef}" is not a literal "Patient/<id>" reference`);
    }
    let patient: Patient;
    try {
      patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
    } catch (err) {
      throw new Error(`Failed to fetch patient ${patientId} for notification: ${describeFhirError(err)}`);
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

    const results = await deliverOutreachNotification({
      oystehr,
      secrets: input.secrets,
      patient,
      encounterRef: task.focus?.reference,
      stripeAccount: await resolveOutreachTaskStripeAccount(task, oystehr),
      mediums,
      smsTemplate,
      emailTemplate,
      statementType: extractInputValue(task, 'statement-type'),
    });
    const finalStatus = await finishNotificationTask(oystehr, task, results);
    return { statusCode: 200, body: JSON.stringify({ status: finalStatus, results }) };
  } catch (err: any) {
    console.error(`Unexpected error executing task ${task.id}:`, err.message);

    await failOutreachTask(oystehr, task, err.message);

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

function describeFhirError(err: unknown): string {
  if (err instanceof Oystehr.OystehrFHIRError) {
    return `${err.code} ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
