import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { HealthcareService, Questionnaire } from 'fhir/r4b';
import {
  FlowForm,
  FlowService,
  getSecret,
  IN_PERSON_INTAKE_PAPERWORK_CANONICAL,
  PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
  PAPERWORK_FLOW_TAG,
  PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL,
  PaperworkFlow,
  PaperworkFlowListOutput,
  PaperworkFlowQuestionnaire,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  Secrets,
  SecretsKeys,
  SYSTEM_MANAGED_SERVICE_TAG_SYSTEM,
  VIRTUAL_INTAKE_PAPERWORK_CANONICAL,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  sendErrors,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import {
  CONSENT_ONLY_QUESTIONNAIRE_URL,
  getCanonicalUrlFromQ,
  getFlowModes,
  getOttehrManagedQuestionnaires,
  searchActiveQuestionnairesByTag,
  searchServiceCategoryHealthcareServices,
} from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'paperwork-flow-list';

const INTAKE_URL = IN_PERSON_INTAKE_PAPERWORK_CANONICAL.url as string;
const VIRTUAL_URL = VIRTUAL_INTAKE_PAPERWORK_CANONICAL.url as string;
const MANAGED_Q_LABEL_MAP = {
  [INTAKE_URL]: 'In-Person Intake Paperwork (system managed)',
  [VIRTUAL_URL]: 'Virtual Intake Paperwork (system managed)',
  [CONSENT_ONLY_QUESTIONNAIRE_URL]: 'Consent Page (system managed)',
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const { secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await listPaperworkFlows(oystehr, secrets);

  return { statusCode: 200, body: JSON.stringify(response) };
});

async function listPaperworkFlows(oystehr: Oystehr, secrets: Secrets | null): Promise<PaperworkFlowListOutput> {
  console.log('searching for all flow questionnaires and services');
  const [flowQuestionnaires, formQuestionnaires, ottehrManagedQuestionnaires, services] = await Promise.all([
    searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
    searchActiveQuestionnairesByTag(oystehr, PRACTICE_MANAGED_QUESTIONNAIRE_TAG),
    getOttehrManagedQuestionnaires(oystehr, secrets),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  const allFormQuestionnaires = [...formQuestionnaires, ...ottehrManagedQuestionnaires];

  console.log('mapping form questionnaire by their canonical url');
  const formByUrlMap = makeFormByUrlMap(allFormQuestionnaires);

  console.log('mapping services by their virtual / inperson flow questionnaire canonical urls');
  const servicesByFlowUrlMap = makeServiceIdsByFlowUrlMap(services);

  const flowsMissingUrls: Questionnaire[] = [];
  console.log('formatting flow questionnaires, form questionnaires and services into paperwork flow DTO');
  const flows =
    flowQuestionnaires
      .map((flow) => {
        const paperworkFlowQuestionnaire = toPaperworkFlowQuestionnaire(flow, formByUrlMap);

        if (!paperworkFlowQuestionnaire) return;

        const flowUrl = flow.url;
        if (!flowUrl) {
          flowsMissingUrls.push(flow);
          return;
        }

        const serviceIds = servicesByFlowUrlMap.get(flowUrl);
        const ottehrManagedServiceIds = ottehrManagedServicesFromQ(flow);
        const services = [...ottehrManagedServiceIds, ...(serviceIds ? Array.from(serviceIds) : [])];

        const paperworkFlow: PaperworkFlow = {
          ...paperworkFlowQuestionnaire,
          services,
        };

        return paperworkFlow;
      })
      .filter((flow): flow is PaperworkFlow => flow !== undefined) ?? [];

  const ottehrQsFormatted = managedQToFlowForm(ottehrManagedQuestionnaires);

  // this shouldn't happen but if it does, we don't want to kill the whole list and but will alert sentry
  if (flowsMissingUrls.length > 0) {
    const errorMessage = `Could not resolve urls for the following ${flowsMissingUrls.map(
      (q) => `Questionnaire/${q.id}`
    )}`;
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await sendErrors(errorMessage, ENVIRONMENT);
  }

  return { flows, ottehrManagedQuestionnaires: ottehrQsFormatted };
}

/** returns a map of form questionnaires by their canonical urls (url|version) */
function makeFormByUrlMap(formQuestionnaires: Questionnaire[]): Map<string, Questionnaire> {
  const formByUrlMap = new Map<string, Questionnaire>();
  formQuestionnaires.forEach((form) => {
    const canonical = getCanonicalUrlFromQ(form);
    if (canonical) formByUrlMap.set(canonical, form);
  });

  return formByUrlMap;
}

/** returns of map of healthcare services by their virtual / inperson flow questionnaire canonical urls */
function makeServiceIdsByFlowUrlMap(services: HealthcareService[]): Map<string, FlowService[]> {
  const serviceIdsByFlowUrl = new Map<string, FlowService[]>();

  const mapServiceIdToFlow = (flowUrl: string | undefined, service: FlowService): void => {
    if (!flowUrl) return;

    if (!serviceIdsByFlowUrl.has(flowUrl)) {
      serviceIdsByFlowUrl.set(flowUrl, []);
    }

    serviceIdsByFlowUrl.get(flowUrl)?.push(service);
  };

  services.forEach((service) => {
    const inPersonFlowUrl = service.extension?.find((ext) => ext.url === PAPERWORK_FLOW_INPERSON_EXTENSION_URL)
      ?.valueCanonical;
    const virtualFlowUrl = service.extension?.find((ext) => ext.url === PAPERWORK_FLOW_VIRTUAL_EXTENSION_URL)
      ?.valueCanonical;

    if (!service.id) return;

    const serviceDetail: FlowService = {
      id: service.id,
      label: service.name ?? 'unnamed service',
      ottehrManagedService: false,
    };

    mapServiceIdToFlow(inPersonFlowUrl, serviceDetail);
    mapServiceIdToFlow(virtualFlowUrl, serviceDetail);
  });

  return serviceIdsByFlowUrl;
}

function toPaperworkFlowQuestionnaire(
  flow: Questionnaire,
  forms: Map<string, Questionnaire>
): PaperworkFlowQuestionnaire {
  return {
    qId: flow.id ?? '',
    name: flow.title ?? 'flow',
    url: flow.url ?? '',
    version: flow.version ?? '',
    status: flow.status,
    forms: toFlowForm(flow, forms),
    modes: getFlowModes(flow),
  };
}

function toFlowForm(q: Questionnaire, forms: Map<string, Questionnaire>): FlowForm[] {
  return (
    q.derivedFrom
      ?.map((canonical) => {
        const formQ = forms.get(canonical);
        if (!formQ || !formQ.id || !formQ.url || !formQ.version) return;

        const flowForm: FlowForm = {
          id: formQ.id,
          url: formQ.url,
          label: formQ.title ?? 'form',
        };

        const customLabel = MANAGED_Q_LABEL_MAP[formQ.url];
        if (customLabel) flowForm.label = customLabel;

        return flowForm;
      })
      .filter((form): form is FlowForm => form !== undefined) ?? []
  );
}

const managedQToFlowForm = (questionnaires: Questionnaire[]): FlowForm[] => {
  return questionnaires.map((q) => {
    const url = q.url;
    const formatted = { id: q.id ?? '', url: url ?? '', label: q.title ?? '' };

    if (!url) return formatted;

    const customLabel = MANAGED_Q_LABEL_MAP[url];
    if (customLabel) formatted.label = customLabel;

    return formatted;
  });
};

function ottehrManagedServicesFromQ(questionnaire: Questionnaire): FlowService[] {
  const ottehrManagedServiceIds: FlowService[] = [];

  questionnaire.meta?.tag?.forEach((t) => {
    if (t.system === SYSTEM_MANAGED_SERVICE_TAG_SYSTEM) {
      if (t.code) {
        ottehrManagedServiceIds.push({ id: t.code, label: t.display ?? t.code, ottehrManagedService: true });
      }
    }
  });

  return ottehrManagedServiceIds;
}
