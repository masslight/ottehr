import { BillingSuggestionInput } from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): BillingSuggestionInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    patientId,
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
    prescribedMedications,
  } = JSON.parse(input.body);

  return {
    patientId,
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
    prescribedMedications,
    secrets: input.secrets,
  };
}
