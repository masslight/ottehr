import Oystehr, { BatchInputPutRequest } from '@oystehr/sdk';
import { Claim, Coverage, FhirResource, Location, Organization, Patient, Practitioner, Resource, Task } from 'fhir/r4b';
import {
  executeRule,
  FHIR_RESOURCE_NOT_FOUND,
  getResourcesFromBatchInlineRequests,
  listToRules,
  PreSubmissionRule,
  RulesEngineClaimModel,
} from 'utils';
import {
  BILLING_WORKING_COPY_TAG,
  createBillingClient,
  findPresubmissionRulesList,
  findRef,
  hasTag,
  sortClaimInsurance,
} from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { wrapTaskHandler } from '../helpers';
import { submitClaim } from './submit-claim';

// ---------------------------------------------------------------------------
// Pre-submission rules engine.
//
// Triggered by a Subscription when a `run-presubmission-rules` Task is created (status `requested`).
// The Task.focus references the working-copy Claim. The engine loads the ordered rules List, runs
// each rule against the claim's resources in order, persists the mutations, and — unless a rule
// applied the Hold tag — submits the claim.
// ---------------------------------------------------------------------------

let m2mToken: string;

export const index = wrapTaskHandler('sub-presubmission-rules-engine', async (input, _oystehr) => {
  const { task, secrets } = input;
  const claimId = extractClaimId(task);

  // Use the billing client (same as every other billing zambda) so reads/writes are scoped to the
  // billing workspace where the claim, its working copies, and the rules List live.
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  try {
    console.log(`[rules-engine] starting for Claim/${claimId}`);
    const [rules, model] = await Promise.all([loadRules(oystehr), loadClaimModel(oystehr, claimId)]);
    console.log(
      `[rules-engine] loaded ${rules.length} rule(s); patient=${model.patient?.id ?? 'none'}, ` +
        `coverages=${model.coverages.length}, renderingProvider=${model.renderingProvider?.id ?? 'none'}, ` +
        `serviceFacility=${model.serviceFacility?.id ?? 'none'}`
    );
    const unchanged = snapshotModel(model);

    let heldBy: PreSubmissionRule | undefined;
    for (const rule of rules) {
      const { held, appliedActions } = executeRule(rule, model);
      console.log(
        `[rules-engine] rule "${rule.name}" (enabled=${rule.enabled}) applied ${appliedActions.length} action(s)` +
          `${held ? ' — applied Hold, stopping' : ''}`
      );
      if (held) {
        heldBy = rule;
        break;
      }
    }

    // Persist whatever the rules changed — including the Hold tag — so the claim reflects the run.
    const written = await persistModel(oystehr, model, unchanged);
    console.log(`[rules-engine] persisted ${written} changed resource(s) for Claim/${claimId}`);

    if (heldBy) {
      console.log(`[rules-engine] Claim/${claimId} held by rule "${heldBy.name}"`);
      return {
        taskStatus: 'failed' as const,
        statusReason: `Held by rule "${heldBy.name}": claim was not submitted and requires review.`,
      };
    }

    const submission = await submitClaim({ oystehr, model, secrets });
    console.log(`[rules-engine] completed for Claim/${claimId}: ${submission.statusReason}`);
    return {
      taskStatus: 'completed' as const,
      statusReason:
        rules.length === 0
          ? 'No rules configured; claim ready to submit (submission backend not yet wired).'
          : submission.statusReason,
    };
  } catch (error) {
    // wrapTaskHandler logs the error generically and marks the Task failed; log here too so the
    // failure carries the claim context.
    console.error(`[rules-engine] failed for Claim/${claimId}:`, error);
    throw error;
  }
});

function extractClaimId(task: Task): string {
  const ref = task.focus?.reference;
  if (!ref || !ref.startsWith('Claim/')) {
    throw new Error(`Task ${task.id} focus is not a Claim reference: ${ref ?? 'none'}`);
  }
  return ref.replace('Claim/', '');
}

async function loadRules(oystehr: Oystehr): Promise<PreSubmissionRule[]> {
  const list = await findPresubmissionRulesList(oystehr);
  return list ? listToRules(list) : [];
}

