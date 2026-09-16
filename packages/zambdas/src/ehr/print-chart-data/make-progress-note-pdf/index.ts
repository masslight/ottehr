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
 * Renders the visit's progress note for printing and returns a presigned URL to it.
 *
 * Callable before the visit is signed, which is the point: staff print the note at discharge, and
 * signing happens afterwards. The bytes are produced by the same assembly the visit-note
 * subscription uses, so what is printed now matches what is persisted at signing — and nothing is
 * filed here, so this can never be mistaken for the canonical signed note.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { appointmentId, secrets } = validateRequestParameters(input);

  // This renders PHI for whatever appointment id it is handed, and every role in the project —
  // patients included — may invoke zambdas, so the caller has to be clinical staff.
  if (!(await callerHasRole(input.headers?.Authorization, secrets, CHART_DOCUMENT_ROLES))) {
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
  const noteIsSigned = filedNote.length > 0;

  const bytes = await buildProgressNoteBytes({
    oystehr,
    token: m2mToken,
    secrets,
    visitResources,
    // Derived rather than hardcoded false: `composeSignature` treats `signed === false` as an
    // override that prints "Pending provider signature", so a signed visit printed through this
    // endpoint would understate its own status. The filed `75498-6` DocumentReference is the same
    // signal the fax collector uses — it is created when the visit is signed.
    signed: noteIsSigned,
  });

  const pdfInfo = await uploadPdfToStorage(
    bytes,
    {
      patientId: patient.id,
      // Keyed by appointment, not just patient: a timestamped key would strand an unreachable PDF on
      // every print (nothing references these), but a patient-wide key would let one visit's note
      // overwrite another's and serve the wrong visit to a presigned URL already handed out. One
      // slot per visit, overwritten by the next print of that same visit.
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
