import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  FORM_INSTANCE_CATEGORY_CODING,
  FORM_INSTANCE_CATEGORY_SEARCH_PARAM,
  FORM_TEMPLATE_MAPPING_EXTENSION_URL,
  HIDE_WHILE_PRELIMINARY_TAG,
} from 'utils/lib/fhir/constants';
import { EMPTY_MAPPING, FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { FillFormTemplateInput, FillFormTemplateOutput } from 'utils/lib/types/api/form-template.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { assembleProgressNoteInput } from '../../shared/pdf/assemble-progress-note-input';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeZ3ObjectUrl, z3ObjectNameDatePrefix } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import {
  loadFormFillAccounts,
  loadFormFillInsurance,
  loadFormFillWorkersComp,
  LOG_TAG,
} from '../shared/form-fill-context';
import { fillFormTemplatePdf } from '../shared/form-template-fill';
import { getFormTemplateOrThrow, isPublished, readExtensionJson } from '../shared/form-template-helpers';
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

  // `getFormTemplateOrThrow` only proves the record is a form template, not that it is one anybody should
  // be filling. Prefilling is chart-facing and reachable by every clinical role, so an id is enough to
  // reach it — and a draft is a template whose PDF nobody has approved, while a `superseded` one has been
  // deleted. Neither should be producing documents on a patient's chart.
  if (template.status !== 'current') {
    throw new Error(`Form template DocumentReference/${documentReferenceId} has been deleted`);
  }
  if (!isPublished(template)) {
    throw new Error(`Form template DocumentReference/${documentReferenceId} is a draft and cannot be filled`);
  }

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
  // ask for primary and secondary in their own boxes.
  //
  // The accounts are searched rather than taken from the appointment bundle, which keeps whichever one
  // came back first — an arbitrary choice for any patient holding both a billing account and a workers'
  // compensation one, which is exactly the patient these forms are for.
  const accounts = await loadFormFillAccounts(oystehr, visitResources.patient.id);
  const [insurance, workersComp] = await Promise.all([
    loadFormFillInsurance(oystehr, visitResources.appointment, {
      account: accounts.billing,
      packageCoverage: visitResources.coverage,
    }),
    loadFormFillWorkersComp(oystehr, accounts.workersComp),
  ]);
  const fillContext = { ...context, insurance, workersComp };

  const mapping =
    readExtensionJson<FormTemplateMapping>(template, FORM_TEMPLATE_MAPPING_EXTENSION_URL) ?? EMPTY_MAPPING;

  const { pdfBytes, filled, skipped } = await fillFormTemplatePdf({
    pdfBytes: templateBytes,
    bindings: mapping.bindings,
    resolve: (tokenKey) => resolveToken(tokenKey, fillContext),
    // Stamped even when nothing was filled: an unmapped form still leaves here carrying a patient's name
    // in its filename and still has to be identifiable when it comes back.
    provenance: {
      v: 1,
      patientId: visitResources.patient.id,
      encounterId: visitResources.encounter?.id,
      sourceId: documentReferenceId,
      sourceVersion: template.meta?.versionId,
      at: DateTime.now().toUTC().toISO() ?? '',
    },
  });

  // Field names, token keys and reasons only — never the resolved values, which are PHI.
  console.log(
    `${LOG_TAG} Prefilled ${filled.length}/${mapping.bindings.length} fields for ` +
      `DocumentReference/${documentReferenceId}, Patient/${visitResources.patient.id}.` +
      (skipped.length > 0
        ? ` Skipped: ${skipped.map((s) => `${s.tokenKey}->${s.fieldName} (${s.reason})`).join(', ')}`
        : '')
  );

  const patientId = visitResources.patient.id;
  // Title first, the same order `buildDisplayName` uses when naming a returned form. Description is
  // optional, so leading with it made every template that lacks one download as `form_<patient>_…pdf`.
  const fileName = buildFileName(
    template.content?.[0]?.attachment?.title ?? template.description ?? 'form',
    visitResources,
    appointmentId
  );

  // Stored under a unique name, displayed under the readable one. `fileName` is deterministic for a
  // template, patient and day, so reusing it as the object name meant every regenerate overwrote the
  // previous fill's bytes *before* its replacement record existed — and two concurrent fills would leave
  // both records pointing at whichever upload finished last.
  const z3Url = makeZ3ObjectUrl({
    secrets,
    bucketName: BUCKET_NAMES.FORM_INSTANCES,
    patientID: patientId,
    objectName: `${z3ObjectNameDatePrefix()}-${randomUUID()}-${sanitizeFileNameForZ3(fileName)}`,
  });
  const uploadUrl = await createPresignedUrl(token, z3Url, 'upload');
  await uploadObjectToZ3(pdfBytes, uploadUrl);

  const instance = await oystehr.fhir.create<DocumentReference>({
    resourceType: 'DocumentReference',
    status: 'current',
    // Incomplete until the provider finishes and returns it, and not worth reading until then — the tag
    // is what keeps it out of the patient's document list without that list knowing what a form is.
    docStatus: 'preliminary',
    meta: { tag: [HIDE_WHILE_PRELIMINARY_TAG] },
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
  await supersedePreviousInstances(oystehr, {
    patientId,
    encounterId: visitResources.encounter?.id,
    templateId: documentReferenceId,
    keepId: instance.id!,
  });

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
 * Only drafts, and only this visit's. A completed form filed by `save-completed-form` is a form instance
 * against the same template on the same patient, so a search by those alone also matches forms the provider
 * signed and returned — superseding one hides it from the documents list, which filters superseded out. The
 * `docStatus` filter is what prevents that; the encounter narrows it further, to the visit being worked on.
 *
 * Best-effort by design. Tidying the previous draft must not cost the provider the form they just asked for.
 */
const supersedePreviousInstances = async (
  oystehr: Oystehr,
  args: { patientId: string; encounterId?: string; templateId: string; keepId: string }
): Promise<void> => {
  const { patientId, encounterId, templateId, keepId } = args;

  try {
    const previous = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'category', value: FORM_INSTANCE_CATEGORY_SEARCH_PARAM },
          { name: 'status', value: 'current' },
          { name: 'relatesto', value: `DocumentReference/${templateId}` },
          ...(encounterId ? [{ name: 'encounter', value: `Encounter/${encounterId}` }] : []),
        ],
      })
    )
      .unbundle()
      // `docStatus` has no search parameter, so the draft/returned distinction is drawn here. Without it
      // a returned form would be superseded and disappear from the chart.
      .filter((docRef) => docRef.id && docRef.id !== keepId && docRef.docStatus === 'preliminary');

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
