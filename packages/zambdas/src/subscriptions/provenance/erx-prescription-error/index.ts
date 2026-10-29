import { APIGatewayProxyResult } from 'aws-lambda';
import { Provenance } from 'fhir/r4b';
import { ERX_EVENT_CODE_SYSTEM, ERX_MEDICATION_META_TAG_CODE } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { medicationRequestIdFromReference } from '../../../shared/chart-data';
import { createPrescriptionTasks } from '../../../shared/erx-prescription-tasks';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

const ZAMBDA_NAME = 'erx-prescription-error-subscription';

interface Input {
  provenance: Provenance;
  secrets: Secrets | null;
}

let m2mToken: string;

// The eRx service records each event of a prescription as a Provenance; an error event's code is "error <code>".
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { provenance, secrets } = validateRequestParameters(input);

  const code = provenance.activity?.coding?.find((coding) => coding.system === ERX_EVENT_CODE_SYSTEM)?.code;
  const medicationRequestId = provenance.target
    .map((target) => medicationRequestIdFromReference(target.reference))
    .find(Boolean);
  if (!code?.startsWith('error') || !medicationRequestId) {
    return { statusCode: 200, body: JSON.stringify({ skipped: code ?? 'not an eRx event' }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const created = await createPrescriptionTasks(oystehr, [
    { name: '_id', value: medicationRequestId },
    { name: '_tag', value: ERX_MEDICATION_META_TAG_CODE },
  ]);

  return {
    statusCode: 200,
    body: JSON.stringify({ taskIds: created.map((task) => task.id) }),
  };
});

function validateRequestParameters(input: ZambdaInput): Input {
  const body = validateJsonBody(input);

  if (body.resourceType !== 'Provenance') {
    throw INVALID_INPUT_ERROR('Request body must be a Provenance resource');
  }

  return {
    provenance: body as Provenance,
    secrets: input.secrets,
  };
}
