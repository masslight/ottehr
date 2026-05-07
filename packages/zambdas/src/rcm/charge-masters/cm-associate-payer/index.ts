import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition, UsageContext } from 'fhir/r4b';
import { getPayerUrl, orgIdMatchesReference } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('cm-associate-payer', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { chargeMasterId, organizationId, locationId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const existing = await oystehr.fhir.get<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    id: chargeMasterId,
  });

  const newContextEntries: UsageContext[] = [];

  if (organizationId) {
    const alreadyAssociated = existing.useContext?.some((uc) =>
      orgIdMatchesReference(uc.valueReference?.reference, organizationId)
    );
    if (!alreadyAssociated) {
      newContextEntries.push({
        code: {
          system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
          code: 'payer',
          display: 'Payer',
        },
        valueReference: {
          reference: getPayerUrl(organizationId!),
        },
      });
    }
  }

  if (locationId) {
    const alreadyAssociated = existing.useContext?.some(
      (uc) => uc.code?.code === 'venue' && uc.valueReference?.reference === `Location/${locationId}`
    );
    if (!alreadyAssociated) {
      newContextEntries.push({
        code: {
          system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
          code: 'venue',
          display: 'Clinical Venue',
        },
        valueReference: {
          reference: `Location/${locationId}`,
        },
      });
    }
  }

  if (newContextEntries.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify(existing),
    };
  }

  const updated = await oystehr.fhir.update<ChargeItemDefinition>(
    {
      ...existing,
      useContext: [...(existing.useContext || []), ...newContextEntries],
    },
    { optimisticLockingVersionId: existing.meta?.versionId }
  );

  return {
    statusCode: 200,
    body: JSON.stringify(updated),
  };
});
