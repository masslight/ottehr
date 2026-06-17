import { BillingSuggestionInput } from 'utils';
import { safeJsonParse, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): BillingSuggestionInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    newPatient,
    patientAge,
    patientSex,
    hpi,
    mdm,
    externalLabOrders,
    internalLabOrders,
    radiologyOrders,
    radiologyReports,
    procedures,
    rosFindings,
    diagnoses,
    billing,
  } = safeJsonParse(input.body);

  return {
    newPatient,
    patientAge: patientAge || '',
    patientSex: patientSex || '',
    hpi,
    mdm,
    externalLabOrders,
    internalLabOrders,
    radiologyOrders,
    radiologyReports: radiologyReports || '',
    procedures,
    rosFindings: rosFindings || '',
    diagnoses,
    billing,
    secrets: input.secrets,
  };
}
