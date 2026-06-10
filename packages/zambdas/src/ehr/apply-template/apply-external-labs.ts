import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, List, Location, Practitioner, ServiceRequest } from 'fhir/r4b';
import {
  ApplyTemplateWarning,
  chartDataTagSystem,
  CreateLabPaymentMethod,
  DiagnosisDTO,
  EXTERNAL_LAB_TEMPLATE_PLAN_PAYMENT_METHOD_EXT_URL,
  FHIR_IDC10_VALUESET_SYSTEM,
  getAttendingPractitionerId,
  getSecret,
  ICD_10_CODE_SYSTEM,
  isPSCOrder,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LabPaymentMethod,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  resourceHasTagSystem,
  Secrets,
  SecretsKeys,
  STATIC_COMPENDIUM_LAB_GUID,
  TemplateSectionAction,
} from 'utils';
import { getMyPractitionerId } from '../../shared';
import { buildExternalLabOrderRequests } from '../lab/external/create-lab-order/build-order';
import { getOrderableItems } from '../lab/shared/orderable-items';
import { TemplateEncounterResource } from '../shared/template-helpers';

export const EXTERNAL_LAB_PLAN_TAG_SYSTEM = chartDataTagSystem('external-lab-template-plan');

export const isExternalLabPlanServiceRequest = (maybePlan: FhirResource): maybePlan is ServiceRequest => {
  if (maybePlan.resourceType !== 'ServiceRequest') return false;
  return maybePlan.intent === 'plan' && resourceHasTagSystem(maybePlan, EXTERNAL_LAB_PLAN_TAG_SYSTEM);
};

/**
 * Returns the external lab plan ServiceRequests embedded in a global template's
 * List.contained.
 */
export const findExternalLabPlans = (templateList: List): ServiceRequest[] => {
  return (templateList.contained ?? []).filter((r): r is ServiceRequest => isExternalLabPlanServiceRequest(r));
};

// The ordering inputs an external lab plan carries, lifted off the plan
// ServiceRequest's FHIR shape so the apply flow below can work with plain
// values. The ordering office is intentionally absent - it's derived from the
// encounter the template is being applied to.
export interface ParsedExternalLabPlan {
  planId: string;
  labGuid: string;
  labName: string;
  itemCode: string;
  testName: string;
  dx: DiagnosisDTO[];
  note: string | undefined;
  psc: boolean;
  configuredPaymentMethod: CreateLabPaymentMethod | undefined;
}

export const labelForExternalLabPlan = (plan: ServiceRequest): string => {
  return (
    plan.code?.text ?? plan.code?.coding?.[0]?.display ?? plan.code?.coding?.[0]?.code ?? 'Unknown external lab test'
  );
};

const VALID_PAYMENT_METHODS = new Set<string>(Object.values(LabPaymentMethod));

export const parsePlanPaymentMethod = (value: string | undefined): CreateLabPaymentMethod | undefined => {
  if (value && VALID_PAYMENT_METHODS.has(value)) return value as CreateLabPaymentMethod;
  return undefined;
};

// Reverse the conversion the create flow does when it writes reasonCode from
// DiagnosisDTOs. We lose `isPrimary` here, which is fine - the saved order
// doesn't carry that flag.
const diagnosesFromReasonCode = (plan: ServiceRequest): DiagnosisDTO[] => {
  return (plan.reasonCode ?? [])
    .map((rc) => {
      const icd =
        rc.coding?.find((c) => c.system === FHIR_IDC10_VALUESET_SYSTEM || c.system === ICD_10_CODE_SYSTEM) ??
        rc.coding?.[0];
      return {
        code: icd?.code ?? '',
        display: icd?.display ?? rc.text ?? '',
        isPrimary: false,
      };
    })
    .filter((d) => d.code || d.display);
};

const noteFromPlan = (plan: ServiceRequest): string | undefined => {
  const joined = (plan.note ?? [])
    .map((n) => n.text ?? '')
    .filter((t) => t.length > 0)
    .join('\n\n');
  return joined.length > 0 ? joined : undefined;
};

/**
 * Lifts the ordering inputs off a plan ServiceRequest. Returns null when the
 * plan is missing its lab or test identity (malformed template) - the caller
 * surfaces that as a warning.
 */
