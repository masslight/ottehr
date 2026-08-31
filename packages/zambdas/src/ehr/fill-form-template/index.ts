import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  FORM_INSTANCE_CATEGORY_CODING,
  FORM_INSTANCE_CATEGORY_SEARCH_PARAM,
  FORM_TEMPLATE_MAPPING_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { EMPTY_MAPPING, FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { FillFormTemplateInput, FillFormTemplateOutput } from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { assembleProgressNoteInput } from '../../shared/pdf/assemble-progress-note-input';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeZ3Url } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { loadFormFillInsurance, LOG_TAG } from '../shared/form-fill-context';
import { fillFormTemplatePdf } from '../shared/form-template-fill';
import { getFormTemplateOrThrow, readExtensionJson } from '../shared/form-template-helpers';
import { resolveToken } from '../shared/form-token-resolvers';

const ZAMBDA_NAME = 'fill-form-template';

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

const inputSchema: z.ZodType<FillFormTemplateInput> = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required'),
  appointmentId: z.string().min(1, 'appointmentId is required'),
});

export function validateRequestParameters(input: ZambdaInput): FillFormTemplateInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  return {
    ...safeValidate(inputSchema, safeJsonParse(input.body)),
    secrets: input.secrets,
  };
}

/**
 * Produces a prefilled copy of a template for one visit, stores it, and hands back a URL to open.
 *
 * Filling happens server-side because that is where the chart assembly already lives, and it keeps PHI out
 * of the browser: the template is fetched, populated, and re-stored without any of the encounter's data
 * passing through the client.
 *
 * The stored copy is by construction incomplete — roughly half of a typical form is content no token can
 * supply — so it is written as a `preliminary` document. It exists partly to be opened and partly so a
 * later phase can tell that an instance was generated and never returned.
 */
const performEffect = async (
  validatedInput: FillFormTemplateInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  token: string
): Promise<FillFormTemplateOutput> => {
  const { documentReferenceId, appointmentId, secrets } = validatedInput;

  const template = await getFormTemplateOrThrow(oystehr, documentReferenceId);
  const templateUrl = template.content?.[0]?.attachment?.url;
  if (!templateUrl) {
    throw new Error(`Form template DocumentReference/${documentReferenceId} has no attachment URL`);
  }

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources?.patient?.id) {
    throw new Error(`No patient found for appointment ${appointmentId}`);
  }

  // The template bytes and the encounter context are independent, and both are slow.
  const [templateBytes, context] = await Promise.all([
    downloadTemplate(templateUrl, token),
    assembleProgressNoteInput(oystehr, token, visitResources),
  ]);

  // Coverage is resolved separately from the note input, which carries only one, because forms routinely
  // ask for primary and secondary in their own boxes. The package's own coverage is handed along as the
  // fallback for visits whose appointment extension names no coverage references.
  const insurance = await loadFormFillInsurance(oystehr, visitResources.appointment, {
    account: visitResources.account,
    packageCoverage: visitResources.coverage,
  });
  const fillContext = { ...context, insurance };

  const mapping =
    readExtensionJson<FormTemplateMapping>(template, FORM_TEMPLATE_MAPPING_EXTENSION_URL) ?? EMPTY_MAPPING;

  // An unmapped template is stored exactly as uploaded. Running it through the filler would write nothing
  // but still rewrite the file, and on a printable form — a third of the ones we have seen have no AcroForm
  // at all — pdf-lib would create an empty one on the way past, changing a document for no reason.
  const { pdfBytes, filled, skipped } =
    mapping.bindings.length > 0
      ? await fillFormTemplatePdf({
          pdfBytes: templateBytes,
          bindings: mapping.bindings,
          resolve: (tokenKey) => resolveToken(tokenKey, fillContext),
        })
      : { pdfBytes: templateBytes, filled: [], skipped: [] };

  // Field names, token keys and reasons only — never the resolved values, which are PHI.
  console.log(
    `${LOG_TAG} Prefilled ${filled.length}/${mapping.bindings.length} fields for ` +
      `DocumentReference/${documentReferenceId}, Patient/${visitResources.patient.id}.` +
      (skipped.length > 0
        ? ` Skipped: ${skipped.map((s) => `${s.tokenKey}->${s.fieldName} (${s.reason})`).join(', ')}`
        : '')
  );

  const patientId = visitResources.patient.id;
  const fileName = buildFileName(template.description ?? 'form', visitResources, appointmentId);

  const z3Url = makeZ3Url({ secrets, bucketName: BUCKET_NAMES.FORM_INSTANCES, patientID: patientId, fileName });
  const uploadUrl = await createPresignedUrl(token, z3Url, 'upload');
  await uploadObjectToZ3(pdfBytes, uploadUrl);

  const instance = await oystehr.fhir.create<DocumentReference>({
    resourceType: 'DocumentReference',
    status: 'current',
    // Incomplete until the provider finishes and returns it.
    docStatus: 'preliminary',
    // Sorting rides on `category`; `type` carries the clinical meaning and is inherited rather than fixed,
    // because these documents genuinely differ — a workers-comp form, a prior authorisation and a DOT
    // examination are not one type, and the template is where that is declared.
    //
    // Consequently these are filed into no `List` and appear in the unfiltered documents view rather than
    // in a folder of their own. That is deliberate: a folder would need a stable type code, which would
    // mean flattening exactly the distinction above.
    category: [{ coding: [FORM_INSTANCE_CATEGORY_CODING] }],
    type: template.type,
    description: template.description,
    subject: { reference: `Patient/${patientId}` },
    context: visitResources.encounter?.id
      ? { encounter: [{ reference: `Encounter/${visitResources.encounter.id}` }] }
      : undefined,
    date: DateTime.now().toUTC().toISO() ?? undefined,
    // Ties the copy back to the template it came from, so the pair is traceable in both directions.
    relatesTo: [{ code: 'transforms', target: { reference: `DocumentReference/${documentReferenceId}` } }],
    content: [{ attachment: { url: z3Url, contentType: 'application/pdf', title: fileName } }],
  });

  // Superseded only once the replacement exists, so a failure here leaves the previous draft as the
  // current one rather than leaving the encounter with none.
  await supersedePreviousInstances(oystehr, { patientId, templateId: documentReferenceId, keepId: instance.id! });

  return {
    documentReferenceId: instance.id!,
    presignedUrl: await getPresignedURL(z3Url, token),
    fileName,
    report: {
      filledCount: filled.length,
      skipped: skipped.map(({ fieldName, tokenKey, reason }) => ({ fieldName, tokenKey, reason })),
    },
  };
};

