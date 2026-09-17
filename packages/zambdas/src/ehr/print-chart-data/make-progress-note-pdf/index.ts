import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { PrintablePdfZambdaOutput } from 'utils/lib/types/api/print-chart-data/print-chart-data.types';
import { CHART_DOCUMENT_ROLES } from 'utils/lib/types/api/user.types';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { callerHasRole, checkOrCreateM2MClientToken } from '../../../shared/auth';
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
 * Renders the visit's progress note for printing, callable before the visit is signed. Files no
 * DocumentReference, so it cannot be mistaken for the canonical signed note.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentId, authorization, secrets } = validateRequestParameters(input);

  if (!(await callerHasRole(authorization, secrets, CHART_DOCUMENT_ROLES))) {
    throw NOT_AUTHORIZED;
  }

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

  // Once the visit is signed the filed note is the record; regenerating it would restate the
  // current chart under the original signature.
  const filedNote = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'encounter', value: `Encounter/${visitResources.encounter.id}` },
        { name: 'type', value: VISIT_NOTE_SUMMARY_CODE },
        { name: 'status', value: 'current' },
      ],
    })
  ).unbundle();
  const filedNoteAttachment = filedNote[0]?.content?.[0]?.attachment;

  if (filedNoteAttachment?.url) {
    const filedResponse: PrintablePdfZambdaOutput = {
      presignedURL: await getPresignedURL(filedNoteAttachment.url, m2mToken),
      title: filedNoteAttachment.title ?? 'ProgressNote.pdf',
    };

    return {
      statusCode: 200,
      body: JSON.stringify(filedResponse),
    };
  }

  const bytes = await buildProgressNoteBytes({
    oystehr,
    token: m2mToken,
    secrets,
    visitResources,
    signed: false,
  });

  const pdfInfo = await uploadPdfToStorage(
    bytes,
    {
      patientId: patient.id,
      // One slot per visit: nothing references these, so a unique key per print would leak storage.
      fileName: `ProgressNote-${appointmentId}.pdf`,
      bucketName: BUCKET_NAMES.VISIT_NOTES,
      stableKey: true,
    },
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
