import { BillingSuggestionInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): BillingSuggestionInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    newPatient,
    hpi,
    mdm,
    externalLabOrders,
    internalLabOrders,
    radiologyOrders,
    procedures,
    diagnoses,
    billing,
  } = JSON.parse(input.body);

  return {
    newPatient,
    hpi,
    mdm,
    externalLabOrders,
    internalLabOrders,
    radiologyOrders,
    procedures,
    diagnoses,
    billing,
    secrets: input.secrets,
  };
}
