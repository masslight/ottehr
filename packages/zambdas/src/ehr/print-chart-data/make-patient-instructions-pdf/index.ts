import { APIGatewayProxyResult } from 'aws-lambda';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { PrintablePdfZambdaOutput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { CHART_DOCUMENT_ROLES } from 'utils/lib/types/api/user.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { callerHasRole, checkOrCreateM2MClientToken } from '../../../shared/auth';
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

  // Renders PHI for whatever appointment id it is handed, and patients hold project tokens too.
  if (!(await callerHasRole(input.headers?.Authorization, secrets, CHART_DOCUMENT_ROLES))) {
    throw NOT_AUTHORIZED;
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
  }

  // Guarded here rather than left to the non-null assertions in the PDF layer, which would surface
  // an opaque TypeError instead of saying which visit is unusable.
  const { encounter, patient } = visitResources;
  if (!patient?.id) {
    throw new Error(`No patient has been found for appointment ${appointmentId}`);
  }
  if (!encounter?.id) {
    throw new Error(`No encounter has been found for appointment ${appointmentId}`);
  }

  const chartData = (await getChartData(oystehr, m2mToken, encounter.id)).response;

  const { pdfInfo } = await createPatientInstructionsPdf(
    { allChartData: { chartData }, appointmentPackage: visitResources },
    secrets,
    m2mToken
  );

  const response: PrintablePdfZambdaOutput = {
    presignedURL: await getPresignedURL(pdfInfo.uploadURL, m2mToken),
    title: pdfInfo.title,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
