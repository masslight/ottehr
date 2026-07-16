import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Provenance, Task } from 'fhir/r4b';
import {
  getOutboundDeliveryInput,
  getOutboundDeliveryRecipientSnapshot,
  getReferenceId,
  GetVisitFaxHistoryInput,
  GetVisitFaxHistoryInputSchema,
  GetVisitFaxHistoryInputValidated,
  GetVisitFaxHistoryInputValidatedSchema,
  GetVisitFaxHistoryOutput,
  INVALID_INPUT_ERROR,
  MISSING_AUTH_TOKEN,
  MISSING_REQUEST_BODY,
  OUTBOUND_DELIVERY_INPUT_CODES,
  OUTBOUND_DELIVERY_TASK_CODES,
  OUTBOUND_DELIVERY_TASK_SYSTEM,
  PROVENANCE_FAX_ACTIVITY_CODES,
  PROVENANCE_FAX_SYSTEM,
} from 'utils';
import { ZodError } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  formatZodError,
  safeJsonParse,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-visit-fax-history';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  console.group('performEffect');
  const resources = await performEffect(validatedParameters, oystehr);
  console.groupEnd();
  console.debug('performEffect success', JSON.stringify(resources));

  return {
    statusCode: 200,
    body: JSON.stringify(resources),
  };
});

const performEffect = async (input: GetVisitFaxHistoryInput, oystehr: Oystehr): Promise<GetVisitFaxHistoryOutput> => {
  const { appointmentId } = input;

  const [tasksBundle, provenanceBundle] = await Promise.all([
    oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        { name: 'code', value: `${OUTBOUND_DELIVERY_TASK_SYSTEM}|${OUTBOUND_DELIVERY_TASK_CODES.fax}` },
        { name: 'focus', value: `Appointment/${appointmentId}` },
        { name: '_count', value: '1000' },
      ],
    }),
    oystehr.fhir.search<Provenance>({
      resourceType: 'Provenance',
      params: [
        {
          name: 'target',
          value: `Appointment/${appointmentId}`,
        },
      ],
    }),
  ]);
  const tasks = tasksBundle.unbundle();
  const allProvenances = provenanceBundle.unbundle();
  console.log(`found ${allProvenances.length} provenances for appointment ${appointmentId}`);

  const faxProvenances = allProvenances.filter(
    (provenance) =>
      provenance.activity?.coding?.some(
        (coding) => coding.code === PROVENANCE_FAX_ACTIVITY_CODES.faxSent && coding.system === PROVENANCE_FAX_SYSTEM
      )
  );

  console.log(`found ${faxProvenances.length} fax provenances for appointment ${appointmentId}`);

  const communicationIdsInTasks = new Set(
    tasks
      .map((task) => getOutboundDeliveryRecipientSnapshot(task).communicationId)
      .filter((id): id is string => Boolean(id))
  );
  const taskFaxes = tasks
    .filter(
      (task) => task.status === 'completed' || Boolean(getOutboundDeliveryRecipientSnapshot(task).communicationId)
    )
    .map((task) => ({
      recipientNumber: getOutboundDeliveryRecipientSnapshot(task).address ?? '',
      created: task.authoredOn ?? task.executionPeriod?.start ?? '',
      sender: {
        id: getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderId)?.valueString ?? '',
        display: getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderDisplay)?.valueString ?? 'n/a',
      },
    }))
    .filter((fax) => fax.recipientNumber && fax.created);

  const legacyFaxes = faxProvenances
    .filter((provenance) => {
      const communicationId = provenance.target
        .map((target) => getReferenceId(target.reference, 'Communication'))
        .find(Boolean);
      return !communicationId || !communicationIdsInTasks.has(communicationId);
    })
    .map((provenance) => {
      const recipientNumber = provenance.contained
        ?.find((resource) => resource.resourceType === 'Practitioner')
        ?.telecom?.find((telecom) => telecom.system === 'fax')?.value;
      const created = provenance.occurredDateTime;
      const senderId = provenance.agent?.[0]?.who?.identifier?.value;
      const senderDisplay = provenance.agent?.[0]?.who?.display;

      return {
        recipientNumber: recipientNumber ?? '',
        created: created ?? '',
        sender: {
          id: senderId ?? '',
          display: senderDisplay ?? 'n/a',
        },
      };
    })
    .filter((fax) => fax.recipientNumber && fax.created);
  return { faxesSent: [...taskFaxes, ...legacyFaxes].sort((a, b) => b.created.localeCompare(a.created)) };
};

function validateRequestParameters(input: ZambdaInput): GetVisitFaxHistoryInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.headers?.Authorization) {
    throw MISSING_AUTH_TOKEN;
  }

  let parsed: unknown;
  try {
    parsed = safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Invalid JSON in request body.');
  }

  try {
    const validatedCore = GetVisitFaxHistoryInputSchema.parse(parsed);

    const validated = GetVisitFaxHistoryInputValidatedSchema.parse({
      ...validatedCore,
      secrets: input.secrets,
    });

    return validated;
  } catch (err) {
    if (err instanceof ZodError) {
      throw INVALID_INPUT_ERROR(`Invalid request parameters: ${formatZodError(err)}`);
    }
    throw err;
  }
}
