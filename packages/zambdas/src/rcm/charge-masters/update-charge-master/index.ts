import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('update-charge-master', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { id, name, effectiveDate, description, status, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const existing = await oystehr.fhir.get<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    id,
  });

  const updated = await oystehr.fhir.update<ChargeItemDefinition>(
    {
      ...existing,
      title: name,
      date: effectiveDate,
      status: status ?? existing.status,
    },
    { optimisticLockingVersionId: existing.meta?.versionId }
  );

  // Handle description separately via PATCH to avoid FHIR empty-string rejection
  if (description) {
    const op = existing.description ? 'replace' : 'add';
    await oystehr.fhir.patch<ChargeItemDefinition>(
      {
        resourceType: 'ChargeItemDefinition',
        id,
        operations: [{ op, path: '/description', value: description }],
      },
      { optimisticLockingVersionId: updated.meta?.versionId }
    );
  } else if (existing.description) {
    await oystehr.fhir.patch<ChargeItemDefinition>(
      {
        resourceType: 'ChargeItemDefinition',
        id,
        operations: [{ op: 'remove', path: '/description' }],
      },
      { optimisticLockingVersionId: updated.meta?.versionId }
    );
  }

  // Re-fetch to return the final state
  const final = await oystehr.fhir.get<ChargeItemDefinition>({
    resourceType: 'ChargeItemDefinition',
    id,
  });

  return {
    statusCode: 200,
    body: JSON.stringify(final),
  };
});
