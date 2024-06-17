import { ZambdaInput } from 'ottehr-utils';
import { GetLocationInput } from '.';

export function validateRequestParameters(input: ZambdaInput): GetLocationInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { slug } = JSON.parse(input.body);
  if (!slug) {
    throw new Error('slug is not found and is reqired');
  }

  return {
    slug,
    secrets: input.secrets,
  };
}
