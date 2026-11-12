import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import { Secrets } from 'utils/lib/secrets';
import { CreateImmunizationRecordResponse } from 'utils/lib/types/data/immunization/types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import {
  createImmunizationRecordPdf,
  makeImmunizationRecordDocumentReference,
} from '../../shared/pdf/immunization-record-pdf';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { assessmentDate, loadPatientForecast } from '../immunization/forecast';
import { assertImmunizationStaff } from '../immunization/records';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

/**
 * The patient's full immunization record as a PDF, printed from the Discharge dialog (decision #10b). Filed like
 * the discharge summary: same bucket, its own DocumentReference type, shown in the portal with the visit.
 */
export const index = wrapHandler(
  'create-immunization-record',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { appointmentId, secrets } = validateRequestParameters(input);
    await assertImmunizationStaff(input, 'print immunization records');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const response = await performEffect(oystehr, appointmentId, secrets);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  appointmentId: string,
  secrets: Secrets | null
): Promise<CreateImmunizationRecordResponse> => {
  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
  }
  const { encounter, patient, listResources, timezone } = visitResources;
  if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);

  const asOf = assessmentDate(encounter, DateTime.now().setZone(timezone), timezone);
  const { records, forecast } = await loadPatientForecast(oystehr, patient.id, asOf, timezone);

  const { pdfInfo } = await createImmunizationRecordPdf(
    { appointmentPackage: visitResources, records, forecast },
    secrets,
    m2mToken
  );

  console.log('Creating immunization record pdf Document Reference');
  const documentReference = await makeImmunizationRecordDocumentReference(
    oystehr,
    pdfInfo,
    patient.id,
    appointmentId,
    encounter.id!,
    listResources
  );

  return {
    message: 'Immunization record created.',
    documentId: documentReference.id ?? '',
  };
};
