import { APIGatewayProxyResult } from 'aws-lambda';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { MakeProgressNotePdfZambdaOutput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { buildProgressNoteBytes } from '../../../shared/pdf/build-progress-note';
import { uploadPdfToStorage } from '../../../shared/pdf/pdf-common';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'make-progress-note-pdf';

/**
 * Renders the visit's progress note for printing and returns a presigned URL to it.
 *
 * Callable before the visit is signed, which is the point: staff print the note at discharge, and
 * signing happens afterwards. The bytes are produced by the same assembly the visit-note
 * subscription uses, so what is printed now matches what is persisted at signing — and nothing is
 * filed here, so this can never be mistaken for the canonical signed note.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentId, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
  }

  const { patient } = visitResources;
  if (!patient?.id) {
    throw new Error(`No patient has been found for appointment ${appointmentId}`);
  }

  const bytes = await buildProgressNoteBytes({
    oystehr,
    token: m2mToken,
    secrets,
    visitResources,
    // Always the unsigned rendering, which prints "Pending provider signature" rather than a
    // signature block. This endpoint exists for printing at discharge, before the note is signed;
    // once it is signed the canonical document is filed on the chart and should be printed from
    // there. Passing true here would stamp a signature line onto a note nobody has signed.
    signed: false,
  });

  const pdfInfo = await uploadPdfToStorage(
    bytes,
    { patientId: patient.id, fileName: 'ProgressNote.pdf', bucketName: BUCKET_NAMES.VISIT_NOTES },
    secrets,
    m2mToken
  );

  const response: MakeProgressNotePdfZambdaOutput = {
    presignedURL: await getPresignedURL(pdfInfo.uploadURL, m2mToken),
    title: pdfInfo.title,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
