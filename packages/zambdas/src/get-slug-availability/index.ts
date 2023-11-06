import { APIGatewayProxyResult } from 'aws-lambda';
import { DefaultErrorMessages, ZambdaFunctionInput, ZambdaFunctionResponse, ZambdaInput } from '../types';
import { createZambdaFromSkeleton } from '../shared/zambdaSkeleton';
import { regex } from '../shared';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  return createZambdaFromSkeleton(input, getSlugAvailability);
};

interface getSlugAvailabilityInput {
  oldSlug?: string;
  slug: string;
}

const getSlugAvailability = (input: ZambdaFunctionInput): ZambdaFunctionResponse => {
  const { oldSlug, slug } = input.body as getSlugAvailabilityInput;
  if (slug == null || typeof slug !== 'string') {
    return {
      error: `${DefaultErrorMessages.validation}: "slug" must be provided and be a string.`,
    };
  }
  if (regex.alphanumeric.test(slug)) {
    return {
      error: `${DefaultErrorMessages.validation}: "slug" must only contain alphanumeric characters.`,
    };
  }
  const potentialSlug = slug.toLowerCase();

  if (oldSlug != null) {
    if (typeof oldSlug !== 'string') {
      return {
        error: `${DefaultErrorMessages.validation}: "oldSlug" must be a string.`,
      };
    }
  }

  // Hard-coded for now. I don't know where we're going to store things.
  let slugs = ['aykhanahmadli', 'nathanrobinson', 'omarzubaidi', 'samiromarov'];
  if (oldSlug != null) {
    // This could happen if a provider opens the update profile page in multiple tabs and tries to update the slug twice
    if (!slugs.includes(oldSlug)) {
      console.error('"oldSlug" could not be found in the current list of slugs.');
      return {
        error: `${DefaultErrorMessages.unexpected}: please reload the page and try again.`,
      };
    }
    // If they're updating their slug, then the old one will be removed eventually
    slugs = slugs.filter((usedSlug) => usedSlug !== oldSlug);
  }

  const available = !slugs.includes(potentialSlug);
  return {
    response: {
      available,
    },
  };
};
