import { HealthcareService, Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import {
  CanonicalUrl,
  INTEGRATION_TEST_TAG_SYSTEM,
  PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
  PAPERWORK_FLOW_MODE_EXTENSION_URL,
  PAPERWORK_FLOW_TAG,
  resolveEffectiveQuestionnaire,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
} from 'utils';
import { ResourceHandler } from '../resource-handler';

/** A single test-managed custom form that a flow is assembled from. */
export interface CustomFlowForm {
  /** Top-level page group linkId (→ URL slug = linkId without the '-page' suffix). */
  pageLinkId: string;
  /** The single fillable field's linkId (also its DOM id). */
  fieldLinkId: string;
  /** A value the test fills into the field. */
  fieldValue: string;
  /** The deployed form's canonical (url|version). */
  canonical: CanonicalUrl;
  /** The created FHIR Questionnaire. */
  questionnaire: Questionnaire;
}

/**
 * A custom, test-isolated FHIR-backed service category with an in-person paperwork flow attached, the flow
 * assembled from ≥2 test-managed custom forms.
 */
export interface CreatedServiceCategoryFlow {
  serviceCategoryCode: string;
  serviceCategoryDisplay: string;
  /** A reason-for-visit configured on the category (used to fill the booking form). */
  reasonForVisit: { label: string; value: string };
  /** The created service-category HealthcareService (carries the in-person flow extension). */
  healthcareService: HealthcareService;
  /** The created paperwork flow Questionnaire (derivedFrom the custom forms). */
  flowQuestionnaire: Questionnaire;
  /** The flow's canonical (url + version) — what create-slot stamps on the Slot when the flow wins. */
  flowCanonical: CanonicalUrl;
  /** The flow's assembled effective questionnaire (custom forms' pages concatenated) — what the app renders. */
  effectiveQuestionnaire: Questionnaire;
  /** The custom forms in derivedFrom order, with the linkIds/values the test fills. */
  forms: CustomFlowForm[];
}

interface CustomFormSpec {
  slug: string;
  title: string;
  pageLinkId: string;
  fieldLinkId: string;
  fieldLabel: string;
  fieldValue: string;
}

type CreatedId = ['Questionnaire' | 'HealthcareService', string | undefined];

/**
 * Stands up a self-contained, worker-isolated paperwork-flow fixture for E2E tests:
 *   - ≥2 test-managed custom form Questionnaires (each a single fillable page),
 *   - a paperwork flow Questionnaire (tagged {@link PAPERWORK_FLOW_TAG}) whose `derivedFrom` lists those forms,
 *   - a custom FHIR-backed service category (a HealthcareService tagged {@link SERVICE_CATEGORY_TAG}) with the
 *     flow assigned for the in-person mode (a per-mode extension on the HealthcareService).
 *
 * The zambda flow-builder helpers live in the `zambdas` package (not importable from intake tests), so the
 * flow Questionnaire + HealthcareService are built directly via FHIR using `utils` constants — the same
 * shapes the backend produces/reads. The custom forms are minimal hand-authored questionnaires: a single
 * top-level `group` page whose direct child is one `string` field (so the field's DOM id equals its linkId,
 * which the paperwork fill helper relies on).
 */
export class TestServiceCategoryFlowManager {
  private resourceHandler: ResourceHandler;
  private workerUniqueId: string;
  private createdIds: CreatedId[];
  private created?: CreatedServiceCategoryFlow;

  /**
   * @param workerUniqueId - Unique identifier for this worker to isolate/tag test resources.
   */
  constructor(workerUniqueId: string) {
    this.resourceHandler = new ResourceHandler();
    this.workerUniqueId = workerUniqueId;
    this.createdIds = [];
  }

  /**
   * Initialize the underlying Oystehr client.
   */
  async init(): Promise<void> {
    await this.resourceHandler.initApi();
  }

  /**
   * Create the two custom forms, the in-person flow assembled from them, and the custom service category
   * the flow is assigned to.
   */
  async createInPersonFlowForCustomService(): Promise<CreatedServiceCategoryFlow> {
    if (this.created) {
      return this.created;
    }

    const oystehr = this.resourceHandler.apiClient;
    const processId = this.workerUniqueId;

    const serviceCategoryCode = `e2e-flow-cat-${processId}`.toLowerCase();
    const serviceCategoryDisplay = `E2E Flow Category ${processId}`;
    const reasonForVisit = { label: 'E2E Flow Reason', value: 'E2E Flow Reason' };
    const flowUrl = `https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson-e2e-flow-${processId}`;
    const flowVersion = '1.0.0';

    // Two distinct single-page custom forms. Page linkIds MUST differ, or flow assembly de-dups them to one
    // page. Field/page linkIds are stable (scoped per questionnaire); only the questionnaire url is unique.
    const formSpecs: CustomFormSpec[] = [
      {
        slug: 'one',
        title: 'E2E Custom Form One',
        pageLinkId: 'custom-form-one-page',
        fieldLinkId: 'custom-form-one-text',
        fieldLabel: 'Custom form one — free text',
        fieldValue: 'E2E answer one',
      },
      {
        slug: 'two',
        title: 'E2E Custom Form Two',
        pageLinkId: 'custom-form-two-page',
        fieldLinkId: 'custom-form-two-text',
        fieldLabel: 'Custom form two — free text',
        fieldValue: 'E2E answer two',
      },
    ];

    // 1. Custom forms.
    const forms: CustomFlowForm[] = [];
    for (const spec of formSpecs) {
      const url = `https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson-e2e-custom-${spec.slug}-${processId}`;
      const version = '1.0.0';
      const pageItem: QuestionnaireItem = {
        linkId: spec.pageLinkId,
        type: 'group',
        text: spec.title,
        item: [{ linkId: spec.fieldLinkId, type: 'string', text: spec.fieldLabel, required: false }],
      };
      const formInput: Questionnaire = {
        resourceType: 'Questionnaire',
        status: 'active',
        url,
        version,
        name: `e2e_custom_form_${spec.slug}_${processId}`,
        title: spec.title,
        item: [pageItem],
        meta: {
          tag: [
            {
              system: INTEGRATION_TEST_TAG_SYSTEM,
              code: `DELETE_ME-${processId}`,
              display: 'E2E Test Flow Custom Form',
            },
          ],
        },
      };
      const created = await oystehr.fhir.create(formInput);
      if (!created.id) {
        throw new Error(`Failed to create custom form "${spec.slug}"`);
      }

      const createdId: CreatedId = ['Questionnaire', created.id];
      this.createdIds.push(createdId);

      forms.push({
        pageLinkId: spec.pageLinkId,
        fieldLinkId: spec.fieldLinkId,
        fieldValue: spec.fieldValue,
        canonical: { url, version },
        questionnaire: created,
      });
    }

    // 2. Paperwork Flow Questionnaire: tagged PAPERWORK_FLOW_TAG, active, in-person mode, derivedFrom the
    //    two custom forms (canonicals must be `url|version`).
    const flowInput: Questionnaire = {
      resourceType: 'Questionnaire',
      status: 'active',
      url: flowUrl,
      version: flowVersion,
      name: `e2e_paperwork_flow_${processId}`,
      title: `E2E Paperwork Flow ${processId}`,
      derivedFrom: forms.map((f) => `${f.canonical.url}|${f.canonical.version}`),
      extension: [{ url: PAPERWORK_FLOW_MODE_EXTENSION_URL, valueCode: ServiceMode['in-person'] }],
      meta: {
        tag: [
          PAPERWORK_FLOW_TAG,
          {
            system: INTEGRATION_TEST_TAG_SYSTEM,
            code: `DELETE_ME-${processId}`,
            display: 'E2E Test Paperwork Flow',
          },
        ],
      },
    };
    const flowQuestionnaire = await oystehr.fhir.create(flowInput);
    if (!flowQuestionnaire.id) {
      throw new Error('Failed to create paperwork flow Questionnaire');
    }

    const qCreatedId: CreatedId = ['Questionnaire', flowQuestionnaire.id];
    this.createdIds.push(qCreatedId);

    // 3. Custom service-category HealthcareService, with the in-person flow extension baked in. The flow
    //    extension's valueCanonical is the flow's BARE url (the backend resolver matches
    //    `flowQuestionnaire.url === valueCanonical`), NOT url|version.
    const healthcareServiceInput: HealthcareService = {
      resourceType: 'HealthcareService',
      active: true,
      name: serviceCategoryDisplay,
      type: [
        {
          coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: serviceCategoryCode, display: serviceCategoryDisplay }],
        },
      ],
      characteristic: serviceCategoryCharacteristics({
        modes: [ServiceMode['in-person']],
        visitTypes: [ServiceVisitType.prebook],
        durationMinutes: 30,
      }),
      extension: [
        {
          url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
          valueString: JSON.stringify({ reasonsForVisit: [reasonForVisit] }),
        },
        {
          url: PAPERWORK_FLOW_INPERSON_EXTENSION_URL,
          valueCanonical: flowUrl,
        },
      ],
      meta: {
        tag: [
          SERVICE_CATEGORY_TAG,
          {
            system: INTEGRATION_TEST_TAG_SYSTEM,
            code: `DELETE_ME-${processId}`,
            display: 'E2E Test Flow Service Category',
          },
        ],
      },
    };
    const healthcareService = await oystehr.fhir.create(healthcareServiceInput);
    if (!healthcareService.id) {
      throw new Error('Failed to create custom service-category HealthcareService');
    }

    const hsCreatedId: CreatedId = ['HealthcareService', healthcareService.id];
    this.createdIds.push(hsCreatedId);

    // 4. Assemble the flow's effective questionnaire exactly as get-paperwork does (fetches the constituent
    //    forms and concatenates their top-level items) — this is what we drive the paperwork helper from.
    const effectiveQuestionnaire = await resolveEffectiveQuestionnaire(flowQuestionnaire, oystehr);

    this.created = {
      serviceCategoryCode,
      serviceCategoryDisplay,
      reasonForVisit,
      healthcareService,
      flowQuestionnaire,
      flowCanonical: { url: flowUrl, version: flowVersion },
      effectiveQuestionnaire,
      forms,
    };

    console.log(
      `✓ Created custom service category "${serviceCategoryCode}" with in-person paperwork flow ` +
        `${flowUrl}|${flowVersion} assembled from ${forms.length} custom forms ` +
        `(${effectiveQuestionnaire.item?.length ?? 0} pages)`
    );

    return this.created;
  }

  /**
   * Delete everything this manager created (custom form Questionnaires, flow Questionnaire, and custom service-category HS) by id.
   */
  async cleanup(): Promise<void> {
    if (this.createdIds.length === 0) {
      return;
    }
    const oystehr = this.resourceHandler.apiClient;

    const deletions = this.createdIds;

    for (const [resourceType, id] of deletions) {
      if (!id) {
        continue;
      }
      try {
        await oystehr.fhir.delete({ resourceType, id });
        console.log(`Deleted ${resourceType}/${id}`);
      } catch (err) {
        console.warn(`Failed to delete ${resourceType}/${id}:`, err);
      }
    }

    this.created = undefined;
  }
}
