import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, List, ServiceRequest } from 'fhir/r4b';
import {
  ApplyTemplateWarning,
  chartDataTagSystem,
  DiagnosisDTO,
  ICD_10_CODE_SYSTEM,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  Secrets,
  TemplateSectionAction,
  transactionWasSuccessful,
} from 'utils';
import { makeRequestsForCreateInHouseLabs } from '../../shared/in-house-lab/build-order';
import { gatherInHouseLabOrderContext } from '../../shared/in-house-lab/gather-context';
import {
  indexLatestActivityDefinitionsByUrl,
  urlFromInstantiatesCanonical,
} from '../../shared/in-house-lab/resolve-activity-definition';

const PLAN_TAG_SYSTEM = chartDataTagSystem('in-house-lab-template-plan');

interface ApplyInHouseLabPlansInput {
  templateList: List;
  encounterId: string;
  userToken: string;
  secrets: Secrets | null;
  oystehr: Oystehr;
  action: TemplateSectionAction;
}

interface ApplyInHouseLabPlansResult {
  warnings: ApplyTemplateWarning[];
}

const labelForPlan = (plan: ServiceRequest): string => {
  return plan.code?.text ?? plan.code?.coding?.[0]?.display ?? plan.code?.coding?.[0]?.code ?? 'Unknown in-house lab';
};

// Reverse the conversion that create-in-house-lab-order does when it writes
// reasonCode from DiagnosisDTOs: each saved CodeableConcept becomes one DTO
// using the first coding's code/display. We lose `isPrimary` here, which is
// fine - the saved order doesn't carry that flag.
const diagnosesFromReasonCode = (plan: ServiceRequest): DiagnosisDTO[] => {
  return (plan.reasonCode ?? [])
    .map((rc) => {
      const icd = rc.coding?.find((c) => c.system === ICD_10_CODE_SYSTEM) ?? rc.coding?.[0];
      return {
        code: icd?.code ?? '',
        display: icd?.display ?? rc.text ?? '',
        isPrimary: false,
      };
    })
    .filter((d) => d.code || d.display);
};

const notesFromPlan = (plan: ServiceRequest): string | undefined => {
  const joined = (plan.note ?? [])
    .map((n) => n.text ?? '')
    .filter((t) => t.length > 0)
    .join('\n\n');
  return joined.length > 0 ? joined : undefined;
};

/**
 * Applies the in-house lab "plan" ServiceRequests stored in a template onto
 * the current encounter by re-running the live order-creation flow for each
 * plan. Plans whose ActivityDefinition is no longer present in this
 * environment are skipped with a warning so the rest of the template can
 * still apply.
 *
 * Returns the FHIR transaction execution result inside `warnings` so the
 * apply-template zambda can pass them back to the EHR for a snackbar.
 */
