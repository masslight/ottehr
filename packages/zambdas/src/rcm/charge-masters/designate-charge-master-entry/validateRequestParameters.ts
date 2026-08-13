import { ChargeMasterDesignation } from 'utils/lib/fhir/constants';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface DesignateChargeMasterEntryParams {
  chargeMasterId: string;
  designation: ChargeMasterDesignation;
  secrets: ZambdaInput['secrets'];
}

const DesignateChargeMasterEntryBodySchema = z.object({
  chargeMasterId: z.string().uuid(),
  designation: z.enum(['default-insurance', 'self-pay']),
});

export function validateRequestParameters(input: ZambdaInput): DesignateChargeMasterEntryParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { chargeMasterId, designation } = safeValidate(DesignateChargeMasterEntryBodySchema, safeJsonParse(input.body));

  return {
    chargeMasterId,
    designation,
    secrets: input.secrets,
  };
}
