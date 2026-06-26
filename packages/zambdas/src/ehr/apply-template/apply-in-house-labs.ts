import Oystehr from '@oystehr/sdk';
import { ActivityDefinition, FhirResource, List, ServiceRequest } from 'fhir/r4b';
import {
  chartDataTagSystem,
  getTag,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  resourceHasTagSystem,
  Secrets,
  TemplateSectionAction,
  TemplateWarning,
  transactionWasSuccessful,
} from 'utils';
import { makeRequestsForCreateInHouseLabs } from '../../shared/in-house-lab/build-order';
import { gatherInHouseLabOrderContext } from '../../shared/in-house-lab/gather-context';
import { TemplateEncounterResource } from '../shared/template-helpers';
import { diagnosesFromReasonCode, noteFromPlan } from './helpers';

interface ApplyInHouseLabPlansInput {
  templateList: List;
  encounterId: string;
  userToken: string;
  secrets: Secrets | null;
  oystehr: Oystehr;
  action: TemplateSectionAction;
  activityDefinitions: ActivityDefinition[];
  encounterResources: TemplateEncounterResource[];
}

interface ApplyInHouseLabPlansResult {
  warnings: TemplateWarning[];
}

const labelForPlan = (plan: ServiceRequest): string => {
  return plan.code?.text ?? plan.code?.coding?.[0]?.display ?? plan.code?.coding?.[0]?.code ?? 'Unknown in-house lab';
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
  const warnings: TemplateWarning[] = [];
  try {
    const { templateList, encounterId, userToken, secrets, oystehr, action, activityDefinitions, encounterResources } =
      input;
    if (action === 'skip') return { warnings: [] };

    const plans = (templateList.contained ?? []).filter((r): r is ServiceRequest => isInHouseLabPlanServiceRequest(r));
    if (plans.length === 0) return { warnings: [] };

    const context = await gatherInHouseLabOrderContext({
      oystehr,
      encounterId,
      encounterResources: encounterResources,
      userToken,
      secrets,
    });

    const adByUrl = indexLatestActivityDefinitionsByUrl(activityDefinitions);
    console.log(
      `This is adByUrl keys/test names/AD id`,
      JSON.stringify(
        adByUrl.keys().map((key) => {
          const ad = adByUrl.get(key)!;
          return { key, testName: ad.name, adId: ad.id };
        })
      )
    );

    const transactionRequests: ReturnType<typeof makeRequestsForCreateInHouseLabs> = [];

    for (const plan of plans) {
      // this call is a bit redundant, since all of the ads we get back from getLatestInHouseLabActivityDefinitionsForTemplatePlan
      // are should be apply-able already based on the fhir calls. But we do it for the warnings
      // this is the canonical without the pinned version
      const canonical = plan.instantiatesCanonical?.[0];
      const ad = canonical ? adByUrl.get(urlFromInstantiatesCanonical(canonical)) : undefined;

      // Confirm the plan code actually carried the in-house test system, defending
      // against malformed templates.
      if (!isInHouseLabPlanServiceRequest(plan)) {
        warnings.push({
          section: 'inHouseLabs',
          message: `Skipped "${labelForPlan(plan)}" — the template entry is missing the in-house test code or tag.`,
        });
        continue;
      }

      const { isActive, isValid } = canApplyActivityDefinition(ad);
      if (!isValid) {
        warnings.push({
          section: 'inHouseLabs',
          message: `Skipped "${labelForPlan(plan)}" — the template's lab definition wasn't found in this environment.`,
        });
        continue;
      }

      // this shouldn't ever happen since our fhir request checks for active ADs to begin with
      if (!isActive) {
        warnings.push({
          section: 'inHouseLabs',
          message: `Skipped "${ad?.name ?? ad?.title ?? labelForPlan(plan)}" — its lab definition is not active.`,
        });
        continue;
      }

      const planRequests = makeRequestsForCreateInHouseLabs({
        diagnosesAll: diagnosesFromReasonCode(plan),
        notes: noteFromPlan(plan),
        testResources: [
          {
            activityDefinition: ad!, // the canApply checks make sure this isn't undefined, so this is safe
            initialServiceRequest: undefined, // note: repeat tests and reflex can't be ordered via templates
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
        message: `Something went wrong applying in house labs transaction. Skipped.`,
      });
    }
  } catch (err) {
    console.error('Encountered error in applyInHouseLabPlans', err);
    warnings.push({
      section: 'inHouseLabs',
      message: `Something went wrong applying in house labs. Skipped.`,
    });
  }
  return { warnings };
}

/**
 * Ensure the AD is for in house labs and is latest based on tag
 * Returns a Map keyed by ad.url -> the latest-version AD for that url.
 */
export const indexLatestActivityDefinitionsByUrl = (ads: ActivityDefinition[]): Map<string, ActivityDefinition> => {
  const adByUrl = new Map<string, ActivityDefinition>();
  ads.forEach((ad) => {
    if (
      ad.url &&
      !!getTag(ad, IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system, IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code) &&
      !!getTag(ad, IN_HOUSE_TAG_DEFINITION.system, IN_HOUSE_TAG_DEFINITION.code)
    ) {
      adByUrl.set(ad.url, ad);
    }
  });
  return adByUrl;
};

/**
 * A canonical reference saved on a plan ServiceRequest may be either a bare
 * url ("https://...") or include a version ("https://...|1.2.3"). Newer
 * templates save the bare url so resolution can float to the latest AD; older
 * templates may still carry a versioned ref. Either way we look up by the url
 * part - the version segment is ignored.
 */
export const urlFromInstantiatesCanonical = (ref: string): string => ref.split('|')[0];

export const isInHouseLabPlanServiceRequest = (maybePlan: FhirResource): maybePlan is ServiceRequest => {
  if (maybePlan.resourceType !== 'ServiceRequest') return false;
  return (
    maybePlan.intent === 'plan' && resourceHasTagSystem(maybePlan, chartDataTagSystem('in-house-lab-template-plan'))
  );
};

/**
 * Grabs the latest versions of the ActivityDefinitions referenced on the serviceRequest Plans on the template list.
 * Does not check if we were unable to find some ADs for the expected plans or if all of those AD's are "apply-able"
 * @param oystehr
 * @param templateList
 * @returns
 */
export const getLatestInHouseLabActivityDefinitionsForTemplatePlan = async (
  oystehr: Oystehr,
  templateList: List
): Promise<ActivityDefinition[]> => {
  const plans = (templateList.contained ?? []).filter((r): r is ServiceRequest => isInHouseLabPlanServiceRequest(r));
  if (plans.length === 0) return [];

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

  if (!uniqueCanonicalUrls.length) return [];

  const activityDefinitions = await oystehr.fhir
    .search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      // Match only active ADs with the latest tag
      params: [
        { name: 'url', value: uniqueCanonicalUrls.join(',') },
        { name: 'status', value: 'active' },
        // this is the correct way to find the latest version of the ad
        {
          name: '_tag',
          value: `${IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system}|${IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code}`,
        },
      ],
    })
    .then((res) => res.unbundle());

  if (uniqueCanonicalUrls.length !== activityDefinitions.length) {
    console.warn(
      `Expected objects do not match between canonical urls and returned ADs. uniqueCanonicalUrls: ${uniqueCanonicalUrls.length}. ADs: ${activityDefinitions.length}`,
      JSON.stringify(
        uniqueCanonicalUrls.map((url) => ({
          expectedUrl: url,
          foundAd: activityDefinitions.find((ad) => ad.url === url)?.id,
        }))
      )
    );
  } else {
    console.log('Found expected number of ActivityDefinitions for uniqueCanonicalUrls');
  }

  // we do not filter to only apply-able ADs here so we can present toasts to the users later
  return activityDefinitions;
};

export const canApplyActivityDefinition = (
  ad: ActivityDefinition | undefined
): { isActive: boolean; isValid: boolean; canApply: boolean } => {
  const isValid =
    !!ad && !!ad.id && !!ad.url && !!ad.code?.coding?.some((coding) => coding.system === IN_HOUSE_TEST_CODE_SYSTEM);
  const isActive = !!ad && ad.status === 'active';
  return { isActive, isValid, canApply: isValid && isActive };
};
