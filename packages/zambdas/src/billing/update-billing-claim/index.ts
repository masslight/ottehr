import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient } from '../shared';
import { UpdateBillingClaimParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'update-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: UpdateBillingClaimParams): Promise<{ id: string | undefined }> {
  const operations = buildPatchOps(params);
  const result = await oystehr.fhir.patch({
    resourceType: params.resourceType,
    id: params.resourceId,
    operations,
  });
  return { id: result.id };
}

function buildPatchOps(params: UpdateBillingClaimParams): Operation[] {
  const ops: Operation[] = [];

  switch (params.resourceType) {
    case 'Patient': {
      const { fields } = params;
      const name: { use: string; given?: string[]; family?: string } = { use: 'official' };
      if (fields.firstName !== undefined) name.given = [fields.firstName];
      if (fields.lastName !== undefined) name.family = fields.lastName;
      if (name.given || name.family) ops.push({ op: 'add', path: '/name', value: [name] });
      if (fields.dob !== undefined) ops.push({ op: 'add', path: '/birthDate', value: fields.dob });
      if (fields.gender !== undefined) ops.push({ op: 'add', path: '/gender', value: fields.gender });
      break;
    }
    case 'Practitioner': {
      const { fields } = params;
      const name: { use: string; given?: string[]; family?: string } = { use: 'official' };
      if (fields.firstName !== undefined) name.given = [fields.firstName];
      if (fields.lastName !== undefined) name.family = fields.lastName;
      if (name.given || name.family) ops.push({ op: 'add', path: '/name', value: [name] });
      break;
    }
    case 'Coverage': {
      const { fields } = params;
      if (fields.subscriberId !== undefined) ops.push({ op: 'add', path: '/subscriberId', value: fields.subscriberId });
      break;
    }
    case 'Location': {
      const { fields } = params;
      if (fields.name !== undefined) ops.push({ op: 'add', path: '/name', value: fields.name });
      break;
    }
    case 'Organization': {
      const { fields } = params;
      if (fields.name !== undefined) ops.push({ op: 'add', path: '/name', value: fields.name });
      break;
    }
  }

  return ops;
}