export async function applyInHouseLabPlans(input: ApplyInHouseLabPlansInput): Promise<ApplyInHouseLabPlansResult> {
  const { templateList, encounterId, userToken, secrets, oystehr, action } = input;
  if (action === 'skip') return { warnings: [] };

  const plans = (templateList.contained ?? []).filter(
    (r): r is ServiceRequest =>
      r.resourceType === 'ServiceRequest' &&
      (r as ServiceRequest).intent === 'plan' &&
      (r.meta?.tag?.some((t) => t.system === PLAN_TAG_SYSTEM) ?? false)
  );
  if (plans.length === 0) return { warnings: [] };

  // Canonical references on saved plans are version-less (newer templates) or
  // versioned (older templates). Either way we look up by url only and select
  // the latest version below using the tag, so the global template floats forward as the AD
  // gets new versions.
  const uniqueCanonicalUrls = Array.from(
    new Set(
      plans
        .flatMap((p) => p.instantiatesCanonical ?? [])
        .filter((ref): ref is string => Boolean(ref))
        .map(urlFromInstantiatesCanonical)
    )
  );

  // Context fetch and AD resolution are independent - run them in parallel.
  const [context, adResults] = await Promise.all([
    // ATHENA TODO: how is this handling patient account vs worker's comp account?
    gatherInHouseLabOrderContext({ oystehr, encounterId, userToken, secrets }),
    uniqueCanonicalUrls.length === 0
      ? Promise.resolve([] as ActivityDefinition[])
      : oystehr.fhir
          .search<ActivityDefinition>({
            resourceType: 'ActivityDefinition',
            // Match only active ADs with the latest tag
            params: [
              { name: 'url', value: uniqueCanonicalUrls.join(',') },
              { name: 'status', value: 'active' },
              // this is the correct way to find the latest version of the ad
              {
                name: 'tag',
                value: `${IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system}|${IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code}`,
              },
            ],
          })
          .then((res) => res.unbundle()),
  ]);

  const adByUrl = indexLatestActivityDefinitionsByUrl(adResults);
  console.log(
    `This is adByUrl keys/test names`,
    JSON.stringify(adByUrl.keys().map((key) => ({ key, testName: adByUrl.get(key)!.name })))
  );

  const warnings: ApplyTemplateWarning[] = [];
  const appliedActivityDefinitions: ActivityDefinition[] = [];
  const transactionRequests: ReturnType<typeof makeRequestsForCreateInHouseLabs> = [];

  for (const plan of plans) {
    // this is the canonical without the pinned version
    const canonical = plan.instantiatesCanonical?.[0];
    const ad = canonical ? adByUrl.get(urlFromInstantiatesCanonical(canonical)) : undefined;

    if (!ad || !ad.id || !ad.url) {
      warnings.push({
        section: 'inHouseLabs',
        message: `Skipped "${labelForPlan(plan)}" — the template's lab definition wasn't found in this environment.`,
      });
      continue;
    }
    if (ad.status !== 'active') {
      warnings.push({
        section: 'inHouseLabs',
        message: `Skipped "${ad.name ?? ad.title ?? labelForPlan(plan)}" — its lab definition is not active.`,
      });
      continue;
    }

    // Confirm the plan code actually carried the in-house test system, defending
    // against malformed templates.
    if (!plan.code?.coding?.some((c) => c.system === IN_HOUSE_TEST_CODE_SYSTEM)) {
      warnings.push({
        section: 'inHouseLabs',
        message: `Skipped "${labelForPlan(plan)}" — the template entry is missing the in-house test code.`,
      });
      continue;
    }

    const planRequests = makeRequestsForCreateInHouseLabs({
      diagnosesAll: diagnosesFromReasonCode(plan),
      notes: notesFromPlan(plan),
      testResources: [
        {
          activityDefinition: ad,
          initialServiceRequest: undefined, // ATHENA TODO: this suggests that repeat tests can't be ordered via templates
          orderMode: 'standard',
        },
      ],
      encounter: context.encounter,
      patient: context.patient,
      coverage: context.coverage,
      location: context.location,
      currentUserPractitionerName: context.currentUserPractitionerName,
      currentUserPractitionerId: context.currentUserPractitionerId,
      attendingPractitionerName: context.attendingPractitionerName,
      attendingPractitionerId: context.attendingPractitionerId,
      // Per product direction: the user clicking "Apply Template" is recorded
      // as the order's requester, not the visit's attending.
      requesterPractitionerId: context.currentUserPractitionerId,
    });
    transactionRequests.push(...planRequests);
    appliedActivityDefinitions.push(ad);
  }

  if (transactionRequests.length === 0) {
    return { warnings };
  }

  // One transaction across all plans - the urn:uuid fullUrls inside resolve to
  // each other so SR/Task/Provenance/Procedure references stay consistent.
  const transactionResponse = await oystehr.fhir.transaction({ requests: transactionRequests });
  if (!transactionWasSuccessful(transactionResponse)) {
    console.error(
      `Something went wrong in the create in house lab order requests: ${JSON.stringify(transactionResponse)}`
    );
    warnings.push({
      section: 'inHouseLabs',
      message: `Something went wrong applying in house labs. Skipped.`,
    });
  }

  // ATHENA TODO: we will probably want to actually return the applied activity definitions, cause that's the only way to get the updated.
  // Or maybe not since by the time this resolves, we will have already done the computations on stale plans. Need the ADs before this function
  // ever is called
  return { warnings };
}
