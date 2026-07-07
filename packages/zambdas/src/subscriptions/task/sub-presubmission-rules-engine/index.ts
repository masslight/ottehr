import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import {
  Claim,
  Coverage,
  FhirResource,
  Location,
  Organization,
  Patient,
  Practitioner,
  ProvenanceAgent,
  Resource,
  Task,
} from 'fhir/r4b';
import {
  executeRule,
  FHIR_RESOURCE_NOT_FOUND,
  getResourcesFromBatchInlineRequests,
  listToRules,
  makeOptimisticLockIfMatchHeader,
  PreSubmissionRule,
  RulesEngineClaimModel,
} from 'utils';
import {
  claimProvenanceRequest,
  recordedNow,
  resolveClaimActor,
  versionedReference,
} from '../../../billing/provenance';
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
  // No auth header on a subscription invocation, so this resolves to the rules-engine Device — every
  // change the engine writes lands in the claim history attributed to it.
  const agent = await resolveClaimActor(oystehr, undefined, secrets);

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
    const written = await persistModel(oystehr, model, unchanged, agent);
    console.log(`[rules-engine] persisted ${written} changed resource(s) for Claim/${claimId}`);

    if (heldBy) {
      console.log(`[rules-engine] Claim/${claimId} held by rule "${heldBy.name}"`);
      return {
        taskStatus: 'failed' as const,
        statusReason: `Held by rule "${heldBy.name}": claim was not submitted and requires review.`,
      };
    }

    const submission = await submitClaim({ oystehr, model, agent });
    console.log(`[rules-engine] completed for Claim/${claimId}: ${submission.statusReason}`);
    return {
      taskStatus: 'completed' as const,
      statusReason: submission.statusReason,
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

// Deep-cloned state of each model resource as loaded: the dirty check compares against it, and it is
// the `before` of each change's history record.
function snapshotModel(model: RulesEngineClaimModel): Map<string, ModelResource> {
  return new Map(modelResources(model).map((r) => [`${r.resourceType}/${r.id}`, structuredClone(r)]));
}

// Write back the resources a rule actually changed — each with its claim-history Provenance — in one
// transaction, guarded by ifMatch so a concurrent edit fails the run (Task marked failed) instead of
// being clobbered. Returns the number of resources written.
async function persistModel(
  oystehr: Oystehr,
  model: RulesEngineClaimModel,
  snapshot: Map<string, ModelResource>,
  agent: ProvenanceAgent
): Promise<number> {
  const claimReference = `Claim/${model.claim.id}`;
  const requests: BatchInputRequest<FhirResource>[] = [];
  let written = 0;
  for (const resource of modelResources(model)) {
    const url = `${resource.resourceType}/${resource.id}`;
    const before = snapshot.get(url);
    if (before && JSON.stringify(before) === JSON.stringify(resource)) continue;
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
    requests.push({ method: 'PUT', url, resource, ifMatch: makeOptimisticLockIfMatchHeader(resource) });
    written += 1;
    const provenance = claimProvenanceRequest({
      targetReference: url,
      claimReference,
      before,
      after: resource,
      agent,
      activity: 'update',
      recorded: recordedNow(),
      priorVersionReference: versionedReference(before),
    });
    if (provenance) requests.push(provenance as BatchInputRequest<FhirResource>);
  }
  if (requests.length) await oystehr.fhir.transaction({ requests });
  return written;
}