export const parseExternalLabPlan = (plan: ServiceRequest): ParsedExternalLabPlan | null => {
  const labPerformer = plan.performer?.find((p) => p.identifier?.system === OYSTEHR_LAB_GUID_SYSTEM);
  const labGuid = labPerformer?.identifier?.value;
  const itemCoding = plan.code?.coding?.find((c) => c.system === OYSTEHR_LAB_OI_CODE_SYSTEM);
  if (!labGuid || !itemCoding?.code) return null;

  return {
    planId: plan.id ?? '',
    labGuid,
    labName: labPerformer?.display ?? '',
    itemCode: itemCoding.code,
    testName: itemCoding.display ?? plan.code?.text ?? itemCoding.code,
    dx: diagnosesFromReasonCode(plan),
    note: noteFromPlan(plan),
    psc: isPSCOrder(plan),
    configuredPaymentMethod: parsePlanPaymentMethod(
      plan.extension?.find((e) => e.url === EXTERNAL_LAB_TEMPLATE_PLAN_PAYMENT_METHOD_EXT_URL)?.valueString
    ),
  };
};

/**
 * Matches a parsed plan to the fresh orderable items fetched from the Oystehr
 * Labs API. Static-compendium ("generic") labs all share one labGuid and the
 * API reports the generic lab name on each result, so the plan's saved lab
 * name is restored onto the match - the create flow disambiguates the lab
 * Organization by name in the static case.
 */
export const matchOrderableItemForPlan = (
  parsed: Pick<ParsedExternalLabPlan, 'labGuid' | 'labName' | 'itemCode'>,
  items: OrderableItemSearchResult[]
): OrderableItemSearchResult | undefined => {
  const match = items.find((oi) => oi.item.itemCode === parsed.itemCode && oi.lab.labGuid === parsed.labGuid);
  if (!match) return undefined;
  if (parsed.labGuid === STATIC_COMPENDIUM_LAB_GUID && parsed.labName) {
    return { item: match.item, lab: { ...match.lab, labName: parsed.labName } };
  }
  return match;
};

/**
 * Resolves the ordering office for the apply from the encounter's location.
 * The Location resource rides along in the encounter bundle via the
 * Encounter:location include.
 */
export const getOrderingLocationFromEncounter = (
  encounter: Encounter,
  encounterResources: TemplateEncounterResource[]
): Location | undefined => {
  const locations = encounterResources.filter((r): r is Location => r.resourceType === 'Location');
  const encounterLocationIds = (encounter.location ?? [])
    .map((l) => l.location?.reference?.split('/')[1])
    .filter((id): id is string => Boolean(id));
  return locations.find((loc) => loc.id && encounterLocationIds.includes(loc.id)) ?? locations[0];
};

