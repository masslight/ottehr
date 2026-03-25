import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner, Provenance } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getSecret,
  GetVisitFaxHistoryInput,
  GetVisitFaxHistoryInputSchema,
  GetVisitFaxHistoryInputValidated,
  GetVisitFaxHistoryInputValidatedSchema,
  GetVisitFaxHistoryOutput,
  PROVENANCE_FAX_ACTIVITY_CODES,
  PROVENANCE_FAX_SYSTEM,
  SecretsKeys,
} from 'utils';
import { ZodError } from 'zod';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  formatZodError,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-visit-fax-history';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    const resources = await performEffect(validatedParameters, oystehr);
    console.groupEnd();
    console.debug('performEffect success', JSON.stringify(resources));

    return {
      statusCode: 200,
      body: JSON.stringify(resources),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (input: GetVisitFaxHistoryInput, oystehr: Oystehr): Promise<GetVisitFaxHistoryOutput> => {
  const { appointmentId } = input;

  const allProvenances = (
    await oystehr.fhir.search<Provenance>({
      resourceType: 'Provenance',
      params: [
        {
          name: 'target',
          value: `Appointment/${appointmentId}`,
        },
      ],
    })
  ).unbundle();
  console.log(`found ${allProvenances.length} provenances for appointment ${appointmentId}`);

  const faxProvenances = allProvenances.filter(
    (provenance) =>
      provenance.activity?.coding?.some(
        (coding) => coding.code === PROVENANCE_FAX_ACTIVITY_CODES.faxSent && coding.system === PROVENANCE_FAX_SYSTEM
      )
  );

  console.log(`found ${faxProvenances.length} fax provenances for appointment ${appointmentId}`);

  const faxesSent = faxProvenances.map((provenance) => {
    const recipientNumber = (provenance.contained?.[0] as Practitioner | undefined)?.telecom?.[0].value;
    const created = provenance.occurredDateTime;
    const senderId = provenance.agent?.[0].who.identifier?.value;
    const senderDisplay = provenance.agent?.[0].who.display;

    if (!recipientNumber) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Fax provenance is missing recipient fax number');
    if (!created) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Fax provenance is missing occurredDateTime');
    if (!senderId) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Fax provenance is missing sender id');
    if (!senderDisplay) throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Fax provenance is missing sender display');

    return {
      recipientNumber,
      created,
      sender: {
        id: senderId,
        display: senderDisplay,
      },
    };
  });
  return { faxesSent };
};

function validateRequestParameters(input: ZambdaInput): GetVisitFaxHistoryInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.headers?.Authorization) {
    throw new Error('Authorization header is required');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body.');
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
      throw new Error(`Invalid request parameters: ${formatZodError(err)}`);
    }
    throw err;
  }
}
