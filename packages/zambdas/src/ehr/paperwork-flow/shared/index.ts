import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import {
  CanonicalUrl,
  CONSENT_FORMS_PAGE_LINK_ID,
  FlowForm,
  FlowService,
  getAllFhirSearchPages,
  getCoding,
  getSecret,
  IN_PERSON_INTAKE_PAPERWORK_CANONICAL,
  isBookingConfigServiceCategoryCode,
  PAPERWORK_FLOW_ERROR,
  PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TAG,
  PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL,
  parseQuestionnaireCanonicalExtension,
  Secrets,
  SecretsKeys,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  ServiceMode,
  SYSTEM_MANAGED_SERVICE_TAG_SYSTEM,
  VIRTUAL_INTAKE_PAPERWORK_CANONICAL,
} from 'utils';
import { sendErrors } from '../../../shared';

export const healthcareServiceExtensionUrlMap = {
  [ServiceMode['in-person']]: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
  [ServiceMode['virtual']]: PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL,
};

// matches url defined in config/oystehr/intake-paperwork-consent-only.json
export const CONSENT_ONLY_QUESTIONNAIRE_URL = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-consent-only';

// Version minted for a brand-new flow (bumped on every subsequent edit).
export const PAPERWORK_FLOW_BASE_VERSION = '1.0.0';

// =================== resource search helpers ===================
export async function searchActiveQuestionnairesByTag(oystehr: Oystehr, tag: Coding): Promise<Questionnaire[]> {
  const { system, code } = tag;

  return getAllFhirSearchPages<Questionnaire>(
    {
      resourceType: 'Questionnaire',
      params: [
        {
          name: '_tag',
          value: `${system}|${code}`,
        },
        {
          name: 'status',
          value: 'active',
        },
      ],
    },
    oystehr
  );
}

export async function searchServiceCategoryHealthcareServices(oystehr: Oystehr): Promise<HealthcareService[]> {
  return getAllFhirSearchPages<HealthcareService>(
    { resourceType: 'HealthcareService', params: [{ name: '_tag', value: SERVICE_CATEGORY_TAG.code }] },
    oystehr
  );
}

// =================== ottehr managed questionnaire helpers ===================
export const getOttehrManagedQuestionnaires = async (
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<Questionnaire[]> => {
  const questionnaires = await Promise.all([
    makeQuestionnaireSearchRequest(IN_PERSON_INTAKE_PAPERWORK_CANONICAL, oystehr, secrets),
    makeQuestionnaireSearchRequest(VIRTUAL_INTAKE_PAPERWORK_CANONICAL, oystehr, secrets),
    makeQuestionnaireSearchRequest({ url: CONSENT_ONLY_QUESTIONNAIRE_URL }, oystehr, secrets),
  ]);

  return questionnaires.filter((q) => q !== undefined);
};

const makeQuestionnaireSearchRequest = async (
  qConfig: { url: string; version?: string },
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<Questionnaire | undefined> => {
  const { url, version } = qConfig;

  const params: SearchParam[] = [{ name: 'url', value: url }];
  if (version) {
    params.push({ name: 'version', value: version });
  } else {
    params.push({ name: 'status', value: 'active' });
  }

  const qSearch = (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params,
    })
  ).unbundle();

  if (qSearch.length !== 1) {
    const returned = qSearch.map((q) => `Questionnaire/${q.id}`);
    console.log('questionnaires returned', returned);
    const errorMessage = `Unexpected number of questionnaires returned for ${url}|${version}: ${returned.length}`;
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    // no need to error and fail the call but this would be odd so alerting
    await sendErrors(errorMessage, ENVIRONMENT);
    return;
  }

  return qSearch[0];
};

// =================== resource formatting helpers ==================
/** returns url|version given that both if exist, if either is missing undefined is returned */
export const getCanonicalUrlFromQ = (questionnaire: Questionnaire): string | undefined => {
  const { url, version } = questionnaire;

  if (!url || !version) return;

  return `${url}|${version}`;
};

export type BuildFlowQuestionnaireInput = {
  slug: string; // unique across questionnaires and will be used for name and url, will only be passed in at create
  version: string;
  title: string;
  serviceModes: ServiceMode[];
  includedForms: string[]; // canonical url | version for each form to be included in the flow
  status: Questionnaire['status'];
  ottehrManagedServices: FlowService[];
};

