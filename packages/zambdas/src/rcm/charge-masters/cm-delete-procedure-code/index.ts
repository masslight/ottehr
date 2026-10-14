import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItemDefinition } from 'fhir/r4b';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';

export const CmDeleteProcedureCodeBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  index: z.number().int().min(0),
});

let m2mToken: string;
export const index = wrapHandler(
  'cm-delete-procedure-code',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { chargeMasterId, index, secrets } = validateWithSchema(CmDeleteProcedureCodeBodySchema, input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const existing = await oystehr.fhir.get<ChargeItemDefinition>({
      resourceType: 'ChargeItemDefinition',
      id: chargeMasterId,
    });

    const propertyGroups = [...(existing.propertyGroup || [])];
    if (index >= propertyGroups.length) {
      throw new Error(`Index ${index} is out of bounds (${propertyGroups.length} property groups)`);
    }

    propertyGroups.splice(index, 1);

    const updated = await oystehr.fhir.update<ChargeItemDefinition>(
      {
        ...existing,
        propertyGroup: propertyGroups.length > 0 ? propertyGroups : undefined,
      },
      { optimisticLockingVersionId: existing.meta?.versionId }
    );

    return {
      statusCode: 200,
      body: JSON.stringify(updated),
    };
  }
);
