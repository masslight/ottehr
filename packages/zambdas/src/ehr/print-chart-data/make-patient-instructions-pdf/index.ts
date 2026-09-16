import { APIGatewayProxyResult } from 'aws-lambda';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { MakePatientInstructionsPdfZambdaOutput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { createPatientInstructionsPdf } from '../../../shared/pdf/patient-instructions-pdf';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getChartData } from '../../get-chart-data';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'make-patient-instructions-pdf';

/**
 * Renders the visit's patient instructions as a standalone sheet and returns a presigned URL to it.
 *
 * Deliberately does not file a DocumentReference: the instructions already live on the chart, and
 * the discharge summary carries them too, so filing one per print would just accumulate duplicates.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
  }

  const { encounter } = visitResources;
  const chartData = (await getChartData(oystehr, m2mToken, encounter.id!)).response;

  const { pdfInfo } = await createPatientInstructionsPdf(
    { allChartData: { chartData }, appointmentPackage: visitResources },
    secrets,
    m2mToken
  );

  const response: MakePatientInstructionsPdfZambdaOutput = {
    presignedURL: await getPresignedURL(pdfInfo.uploadURL, m2mToken),
    title: pdfInfo.title,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