/**
 * Marks earlier drafts of the same form for this patient as superseded.
 *
 * Prefill is cheap to repeat — a provider reopening a form generates another copy — and every instance is a
 * DocumentReference on the patient, which the documents explorer lists by subject alone. Without this, three
 * clicks leave three near-identical half-filled PDFs in the chart with nothing to say which is live.
 *
 * Superseding rather than deleting: the earlier draft may already have been opened, and knowing an instance
 * was generated is what later allows a never-returned form to be spotted.
 *
 * Best-effort by design. Tidying the previous draft must not cost the provider the form they just asked for.
 */
const supersedePreviousInstances = async (
  oystehr: Oystehr,
  args: { patientId: string; templateId: string; keepId: string }
): Promise<void> => {
  const { patientId, templateId, keepId } = args;

  try {
    const previous = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'category', value: FORM_INSTANCE_CATEGORY_SEARCH_PARAM },
          { name: 'status', value: 'current' },
          { name: 'relatesto', value: `DocumentReference/${templateId}` },
        ],
      })
    )
      .unbundle()
      .filter((docRef) => docRef.id && docRef.id !== keepId);

    await Promise.all(
      previous.map((docRef) =>
        oystehr.fhir.patch<DocumentReference>({
          resourceType: 'DocumentReference',
          id: docRef.id!,
          operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
        })
      )
    );
  } catch (error) {
    console.warn(`Could not supersede earlier drafts of DocumentReference/${templateId}: ${error}`);
  }
};

const downloadTemplate = async (z3Url: string, token: string): Promise<Uint8Array> => {
  const response = await fetch(await getPresignedURL(z3Url, token));
  if (!response.ok) {
    throw new Error(`Could not download the form template (${response.status} ${response.statusText})`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * Names the download per encounter rather than per template.
 *
 * Every patient receives the same template, so a template-named download leaves a provider picking the right
 * `dwc073 (3).pdf` out of a folder of identically-named files, each holding a different patient's data. The
 * patient and date in the name are the cheap half of closing that gap.
 */
const buildFileName = (
  description: string,
  visitResources: { patient?: { name?: { given?: string[]; family?: string }[] } },
  appointmentId: string
): string => {
  const name = visitResources.patient?.name?.[0];
  const person = [name?.family, name?.given?.[0]].filter(Boolean).join('-');
  const parts = [description, person, DateTime.now().toFormat('yyyy-MM-dd'), appointmentId.slice(0, 8)];

  return `${parts.filter(Boolean).map(slug).join('_')}.pdf`;
};

const slug = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
