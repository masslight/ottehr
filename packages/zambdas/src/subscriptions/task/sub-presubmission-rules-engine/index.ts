import Oystehr, { BatchInputPutRequest } from '@oystehr/sdk';
import {
  Claim,
  Coverage,
  FhirResource,
  List,
  Location,
  Organization,
  Patient,
  Practitioner,
  Resource,
  Task,
} from 'fhir/r4b';
import {
  executeRule,
  FHIR_RESOURCE_NOT_FOUND,
  getResourcesFromBatchInlineRequests,
  listToRules,
  PRESUBMISSION_RULES_LIST_CODE,
  PreSubmissionRule,
  RULES_ENGINE_TAG_SYSTEM,
  RulesEngineClaimModel,
} from 'utils';
import { createBillingClient, findRef, sortClaimInsurance } from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { wrapTaskHandler } from '../helpers';
import { submitClaim } from './submit-claim';

// ---------------------------------------------------------------------------
// Pre-submission rules engine.
//
// Triggered by a Subscription when a `run-presubmission-rules` Task is created (status `requested`).
// The Task.focus references the working-copy Claim. The engine loads the ordered rules List, runs
// each rule against the claim's resources in order, persists the mutations, and — unless a rule
// applied the Hold tag — submits the claim. wrapTaskHandler marks the Task in-progress on entry, then
// `completed`/`failed` from the returned taskStatus (and `failed` automatically on any thrown error).
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
    console.log(`[rules-engine] persisting changes for Claim/${claimId}`);
    await persistModel(oystehr, model);

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
    // wrapTaskHandler routes handler errors to Sentry + the Task statusReason but does NOT log them to
    // CloudWatch — log here so failures are visible, then rethrow so the Task is still marked failed.
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

// Load the singleton ordered rules List and deserialize it into rules (in run order). Missing list
// (none configured yet) yields no rules.
async function loadRules(oystehr: Oystehr): Promise<PreSubmissionRule[]> {
  const result = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: '_tag', value: `${RULES_ENGINE_TAG_SYSTEM}|${PRESUBMISSION_RULES_LIST_CODE}` }],
  });
  const list = result.unbundle()[0];
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

  // Coverages (sorted primary-first) and the rendering provider are fetched in a follow-up batch.
  const coverageRefs = sortClaimInsurance(claim)
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

// Write back every loaded resource that has an id in one transaction (atomic). The full resources are
// PUT with their existing meta.tag, so workspace/billing tags are preserved.
async function persistModel(oystehr: Oystehr, model: RulesEngineClaimModel): Promise<void> {
  const requests: BatchInputPutRequest<FhirResource>[] = [];
  const put = (resource: FhirResource | undefined): void => {
    if (resource?.id) requests.push({ method: 'PUT', url: `${resource.resourceType}/${resource.id}`, resource });
  };
  put(model.claim);
  put(model.patient);
  model.coverages.forEach(put);
  put(model.renderingProvider);
  put(model.serviceFacility);
  if (requests.length) await oystehr.fhir.transaction({ requests });
}