// A location can place external lab orders when it carries at least one lab
// account number identifier assigned by a lab Organization. The create flow
// re-validates the specific location ↔ lab pairing per order; this check just
// lets us warn up-front with a clearer message when the office isn't
// configured for external labs at all.
export const locationIsEnabledForLabs = (location: Location): boolean => {
  return !!location.identifier?.some(
    (id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner?.reference
  );
};

interface ApplyExternalLabPlansInput {
  templateList: List;
  encounter: Encounter;
  encounterResources: TemplateEncounterResource[];
  userToken: string;
  secrets: Secrets | null;
  oystehr: Oystehr;
  m2mToken: string;
  action: TemplateSectionAction;
  // The payment method the user confirmed in the preview dialog. Required by
  // the EHR flow; API callers may omit it, in which case each plan falls back
  // to the payment method configured on the template.
  selectedPaymentMethod: CreateLabPaymentMethod | undefined;
}

interface ApplyExternalLabPlansResult {
  warnings: ApplyTemplateWarning[];
}

/**
 * Applies the external lab "plan" ServiceRequests stored in a template onto
 * the current encounter by re-running the live order-creation flow for each
 * plan. The ordering office comes from the encounter's location; the lab +
 * test combo is re-resolved against the lab's current compendium so templates
 * float forward as compendia change. Plans that can't apply (test no longer
 * orderable, office not configured for the lab, no payment method) are skipped
 * with a warning so the rest of the template still applies.
 *
 * Each created order lands in the same state as a chart-created order: a
 * draft ServiceRequest with a pre-submission "Collect sample" Task.
 */
export async function applyExternalLabPlans(input: ApplyExternalLabPlansInput): Promise<ApplyExternalLabPlansResult> {
  const warnings: ApplyTemplateWarning[] = [];
  try {
    const {
      templateList,
      encounter,
      encounterResources,
      userToken,
      secrets,
      oystehr,
      m2mToken,
      action,
      selectedPaymentMethod,
    } = input;
    if (action === 'skip') return { warnings: [] };

    const plans = findExternalLabPlans(templateList);
    if (plans.length === 0) return { warnings: [] };

    const parsedPlans: ParsedExternalLabPlan[] = [];
    for (const plan of plans) {
      const parsed = parseExternalLabPlan(plan);
      if (!parsed) {
        warnings.push({
          section: 'externalLabs',
          message: `Skipped "${labelForExternalLabPlan(
            plan
          )}" — the template entry is missing its lab or test identity.`,
        });
        continue;
      }
      parsedPlans.push(parsed);
    }
    if (parsedPlans.length === 0) return { warnings };

    // Ordering office is automatically selected from the encounter the
    // template is applied to.
    const orderingLocation = getOrderingLocationFromEncounter(encounter, encounterResources);
    if (!orderingLocation?.id) {
      warnings.push({
        section: 'externalLabs',
        message: 'Skipped external lab orders — this visit has no office location to use as the ordering office.',
      });
      return { warnings };
    }
    if (!locationIsEnabledForLabs(orderingLocation)) {
      warnings.push({
        section: 'externalLabs',
        message: `Skipped external lab orders — the '${
          orderingLocation.name ?? orderingLocation.id
        }' office is not configured for external lab ordering.`,
      });
      return { warnings };
    }

    const attendingPractitionerId = getAttendingPractitionerId(encounter);
    if (!attendingPractitionerId) {
      warnings.push({
        section: 'externalLabs',
        message: 'Skipped external lab orders — this encounter has no attending practitioner linked.',
      });
      return { warnings };
    }

    let currentUserPractitionerId: string;
    try {
      currentUserPractitionerId = await getMyPractitionerId(userToken, secrets);
    } catch {
      warnings.push({
        section: 'externalLabs',
        message:
          'Skipped external lab orders — the user applying this template must have a Practitioner resource linked.',
      });
      return { warnings };
    }
    const currentUserPractitioner = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: currentUserPractitionerId,
    });

    const clientOrgId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

    // Re-resolve each plan's lab + test combo against the lab's current
    // compendium, one search per lab.
    const itemsByLabGuid = new Map<string, OrderableItemSearchResult[]>();
    const uniqueLabGuids = Array.from(new Set(parsedPlans.map((p) => p.labGuid)));
    await Promise.all(
      uniqueLabGuids.map(async (labGuid) => {
        const itemCodes = Array.from(new Set(parsedPlans.filter((p) => p.labGuid === labGuid).map((p) => p.itemCode)));
        try {
          itemsByLabGuid.set(labGuid, await getOrderableItems([labGuid], { itemCodes }, m2mToken));
        } catch (err) {
          // Leave the entry unset - the per-plan matching below reports the skip.
          console.error(`Orderable item search failed for lab ${labGuid}`, err);
        }
      })
    );

    // enabledLabs isn't needed by the create flow - it re-validates the
    // location ↔ lab-org pairing against the live Location identifiers and
    // errors with a per-plan message we surface as a warning below.
    const modifiedOrderingLocation = {
      id: orderingLocation.id,
      name: orderingLocation.name ?? '',
      enabledLabs: [],
    };

    for (const parsed of parsedPlans) {
      const items = itemsByLabGuid.get(parsed.labGuid);
      const orderableItem = items ? matchOrderableItemForPlan(parsed, items) : undefined;
      if (!orderableItem) {
        warnings.push({
          section: 'externalLabs',
          message: `Skipped "${parsed.testName}" — the test wasn't found in the ${parsed.labName || 'lab'} compendium.`,
        });
        continue;
      }

      const paymentMethod = selectedPaymentMethod ?? parsed.configuredPaymentMethod;
      if (!paymentMethod) {
        warnings.push({
          section: 'externalLabs',
          message: `Skipped "${parsed.testName}" — no payment method was selected or configured on the template.`,
        });
        continue;
      }

      try {
        // Sequential on purpose: each build re-queries the encounter's draft
        // orders, so a plan for the same lab/psc/payment bundles under the
        // requisition the previous plan just created - matching what happens
        // when a provider places the orders one at a time in the chart UI.
        const requests = await buildExternalLabOrderRequests({
          oystehr,
          dx: parsed.dx,
          encounter,
          orderableItems: [orderableItem],
          psc: parsed.psc,
          orderingLocation: modifiedOrderingLocation,
          selectedPaymentMethod: paymentMethod,
          clinicalInfoNoteByUser: parsed.note,
          currentUserPractitioner,
          attendingPractitionerId,
          clientOrgId,
        });
        await oystehr.fhir.transaction({ requests });
      } catch (err) {
        console.error(`Error applying external lab plan ${parsed.planId}`, err);
        const message =
          err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
            ? err.message
            : undefined;
        warnings.push({
          section: 'externalLabs',
          message: `Skipped "${parsed.testName}"${
            message ? ` — ${message}` : ' — something went wrong creating the order.'
          }`,
        });
      }
    }
  } catch (err) {
    console.error('Encountered error in applyExternalLabPlans', err);
    warnings.push({
      section: 'externalLabs',
      message: 'Something went wrong applying external lab orders. Skipped.',
    });
  }
  return { warnings };
}
