import Oystehr from '@oystehr/sdk';
import { Encounter, FhirResource, List, Location, Practitioner, ServiceRequest } from 'fhir/r4b';
import {
  chartDataTagSystem,
  CreateLabPaymentMethod,
  DiagnosisDTO,
  getAttendingPractitionerId,
  getSecret,
  isPSCOrder,
  locationIsEnabledForLabs,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  resourceHasTagSystem,
  Secrets,
  SecretsKeys,
  STATIC_COMPENDIUM_LAB_GUID,
  TemplateSectionAction,
  TemplateWarning,
} from 'utils';
import { getMyPractitionerId } from '../../shared';
import { buildExternalLabOrderRequests } from '../lab/external/create-lab-order/build-order';
import { getOrderableItems } from '../lab/shared/orderable-items';
import { TemplateEncounterResource } from '../shared/template-helpers';
import { diagnosesFromReasonCode, noteFromPlan } from './helpers';

const EXTERNAL_LAB_PLAN_TAG_SYSTEM = chartDataTagSystem('external-lab-template-plan');

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
// values. The ordering office and payment method are intentionally absent -
// the office is derived from the encounter the template is being applied to,
// and the payment method comes from the user's confirmation in the preview
// dialog (defaulted from the visit's payment details, mirroring the chart's
// create-order page).
export interface ParsedExternalLabPlan {
  planId: string;
  labGuid: string;
  labName: string;
  itemCode: string;
  testName: string;
  dx: DiagnosisDTO[];
  note: string | undefined;
  psc: boolean;
}

export const labelForExternalLabPlan = (plan: ServiceRequest): string => {
  return (
    plan.code?.text ?? plan.code?.coding?.[0]?.display ?? plan.code?.coding?.[0]?.code ?? 'Unknown external lab test'
  );
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

interface ApplyExternalLabPlansInput {
  templateList: List;
  encounter: Encounter;
  encounterResources: TemplateEncounterResource[];
  userToken: string;
  secrets: Secrets | null;
  oystehr: Oystehr;
  m2mToken: string;
  action: TemplateSectionAction;
  // The payment method the user confirmed in the preview dialog (defaulted
  // there from the visit's payment details). Templates don't carry a payment
  // method, so this is required to create any orders - without it the section
  // is skipped with a warning.
  selectedPaymentMethod: CreateLabPaymentMethod | undefined;
}

interface ApplyExternalLabPlansResult {
  warnings: TemplateWarning[];
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
  const warnings: TemplateWarning[] = [];
  const externalLabsSectionName = 'externalLabs';
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

    // The EHR preview dialog always sends a payment method when this section
    // is appended; without one we can't create orders at all.
    if (!selectedPaymentMethod) {
      warnings.push({
        section: externalLabsSectionName,
        message: 'Skipped external lab orders — no payment method was provided.',
      });
      return { warnings };
    }

    const parsedPlans: ParsedExternalLabPlan[] = [];
    for (const plan of plans) {
      const parsed = parseExternalLabPlan(plan);
      if (!parsed) {
        warnings.push({
          section: externalLabsSectionName,
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
        section: externalLabsSectionName,
        message: 'Skipped external lab orders — this visit has no office location to use as the ordering office.',
      });
      return { warnings };
    }
    if (!locationIsEnabledForLabs(orderingLocation)) {
      warnings.push({
        section: externalLabsSectionName,
        message: `Skipped external lab orders — the '${
          orderingLocation.name ?? orderingLocation.id
        }' office is not configured for external lab ordering.`,
      });
      return { warnings };
    }

    const attendingPractitionerId = getAttendingPractitionerId(encounter);
    if (!attendingPractitionerId) {
      warnings.push({
        section: externalLabsSectionName,
        message: 'Skipped external lab orders — this encounter has no attending practitioner linked.',
      });
      return { warnings };
    }

    let currentUserPractitionerId: string;
    try {
      currentUserPractitionerId = await getMyPractitionerId(userToken, secrets);
    } catch {
      warnings.push({
        section: externalLabsSectionName,
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
    const itemsByLabGuid = await fetchPlanItemsByLabGuid(parsedPlans, m2mToken);

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
      if (items === 'fetch-failed') {
        warnings.push({
          section: externalLabsSectionName,
          message: `Skipped "${parsed.testName}" — no items could be fetched from the ${
            parsed.labName || 'lab'
          } compendium.`,
        });
        continue;
      }

      const orderableItem = items ? matchOrderableItemForPlan(parsed, items) : undefined;
      if (!orderableItem) {
        warnings.push({
          section: externalLabsSectionName,
          message: `Skipped "${parsed.testName}" — the test wasn't found in the ${parsed.labName || 'lab'} compendium.`,
        });
        continue;
      }

      try {
        // Sequential on purpose: each build re-queries the encounter's draft
        // orders, so a plan for the same lab/psc/payment bundles under the
        // requisition the previous plan just created - matching what happens
        // when a provider places the orders one at a time in the chart UI.
        // Note: this helper can actually take the full list of orderable items
        // and make all the requests in one go, but splitting it up lets us display
        // helpful error messages and accoutn for different dx per order
        const requests = await buildExternalLabOrderRequests({
          oystehr,
          dx: parsed.dx,
          encounter,
          orderableItems: [orderableItem],
          psc: parsed.psc,
          orderingLocation: modifiedOrderingLocation,
          selectedPaymentMethod,
          clinicalInfoNoteByUser: parsed.note,
          currentUserPractitioner,
          attendingPractitionerId,
          clientOrgId,
        });

        if (requests.length) await oystehr.fhir.transaction({ requests });
        else console.warn('There were no external lab requests made, none applied to template');
      } catch (err) {
        console.error(`Error applying external lab plan ${parsed.planId}`, err);
        const message =
          err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
            ? err.message
            : undefined;
        warnings.push({
          section: externalLabsSectionName,
          message: `Skipped "${parsed.testName}"${
            message ? ` — ${message}` : ' — something went wrong creating the order.'
          }`,
        });
        continue;
      }
    }
  } catch (err) {
    console.error('Encountered error in applyExternalLabPlans', err);
    warnings.push({
      section: externalLabsSectionName,
      message: 'Something went wrong applying external lab orders. Skipped.',
    });
  }
  return { warnings };
}

export const fetchPlanItemsByLabGuid = async (
  parsedPlans: ParsedExternalLabPlan[],
  m2mToken: string
): Promise<Map<string, OrderableItemSearchResult[] | 'fetch-failed'>> => {
  const externalItemCodesByLabGuid = new Map<string, string[]>();
  parsedPlans.forEach((wholePlan) => {
    const labGuid = wholePlan.labGuid;
    const itemCode = wholePlan.itemCode;
    if (!labGuid || !itemCode) return;
    const currentItemCodes = externalItemCodesByLabGuid.get(labGuid) ?? [];
    externalItemCodesByLabGuid.set(labGuid, [...currentItemCodes, itemCode]);
  });

  const externalOrderableItemsByLabGuid = new Map<string, OrderableItemSearchResult[] | 'fetch-failed'>();

  await Promise.all(
    [...externalItemCodesByLabGuid.entries()].map(async ([labGuid, itemCodes]) => {
      try {
        externalOrderableItemsByLabGuid.set(labGuid, await getOrderableItems([labGuid], { itemCodes }, m2mToken));
      } catch (err) {
        console.warn(`Could not verify orderable items for lab ${labGuid}:`, err);
        externalOrderableItemsByLabGuid.set(labGuid, 'fetch-failed');
      }
    })
  );

  return externalOrderableItemsByLabGuid;
};
