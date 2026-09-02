import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PDFDocument } from 'pdf-lib';
import { FORM_INSTANCE_CATEGORY_CODING } from 'utils/lib/fhir/constants';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { DocumentVerificationStatus } from 'utils/lib/types/api/document-provenance.types';
import { SaveCompletedFormInput, SaveCompletedFormOutput } from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { readDocumentProvenance } from '../../shared/document-provenance';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { resolveCallerPractitionerRef } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { deleteZ3Object } from '../../shared/z3Utils';
import { getFormTemplateOrThrow } from '../shared/form-template-helpers';

const ZAMBDA_NAME = 'save-completed-form';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

    const result = await performEffect(validatedInput, oystehr, m2mToken);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const inputSchema: z.ZodType<SaveCompletedFormInput> = z.object({
  appointmentId: z.string().min(1, 'appointmentId is required'),
  z3Url: z.string().min(1, 'z3Url is required'),
  templateId: z.string().min(1, 'templateId is required'),
});

export function validateRequestParameters(
  input: ZambdaInput
): SaveCompletedFormInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string } {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
    // Who is filing this, as opposed to the machine identity doing the writing.
    userToken: input.headers?.Authorization?.replace('Bearer ', ''),
  };
}

/**
 * Files a completed form onto the chart, once the uploaded bytes have been checked against it.
 *
 * The DocumentReference is created here rather than alongside the presigned URL, so that verification is a
 * precondition of the document existing at all rather than something undone afterwards. An upload that is
 * abandoned, that fails, or that turns out to describe another patient leaves no record behind — there is
 * nothing to clean up because nothing was written.
 *
 * The comparison is between two things the caller does not control: the patient resolved from the named
 * appointment, and the stamp read out of the file.
 *
 * An unstamped document is accepted. Most documents that legitimately reach a chart were never produced by
 * this system — a scan, a fax, a photograph of a signed page — and refusing them would make the guard a
 * blanket restriction on uploading rather than a check on documents that claim an origin.
 */
const performEffect = async (
  validatedInput: SaveCompletedFormInput & Pick<ZambdaInput, 'secrets'> & { userToken?: string },
  oystehr: Oystehr,
  token: string
): Promise<SaveCompletedFormOutput> => {
  const { appointmentId, z3Url, templateId, userToken, secrets } = validatedInput;

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  const patientId = visitResources?.patient?.id;
  if (!patientId) {
    throw new Error(`No patient found for appointment ${appointmentId}`);
  }

  const status = await verifyAgainstChart(z3Url, patientId, token);

  if (status.status === 'patientMismatch') {
    console.error(
      `${ZAMBDA_NAME}: refused. Upload is stamped for Patient/${status.stampedPatientId} but was filed ` +
        `onto Patient/${patientId}. No document reference created.`
    );
    // The bytes are the only thing that was written, and they describe someone else.
    try {
      await deleteZ3Object(z3Url, token);
    } catch (error) {
      console.warn(`${ZAMBDA_NAME}: could not discard the refused upload at ${z3Url}: ${error}`);
    }
    return status;
  }

  const template = await getFormTemplateOrThrow(oystehr, templateId);
  const author = await resolveAuthor(userToken, secrets, oystehr);

  // The attachment title is what the documents list shows, and what renaming a document edits. Storing the
  // object's own name there surfaces the storage key — a timestamp and a hash — so a readable label is
  // built instead. The stored object keeps its unique name; only the label differs.
  const displayName = buildDisplayName(template, visitResources?.appointment?.start, visitResources?.timezone);

  const created = await oystehr.fhir.create<DocumentReference>({
    resourceType: 'DocumentReference',
    status: 'current',
    // The provider has finished with it, unlike the prefilled draft this came from.
    docStatus: 'final',
    category: [{ coding: [FORM_INSTANCE_CATEGORY_CODING] }],
    type: template.type,
    description: template.description,
    subject: { reference: `Patient/${patientId}` },
    context: visitResources?.encounter?.id
      ? { encounter: [{ reference: `Encounter/${visitResources.encounter.id}` }] }
      : undefined,
    date: DateTime.now().toUTC().toISO() ?? undefined,
    author,
    relatesTo: [{ code: 'transforms', target: { reference: `DocumentReference/${templateId}` } }],
    content: [{ attachment: { url: z3Url, contentType: 'application/pdf', title: displayName } }],
  });

  console.log(`${ZAMBDA_NAME}: filed DocumentReference/${created.id} for Patient/${patientId} (${status.status}).`);

  return { status: status.status, documentReferenceId: created.id };
};

/**
 * Compares the stamp inside the uploaded file with the chart it is being filed onto.
 *
 * Anything that is not a readable PDF counts as unstamped: the stamp only lives in PDFs, so failing to
 * parse an image is the expected outcome rather than something to report.
 */
const verifyAgainstChart = async (
  z3Url: string,
  chartPatientId: string,
  token: string
): Promise<{ status: DocumentVerificationStatus; stampedPatientId?: string }> => {
  let provenance;
  try {
    const response = await fetch(await getPresignedURL(z3Url, token));
    if (!response.ok) {
      throw new Error(`Could not read the upload (${response.status} ${response.statusText})`);
    }
    const doc = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()), { ignoreEncryption: true });
    provenance = readDocumentProvenance(doc);
  } catch (error) {
    console.warn(`${ZAMBDA_NAME}: could not read a stamp from ${z3Url}, treating as unstamped: ${error}`);
    return { status: 'unstamped' };
  }

  if (!provenance) return { status: 'unstamped' };
  if (provenance.patientId === chartPatientId) return { status: 'verified' };

  return { status: 'patientMismatch', stampedPatientId: provenance.patientId };
};

/**
 * The person filing the document, as opposed to the machine identity writing it.
 *
 * Every zambda writes through an M2M client, so without this the chart records only that *something*
 * added a document. Resolved from the caller's own token, and best-effort: a document that reaches the
 * chart unattributed is worse than one that does not reach it at all.
 */
const resolveAuthor = async (
  userToken: string | undefined,
  secrets: Secrets | null,
  oystehr: Oystehr
): Promise<Reference[] | undefined> => {
  if (!userToken) return undefined;
  try {
    return [await resolveCallerPractitionerRef(userToken, secrets, oystehr)];
  } catch (error) {
    console.warn(`${ZAMBDA_NAME}: could not resolve the uploading practitioner: ${error}`);
    return undefined;
  }
};

/**
 * What the documents list calls a returned form.
 *
 * The template's name plus the date of the visit it belongs to, because the same form is returned for the
 * same patient across visits and the name is the first thing anyone reads.
 *
 * Rendered in the visit's own timezone rather than the server's. An evening appointment formatted in UTC
 * lands on the following day, which is the kind of error nobody checks because the label looks fine.
 */
const buildDisplayName = (template: DocumentReference, visitStart?: string, timezone?: string): string => {
  const name = template.content?.[0]?.attachment?.title ?? template.description ?? 'Completed form';
  if (!visitStart) return name;

  const visitDate = DateTime.fromISO(visitStart, { zone: timezone || 'utc' });
  return visitDate.isValid ? `${name} (${visitDate.toFormat('MM/dd/yyyy')})` : name;
};
