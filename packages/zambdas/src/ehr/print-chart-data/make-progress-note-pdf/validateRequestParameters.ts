import { MakeProgressNotePdfInputSchema } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { MISSING_REQUEST_BODY, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { MakeProgressNotePdfInputValidated } from './types';

export function validateRequestParameters(input: ZambdaInput): MakeProgressNotePdfInputValidated {
  if (!input.headers?.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const validatedParams = safeValidate(MakeProgressNotePdfInputSchema, safeJsonParse(input.body) as unknown);

  return {
    ...validatedParams,
    secrets: input.secrets,
    userToken: input.headers.Authorization.replace('Bearer ', ''),
  };
}