export function buildFlowQuestionnaire(input: BuildFlowQuestionnaireInput): Questionnaire {
  const { slug, version, title, serviceModes, includedForms, status, ottehrManagedServices } = input;

  const extension = makeFlowModeExtensions(serviceModes);

  const ottehrManagedServiceTags = makeOttehrManagedServiceTags(ottehrManagedServices);

  const questionnaire: Questionnaire = {
    resourceType: 'Questionnaire',
    url: `https://ottehr.com/FHIR/Questionnaire/${slug}`,
    version: version,
    name: slug,
    title,
    status,
    meta: { tag: [PAPERWORK_FLOW_TAG, ...ottehrManagedServiceTags] },
    extension,
    derivedFrom: includedForms, // important: forms must remain in the order which they were sent
  };

  return questionnaire;
}

export function makeFlowModeExtensions(modes: ServiceMode[]): Extension[] {
  const extension: Extension[] = modes.map((mode) => ({
    url: PAPERWORK_FLOW_MODE_EXTENSION_URL,
    valueCode: mode,
  }));
  return extension;
}

export function makeOttehrManagedServiceTags(services: FlowService[]): Coding[] {
  return services.map((service) => {
    return {
      system: SYSTEM_MANAGED_SERVICE_TAG_SYSTEM,
      code: service.id,
      display: service.label,
    };
  });
}

/** returns canonical urls (url|version) for flow forms passed */
export function getFormCanonicals(formQuestionnaires: Questionnaire[], flowForms: FlowForm[]): string[] {
  const formUrlMap = new Map<string, Questionnaire>();
  const formCanonicalUrls: string[] = [];

  formQuestionnaires.forEach((form) => form.url && formUrlMap.set(form.url, form));

  // important: forms must remain in the order which they were sent
  flowForms.forEach((form) => {
    // we will use the url to grab the form to accommodate for edge case where the form was edited while a user was making the flow
    const q = formUrlMap.get(form.url);

    // edge case: form was deleted while someone else was making this flow - we should tell the user
    if (!q || q.status === 'retired') {
      throw PAPERWORK_FLOW_ERROR(
        `We could not resolve for form: ${form.label}; please verify in the questionnaires tab that ths form is active`
      );
    }

    const canonical = getCanonicalUrlFromQ(q);
    if (!canonical) throw new Error(`Could not parse canonical url from Questionnaire/${q.id}`);

    formCanonicalUrls.push(canonical);
  });

  return formCanonicalUrls;
}

// builds the patch op for an upserted extension without mutating the resource passed in
export function getPatchOperationForExtensionUpsert(
  resource: { extension?: Extension[] },
  newExtension: Extension
): Operation | undefined {
  const existingExtension = resource.extension;

  if (!existingExtension) {
    return { op: 'add', path: '/extension', value: [newExtension] };
  }

  const existingIndex = existingExtension.findIndex((ext) => ext.url === newExtension.url);

  if (existingIndex === -1) {
    return { op: 'add', path: '/extension', value: [...existingExtension, newExtension] };
  }

  if (isEqual(existingExtension[existingIndex], newExtension)) {
    return undefined;
  }

  const updatedExtension = [...existingExtension];
  updatedExtension[existingIndex] = newExtension;
  return { op: 'replace', path: '/extension', value: updatedExtension };
}

export function getFlowModes(q: Questionnaire): ServiceMode[] {
  const modes = (q.extension ?? [])
    .filter((e) => e.url === PAPERWORK_FLOW_MODE_EXTENSION_URL)
    .map((e) => e.valueCode)
    .filter((c): c is ServiceMode => c === ServiceMode['in-person'] || c === ServiceMode.virtual);
  return Object.values(ServiceMode).filter((m) => modes.includes(m));
}

/**
 * Resolves the active paperwork flow canonical assigned to a (service category, visit mode), or
 * undefined when none is assigned. Mirrors resolveServiceCategory's precedence:
 * - A BOOKING_CONFIG (ottehr-managed) service category is matched against the flow Questionnaire's
 *   SYSTEM_MANAGED_SERVICE_TAG_SYSTEM meta.tag (same slug identifier space as the slot's serviceCategory).
 * - Any other (FHIR-backed) service category is matched to its HealthcareService via the
 *   SERVICE_CATEGORY_SYSTEM coding on HealthcareService.type[] (NOT the resource id), and the flow
 *   canonical is read from that service's per-mode paperwork-flow extension.
 * Only active flows are considered (searchActiveQuestionnairesByTag filters status=active; the HS
 * extension is maintained by flow create/update to point at the active flow).
 */