// Assemble the claim plus the working-copy resources its rules can read/write.
async function loadClaimModel(oystehr: Oystehr, claimId: string): Promise<RulesEngineClaimModel> {
  const bundle = await oystehr.fhir.search<Claim>({
    resourceType: 'Claim',
    params: [
      { name: '_id', value: claimId },
      { name: '_include', value: 'Claim:patient' },
      { name: '_include', value: 'Claim:facility' },
    ],
  });
  const resources = bundle.unbundle() as Resource[];
  const claim = resources.find((r) => r.resourceType === 'Claim' && r.id === claimId) as Claim | undefined;
  if (!claim) throw FHIR_RESOURCE_NOT_FOUND('Claim');

  const patient = findRef<Patient>(resources, claim.patient?.reference);
  const serviceFacility = findRef<Location>(resources, claim.facility?.reference);

  // Coverages and the rendering provider are fetched in a follow-up batch. The focal insurance entry
  // is ordered first (claims created here keep focal at sequence 1, but focal is the authoritative
  // primary marker).
  const coverageRefs = [...sortClaimInsurance(claim)]
    .sort((a, b) => (b.focal ? 1 : 0) - (a.focal ? 1 : 0))
    .map((entry) => entry.coverage?.reference)
    .filter((ref): ref is string => !!ref && ref.startsWith('Coverage/'));
  const renderingRef = claim.careTeam?.[0]?.provider?.reference;

  const queries = coverageRefs.map((ref) => `/Coverage?_id=${ref.replace('Coverage/', '')}`);
  if (renderingRef && (renderingRef.startsWith('Practitioner/') || renderingRef.startsWith('Organization/'))) {
    const [type, id] = renderingRef.split('/');
    queries.push(`/${type}?_id=${id}`);
  }
  const followUp = queries.length ? await getResourcesFromBatchInlineRequests(oystehr, queries) : [];

  const coverages = coverageRefs
    .map((ref) => followUp.find((r) => r.resourceType === 'Coverage' && r.id === ref.replace('Coverage/', '')))
    .filter((c): c is Coverage => !!c);
  const renderingId = renderingRef?.split('/')[1];
  const renderingProvider = renderingId
    ? (followUp.find(
        (r) => r.id === renderingId && (r.resourceType === 'Practitioner' || r.resourceType === 'Organization')
      ) as Practitioner | Organization | undefined)
    : undefined;

  return { claim, patient, coverages, renderingProvider, serviceFacility };
}

type ModelResource = Claim | Patient | Coverage | Practitioner | Organization | Location;

function modelResources(model: RulesEngineClaimModel): ModelResource[] {
  return [model.claim, model.patient, ...model.coverages, model.renderingProvider, model.serviceFacility].filter(
    (r): r is ModelResource => !!r?.id
  );
}

// Serialized state of each model resource as loaded, used to write back only what a rule changed.
function snapshotModel(model: RulesEngineClaimModel): Map<string, string> {
  return new Map(modelResources(model).map((r) => [`${r.resourceType}/${r.id}`, JSON.stringify(r)]));
}

// Write back the resources a rule actually changed, in one transaction, each guarded by ifMatch so a
// concurrent edit fails the run (Task marked failed) instead of being clobbered. Returns the number
// of resources written.
async function persistModel(
  oystehr: Oystehr,
  model: RulesEngineClaimModel,
  unchanged: Map<string, string>
): Promise<number> {
  const requests: BatchInputPutRequest<FhirResource>[] = [];
  for (const resource of modelResources(model)) {
    const url = `${resource.resourceType}/${resource.id}`;
    if (unchanged.get(url) === JSON.stringify(resource)) continue;
    // The engine may only edit the claim itself and its per-claim working copies. Legacy
    // encounter-created claims can still reference a shared provider/facility — refuse to write
    // those rather than corrupt them for every other claim.
    if (
      resource.resourceType !== 'Claim' &&
      !hasTag(resource, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code)
    ) {
      console.warn(`[rules-engine] skipping write to shared (non-working-copy) resource ${url}`);
      continue;
    }
    requests.push({
      method: 'PUT',
      url,
      resource,
      ifMatch: resource.meta?.versionId ? `W/"${resource.meta.versionId}"` : undefined,
    });
  }
  if (requests.length) await oystehr.fhir.transaction({ requests });
  return requests.length;
}
