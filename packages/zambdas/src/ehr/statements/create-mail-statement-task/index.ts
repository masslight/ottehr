import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient, Task, TaskInput } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getFullestAvailableName,
  getSecret,
  getTaskResource,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  Secrets,
  SecretsKeys,
  TaskIndicator,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  StatementType,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'create-mail-statement-task';
const validStatementTypes = new Set<StatementType>(['standard', 'past-due', 'final-notice']);
const MAIL_STATEMENT_TASK_INPUT_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/patient-statement-mail-task-input';

interface CreateMailStatementTaskInput {
  encounterId: string;
  statementType: StatementType;
  color: boolean;
  secrets: Secrets;
}

let m2mToken: string;

function validateRequestParameters(input: ZambdaInput): CreateMailStatementTaskInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = JSON.parse(input.body) as Record<string, unknown>;

  const encounterId = body.encounterId;
  if (typeof encounterId !== 'string' || encounterId.trim().length === 0) {
    throw new Error('encounterId is required');
  }

  const color = body.color;
  if (typeof color !== 'boolean') {
    throw new Error('color must be a boolean (true or false)');
  }

  const statementType = body.statementType;
  if (statementType == null) {
    return {
      encounterId,
      statementType: 'standard',
      color,
      secrets: input.secrets,
    };
  }

  if (typeof statementType !== 'string' || !validStatementTypes.has(statementType as StatementType)) {
    throw new Error('statementType must be one of: standard, past-due, final-notice');
  }

  return {
    encounterId,
    statementType: statementType as StatementType,
    color,
    secrets: input.secrets,
  };
}

function createTaskInput(statementType: StatementType, color: boolean): TaskInput[] {
  return [
    {
      type: {
        coding: [
          {
            system: MAIL_STATEMENT_TASK_INPUT_SYSTEM,
            code: 'statementType',
          },
        ],
      },
      valueString: statementType,
    },
    {
      type: {
        coding: [
          {
            system: MAIL_STATEMENT_TASK_INPUT_SYSTEM,
            code: 'color',
          },
        ],
      },
      valueString: String(color),
    },
  ];
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedInput.secrets);

    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: validatedInput.encounterId,
    });

    const patientReference = encounter.subject?.reference;
    if (!patientReference) {
      throw new Error(`Patient reference not found in Encounter/${validatedInput.encounterId}`);
    }

    const patientId = patientReference.split('/')[1];
    if (!patientId) {
      throw new Error(`Patient id not found in Encounter/${validatedInput.encounterId}`);
    }

    const appointmentReference = encounter.appointment?.[0]?.reference;
    const appointmentId = appointmentReference?.split('/')[1];
    if (!appointmentId) {
      throw new Error(`Appointment reference not found in Encounter/${validatedInput.encounterId}`);
    }

    const patient = await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: patientId,
    });
    const appointment = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentId,
    });

    const patientName = getFullestAvailableName(patient);
    const appointmentDate = appointment.start
      ? DateTime.fromISO(appointment.start, { setZone: true }).toFormat('yyyy-MM-dd')
      : 'unknown-date';

    const task: Task = {
      ...getTaskResource(
        TaskIndicator.sendPatientStatementByMail,
        `Send statement by mail for ${patientName} visit on ${appointmentDate}`,
        appointmentId,
        validatedInput.encounterId
      ),
      for: {
        reference: patientReference,
      },
      input: createTaskInput(validatedInput.statementType, validatedInput.color),
    };

    const createdTask = await oystehr.fhir.create<Task>(task);

    return {
      statusCode: 200,
      body: JSON.stringify({
        taskId: createdTask.id,
        taskReference: `Task/${createdTask.id}`,
      }),
    };
  } catch (error: unknown) {
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});
