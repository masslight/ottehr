import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Communication, Encounter, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { generateStatement, getSecret, RCM_TASK_SYSTEM, Secrets, SecretsKeys, TaskIndicator } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getStatementDetails,
  getStatementTemplate,
  sendPostGridLetter,
  StatementType,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from '../validateRequestParameters';

const ZAMBDA_NAME = 'sub-send-patient-statement-by-mail';
const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';
const validStatementTypes = new Set<StatementType>(['standard', 'past-due', 'final-notice']);

let m2mToken: string;

interface ParsedTaskInput {
  encounterId: string;
  statementType: StatementType;
  color: boolean;
  task: Task;
  secrets: Secrets;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let oystehr: Oystehr | undefined;
  let task: Task | undefined;

  try {
    const validatedInput = validateInput(input);
    const { encounterId, statementType, color, secrets } = validatedInput;
    task = validatedInput.task;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    oystehr = createOystehrClient(m2mToken, secrets);

    await patchTaskStatus(oystehr, task.id!, 'in-progress');

    const templatePayload = getStatementTemplate('statement-template');
    const statementDetails = await getStatementDetails({
      encounterId,
      statementType,
      secrets,
      oystehr,
    });
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });

    const html = generateStatement(templatePayload.template, statementDetails);
    const patientId = encounter.subject?.reference?.split('/')[1];
    if (!patientId) {
      throw new Error(`Patient id not found in "Encounter/${encounterId}"`);
    }

    const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);

    console.log(
      `Preparing to mail statement ${JSON.stringify({
        encounterId,
        patientId,
        projectId,
      })}`
    );

    const description = `${statementDetails.biller.name} - Statement - ${statementDetails.patient.firstName} ${statementDetails.patient.lastName} - Visit on ${statementDetails.visit.date}`;

    const postGridLetter = await sendPostGridLetter(
      {
        description,
        from: {
          companyName: statementDetails.biller.name,
          addressLine1: statementDetails.biller.addressLine1,
          addressLine2: statementDetails.biller.addressLine2,
          city: statementDetails.biller.city,
          provinceOrState: statementDetails.biller.provinceOrState,
          postalOrZip: statementDetails.biller.postalOrZip,
          countryCode: statementDetails.biller.countryCode,
        },
        to: {
          firstName: statementDetails.respParty.firstName,
          lastName: statementDetails.respParty.lastName,
          addressLine1: statementDetails.respParty.addressLine1,
          addressLine2: statementDetails.respParty.addressLine2,
          city: statementDetails.respParty.city,
          provinceOrState: statementDetails.respParty.provinceOrState,
          postalOrZip: statementDetails.respParty.postalOrZip,
          countryCode: statementDetails.respParty.countryCode,
        },
        html,
        addressPlacement: 'top_first_page',
        color,
        doubleSided: true,
        metadata: {
          oyster_patient_id: patientId,
          oystehr_encounter_id: encounterId,
          oystehr_project_id: projectId,
        },
      },
      secrets
    );

    console.log(
      `Mailed statement ${JSON.stringify({
        encounterId,
        color,
        mailId: postGridLetter.id,
        mailStatus: postGridLetter.status,
      })}`
    );

    const billingOrganizationRef = getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets);

    const communication = await oystehr.fhir.create<Communication>({
      resourceType: 'Communication',
      status: 'in-progress',
      medium: [
        {
          coding: [
            {
              system: 'https://terminology.hl7.org/6.0.2/ValueSet-v3-ParticipationMode.html',
              code: 'MAILWRIT',
              display: 'mail',
            },
          ],
          text: 'mail',
        },
      ],
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      sender: {
        reference: billingOrganizationRef,
      },
      recipient: [
        {
          display: `${statementDetails.respParty.firstName} ${statementDetails.respParty.lastName}`,
        },
      ],
      payload: [
        {
          contentString: description,
        },
      ],
      sent: DateTime.now().toUTC().toISO() ?? undefined,
      extension: [
        {
          url: 'https://extensions.fhir.ottehr.com/mail-vendor',
          extension: [
            {
              url: 'vendor',
              valueString: 'postgrid',
            },
            {
              url: 'vendor-letter-id',
              valueString: postGridLetter.id,
            },
            {
              url: 'vendor-letter-status',
              valueString: postGridLetter.status,
            },
            {
              url: 'vendor-letter-url',
              valueString: postGridLetter.url ?? '',
            },
            {
              url: 'vendor-send-date',
              valueString: postGridLetter.sendDate ?? '',
            },
          ],
        },
      ],
    });

    console.log(`Created Communication/${communication.id} for mail tracking`);

    await patchTaskStatus(oystehr, task.id!, 'completed');

    return {
      statusCode: 200,
      body: JSON.stringify({
        mailId: postGridLetter.id,
        mailStatus: postGridLetter.status,
      }),
    };
  } catch (error: unknown) {
    if (oystehr && task?.id) {
      try {
        await patchTaskStatus(oystehr, task.id, 'failed', error instanceof Error ? error.message : String(error));
      } catch (patchError: unknown) {
        console.error('Failed to patch task to failed status:', patchError);
      }
    }

    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});

function getTaskInputValue(task: Task, code: string): string | undefined {
  return task.input?.find(
    (input) =>
      input.type.coding?.find((coding) => coding.system === MAIL_STATEMENT_TASK_INPUT_SYSTEM && coding.code === code)
  )?.valueString;
}

function parseBooleanInput(value: string | undefined, fieldName: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${fieldName} must be provided as true or false`);
}

function validateInput(input: ZambdaInput): ParsedTaskInput {
  const { task, secrets } = validateRequestParameters(input);

  const isMailStatementTask = task.code?.coding?.some(
    (coding) =>
      coding.system === TaskIndicator.sendPatientStatementByMail.system &&
      coding.code === TaskIndicator.sendPatientStatementByMail.code
  );

  if (!isMailStatementTask) {
    throw new Error(
      `Task code must be ${TaskIndicator.sendPatientStatementByMail.system}|${TaskIndicator.sendPatientStatementByMail.code}`
    );
  }

  const encounterId = task.encounter?.reference?.split('/')[1];
  if (!encounterId) {
    throw new Error('encounterId is required in task.encounter.reference');
  }

  const statementTypeRaw = getTaskInputValue(task, 'statementType') ?? 'standard';
  if (!validStatementTypes.has(statementTypeRaw as StatementType)) {
    throw new Error('statementType task input must be one of: standard, past-due, final-notice');
  }

  const color = parseBooleanInput(getTaskInputValue(task, 'color'), 'color');

  return {
    encounterId,
    statementType: statementTypeRaw as StatementType,
    color,
    task,
    secrets,
  };
}

async function patchTaskStatus(
  oystehr: Oystehr,
  taskId: string,
  status: Task['status'],
  reason?: string
): Promise<void> {
  const operations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: status,
    },
  ];

  if (reason) {
    operations.push({
      op: 'add',
      path: '/statusReason',
      value: {
        coding: [
          {
            system: RCM_TASK_SYSTEM,
            code: reason,
          },
        ],
      },
    });
  }

  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations,
  });
}
