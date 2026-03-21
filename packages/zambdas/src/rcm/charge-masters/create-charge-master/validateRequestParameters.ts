import { ZambdaInput } from '../../../shared';

export interface CreateChargeMasterParams {
  name: string;
  effectiveDate: string;
  description: string;
  secrets: ZambdaInput['secrets'];
}

export function validateRequestParameters(input: ZambdaInput): CreateChargeMasterParams {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { name, effectiveDate, description } = JSON.parse(input.body);

  if (!name || !effectiveDate) {
    throw new Error('These fields are required: "name", "effectiveDate"');
  }

  return {
    name,
    effectiveDate,
    description: description ?? '',
    secrets: input.secrets,
  };
}