export async function resolveFlowCanonicalForServiceMode(input: {
  serviceCategoryCode: string;
  serviceMode: ServiceMode;
  oystehr: Oystehr;
}): Promise<CanonicalUrl | undefined> {
  const { serviceCategoryCode, serviceMode, oystehr } = input;
  if (!serviceCategoryCode) return undefined;

  if (isBookingConfigServiceCategoryCode(serviceCategoryCode)) {
    // Ottehr-managed service category: the assignment lives as a meta.tag on the flow Questionnaire.
    const flows = await searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG);
    const match = flows.find(
      (flow) =>
        (flow.meta?.tag ?? []).some(
          (tag) => tag.system === SYSTEM_MANAGED_SERVICE_TAG_SYSTEM && tag.code === serviceCategoryCode
        ) && getFlowModes(flow).includes(serviceMode)
    );
    const canonical = match ? getCanonicalUrlFromQ(match) : undefined;
    return canonical ? parseQuestionnaireCanonicalExtension(canonical) : undefined;
  }

  // FHIR-backed service category: the assignment lives as a per-mode extension on the HealthcareService.
  const services = await searchServiceCategoryHealthcareServices(oystehr);
  const service = services.find((hs) => getCoding(hs.type, SERVICE_CATEGORY_SYSTEM)?.code === serviceCategoryCode);
  if (!service) return undefined;
  const extensionUrl = healthcareServiceExtensionUrlMap[serviceMode];
  const valueCanonical = service.extension?.find((ext) => ext.url === extensionUrl)?.valueCanonical;
  return valueCanonical ? parseQuestionnaireCanonicalExtension(valueCanonical) : undefined;
}

/**
 * Validates that assembling the given form canonicals into a flow won't produce duplicate top-level
 * page linkIds — the patient paperwork experience keys pages by top-level linkId, so a collision would
 * break navigation, review, and pre-fill. The consent-forms page (CONSENT_FORMS_PAGE_LINK_ID) is
 * exempt: it may appear in more than one form and is de-duplicated (keep-last) at assembly. Throws
 * PAPERWORK_FLOW_ERROR naming any other duplicated linkId so the admin fixes the bundle before saving.
 */
export function validateFlowFormLinkIds(formCanonicals: string[], allFormQuestionnaires: Questionnaire[]): void {
  const formUrlMap = new Map<string, Questionnaire>();
  allFormQuestionnaires.forEach((form) => form.url && formUrlMap.set(form.url, form));

  const seenLinkIds = new Set<string>();
  const duplicateLinkIds = new Set<string>();

  for (const canonical of formCanonicals) {
    const [url, version] = canonical.split('|');
    // this should never happen
    if (!url || !version) throw new Error(`Form canonical url is malformed: ${canonical}`);

    const formQ = formUrlMap.get(url);
    // This should also never happen
    // The derivedFrom canonical urls should be formed from the set of form questionnaires passed into this function
    // so it would be odd to not find the form questionnaire
    if (!formQ) throw new Error(`Could not find questionnaire for form: ${url}`);

    for (const item of formQ.item ?? []) {
      const { linkId } = item;
      if (!linkId || linkId === CONSENT_FORMS_PAGE_LINK_ID) continue;
      if (seenLinkIds.has(linkId)) {
        duplicateLinkIds.add(linkId);
      } else {
        seenLinkIds.add(linkId);
      }
    }
  }

  if (duplicateLinkIds.size > 0) {
    // it might be better to handle this in the practice managed form module
    // we could still validate here when building the flow but at that point if a duplicate was found it would be indicative of a system issue
    // and we could throw 500 - not sure it makes sense to put the onerous of this on the user
    throw PAPERWORK_FLOW_ERROR(
      `Forms in this paperwork flow contain duplicate page linkId(s): ${[...duplicateLinkIds].join(
        ', '
      )}. Each page must have a unique linkId across the flow's forms.`
    );
  }
}
