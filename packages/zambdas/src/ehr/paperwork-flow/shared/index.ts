import Oystehr, { BatchInputPatchRequest, SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import {
  CanonicalUrl,
  FlowForm,
  FlowService,
  getAllFhirSearchPages,
  getCoding,
  getSecret,
  IN_PERSON_INTAKE_PAPERWORK_CANONICAL,
  isBookingConfigServiceCategoryCode,
  makeOptimisticLockIfMatchHeader,
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

// The ottehr-managed (service, mode) assignment lives as a SYSTEM_MANAGED_SERVICE_TAG_SYSTEM meta.tag
// on the flow Questionnaire that owns it (there's no HealthcareService extension for these services).
// If flowServices includes any ottehr managed services, find any other active flows that share a visit
// mode and already carry that tag, and strip it so only the flow being saved owns that (service, mode).
export function makeAdditionalFlowQuestionnairePatches(input: {
  modes: ServiceMode[];
  ottehrManagedServices: FlowService[];
  flowQuestionnaires: Questionnaire[];
  targetFlowId?: string;
}): BatchInputPatchRequest<Questionnaire>[] {
  const { modes, ottehrManagedServices, flowQuestionnaires, targetFlowId } = input;
  const patchRequests: BatchInputPatchRequest<Questionnaire>[] = [];

  if (ottehrManagedServices.length === 0) {
    console.log(
      'No ottehr managed services are included in this flow, no patches need to be made to remove from elsewhere'
    );
    return patchRequests;
  }

  const ottehrManagedServiceIds = new Set(ottehrManagedServices.map((service) => service.id));

  flowQuestionnaires.forEach((q) => {
    if (targetFlowId && q.id === targetFlowId) return;

    // this flow doesn't share a visit mode with the flow being saved, so it isn't competing for the same slot
    const sharesMode = getFlowModes(q).some((mode) => modes.includes(mode));
    if (!sharesMode) return;

    const existingTags = q.meta?.tag ?? [];
    const remainingTags = existingTags.filter((t) => {
      const systemManagedServiceTag = t.system === SYSTEM_MANAGED_SERVICE_TAG_SYSTEM;
      if (!systemManagedServiceTag) return true;

      return !t.code || !ottehrManagedServiceIds.has(t.code);
    });

    // nothing to remove from this flow's tags
    if (remainingTags.length === existingTags.length) return;

    const operations: Operation[] = [{ op: 'replace', path: '/meta/tag', value: remainingTags }];

    patchRequests.push({
      method: 'PATCH',
      url: `Questionnaire/${q.id}`,
      operations,
      ifMatch: makeOptimisticLockIfMatchHeader(q),
    });
  });

  return patchRequests;
}

/**
 * Resolves the active paperwork flow canonical assigned to a (service category x visit mode),
 * returns undefined when none is assigned or there is an error resolving the flow.
 * In the case of an error, sentry should be alerted while returning undefined to avoid erroring during booking
 */
export async function resolveFlowCanonicalForServiceMode(input: {
  serviceCategoryCode: string;
  serviceMode: ServiceMode;
  oystehr: Oystehr;
  secrets: Secrets | null;
}): Promise<CanonicalUrl | undefined> {
  const { serviceCategoryCode, serviceMode, oystehr, secrets } = input;
  if (!serviceCategoryCode) return;

  const flows = await searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG);

  if (isBookingConfigServiceCategoryCode(serviceCategoryCode)) {
    // Ottehr-managed service category: the assignment lives as a meta.tag on the flow Questionnaire.
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
  if (!service) return;

  const extensionUrl = healthcareServiceExtensionUrlMap[serviceMode];
  const flowUrlFromExtension = service.extension?.find((ext) => ext.url === extensionUrl)?.valueCanonical;
  if (!flowUrlFromExtension) return;

  const flow = flows.find((flowQ) => flowQ.url === flowUrlFromExtension);
  if (!flow) {
    // we do not want to fail booking but we do want to alert sentry in this case
    const flowsIdMap = flows.map((q) => `Questionnaire/${q.id}`);
    const errorMsg = `A flow extension was found on HealthcareService/${service.id} but we were unable to find an active flow with a matching url: ${flowUrlFromExtension}. Flow questionnaires evaluated: ${flowsIdMap}`;
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await sendErrors(errorMsg, ENVIRONMENT);
    return;
  }

  if (!flow.url || !flow.version) {
    // same as above, we do not want to fail booking but we do want to alert sentry in this case
    // the expectation is that if there is some error resolving the flow url, then fall back to system defaults
    const errorMsg = `Questionnaire/${flow.id} is missing url and/or version. Url: ${flow.url} Version: ${flow.version}`;
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await sendErrors(errorMsg, ENVIRONMENT);
    return;
  }

  const canonicalUrlForFlow: CanonicalUrl = { url: flow.url, version: flow.version };
  return canonicalUrlForFlow;
}
