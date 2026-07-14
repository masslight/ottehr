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
  RelatedPerson,
  Task,
} from 'fhir/r4b';
import {
  CLAIM_TAG_SYSTEM,
  getSecret,
  HOLD_TAG_NAME,
  makeOptimisticLockIfMatchHeader,
  PreSubmissionRule,
  resourceHasTag,
  RULE_ACTION_TYPE,
  SecretsKeys,
} from 'utils';
import {
  claimResourceChangeRequests,
  commitClaimMetaTagsWithProvenance,
  resolveClaimActor,
} from '../../../billing/provenance';
import { RulesEngineClaimModel } from '../../../billing/rules-engine/claim-model';
import { applyAction, executeRule } from '../../../billing/rules-engine/evaluator';
import {
  BILLING_WORKING_COPY_TAG,
  createBillingClient,
  fetchById,
  fetchClaimGraph,
  findPresubmissionRulesList,
  hasTag,
  listToRulesReportingMalformed,
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
  const env = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  try {
    const validated = await complexValidation(oystehr, claimId, env);
    return await performEffect(oystehr, validated, agent);
  } catch (error) {
    // wrapTaskHandler marks the Task failed and reports to Sentry; log here so the failure carries
    // the claim context, and make sure the claim ends up held — a failed run must never leave the
    // claim looking submittable.
    console.error(`[rules-engine] failed for Claim/${claimId}:`, error);
    await ensureClaimHeld(oystehr, claimId, agent);
    throw error;
  }
});

export interface ValidatedRulesRun {
  claimId: string;
  rules: PreSubmissionRule[];
  model: RulesEngineClaimModel;
}

export async function complexValidation(oystehr: Oystehr, claimId: string, env: string): Promise<ValidatedRulesRun> {
  console.log(`[rules-engine] starting for Claim/${claimId}`);
  const [rules, model] = await Promise.all([loadRules(oystehr, env), loadClaimModel(oystehr, claimId)]);
  console.log(
    `[rules-engine] loaded ${rules.length} rule(s); patient=${model.patient?.id ?? 'none'}, ` +
      `coverages=${model.coverages.length}, renderingProvider=${model.renderingProvider?.id ?? 'none'}, ` +
      `billingProvider=${model.billingProvider?.id ?? 'none'}, ` +
      `serviceFacility=${model.serviceFacility?.id ?? 'none'}, subscribers=${model.subscribers.length}`
  );
  return { claimId, rules, model };
}

export async function performEffect(
  oystehr: Oystehr,
  { claimId, rules, model }: ValidatedRulesRun,
  agent: ProvenanceAgent
): Promise<{ taskStatus: Task['status']; statusReason: string }> {
  const unchanged = snapshotModel(model);

  let heldBy: PreSubmissionRule | undefined;
  let failure: { rule: PreSubmissionRule; error: string } | undefined;
  for (const rule of rules) {
    const { held, appliedActions, error } = executeRule(rule, model);
    console.log(
      `[rules-engine] rule "${rule.name}" (enabled=${rule.enabled}) applied ${appliedActions.length} action(s)` +
        `${held ? ' — applied Hold, stopping' : ''}${error ? ` — failed: ${error}` : ''}`
    );
    if (error) {
      // A rule whose action can't be applied must not fail quietly — the claim would submit with
      // the wrong data. Hold it and stop the run.
      failure = { rule, error };
      applyAction({ type: RULE_ACTION_TYPE.applyTag, tag: HOLD_TAG_NAME }, model);
      break;
    }
    if (held) {
      heldBy = rule;
      break;
    }
  }

  // Persist whatever the rules changed — including the Hold tag — so the claim reflects the run.
  const written = await persistModel(oystehr, model, unchanged, agent);
  console.log(`[rules-engine] persisted ${written} changed resource(s) for Claim/${claimId}`);

  if (failure) {
    console.log(`[rules-engine] Claim/${claimId} held after rule "${failure.rule.name}" failed`);
    return {
      taskStatus: 'failed',
      statusReason: `Rule "${failure.rule.name}" failed: ${failure.error}. The claim was held for review.`,
    };
  }

  if (heldBy) {
    console.log(`[rules-engine] Claim/${claimId} held by rule "${heldBy.name}"`);
    return {
      taskStatus: 'failed',
      statusReason: `Held by rule "${heldBy.name}": claim was not submitted and requires review.`,
    };
  }

  const submission = await submitClaim({ oystehr, model, agent });
  console.log(`[rules-engine] completed for Claim/${claimId}: ${submission.statusReason}`);
  return { taskStatus: 'completed', statusReason: submission.statusReason };
}

// Backstop for the catch path: whatever went wrong (load, persist, submission), the claim must end
// up carrying the Hold tag so the failure is visible on the claim itself, not just the Task. Never
// throws — the original error is the one that matters.
export async function ensureClaimHeld(oystehr: Oystehr, claimId: string, agent: ProvenanceAgent): Promise<void> {
  try {
    const claim = await fetchById<Claim>(oystehr, 'Claim', claimId);
    if (resourceHasTag(claim, { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME })) return;
    const updatedTags = [...(claim.meta?.tag ?? []), { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME }];
    await commitClaimMetaTagsWithProvenance(oystehr, claim, updatedTags, 'tagChange', agent);
    console.log(`[rules-engine] applied Hold tag to Claim/${claimId} after failure`);
  } catch (holdError) {
    console.error(`[rules-engine] could not apply Hold tag to Claim/${claimId} after failure:`, holdError);
  }
}

function extractClaimId(task: Task): string {
  const ref = task.focus?.reference;
  if (!ref || !ref.startsWith('Claim/')) {
    throw new Error(`Task ${task.id} focus is not a Claim reference: ${ref ?? 'none'}`);
  }
  return ref.replace('Claim/', '');
}

async function loadRules(oystehr: Oystehr, env: string): Promise<PreSubmissionRule[]> {
  const list = await findPresubmissionRulesList(oystehr);
  return list ? listToRulesReportingMalformed(list, env) : [];
}

// The rules' view of the claim: the shared claim graph narrowed to the resources rules can read/write.
async function loadClaimModel(oystehr: Oystehr, claimId: string): Promise<RulesEngineClaimModel> {
  const graph = await fetchClaimGraph(oystehr, claimId);
  return {
    claim: graph.claim,
    patient: graph.patient,
    coverages: graph.coverages,
    renderingProvider: graph.renderingProvider,
    billingProvider: graph.billingProvider,
    serviceFacility: graph.serviceFacility,
    subscribers: graph.subscribers,
  };
}

type ModelResource = Claim | Patient | Coverage | Practitioner | Organization | Location | RelatedPerson;

function modelResources(model: RulesEngineClaimModel): ModelResource[] {
  return [
    model.claim,
    model.patient,
    ...model.coverages,
    model.renderingProvider,
    model.billingProvider,
    model.serviceFacility,
    ...model.subscribers,
  ].filter((r): r is ModelResource => !!r?.id);
}

// Deep-cloned state of each model resource as loaded: the dirty check compares against it, and it is
// the `before` of each change's history record.
export function snapshotModel(model: RulesEngineClaimModel): Map<string, ModelResource> {
  return new Map(modelResources(model).map((r) => [`${r.resourceType}/${r.id}`, structuredClone(r)]));
}

// Write back the resources a rule actually changed — each with its claim-history Provenance — in one
// transaction, guarded by ifMatch so a concurrent edit fails the run (Task marked failed) instead of
// being clobbered. Returns the number of resources written.
export async function persistModel(
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
    // Safety guard: the engine only ever edits the claim itself and its per-claim working copies.
    // Should a claim ever reference a shared (non-working-copy) resource, skip the write rather
    // than mutate a record other claims may share.
    if (
      resource.resourceType !== 'Claim' &&
      !hasTag(resource, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code)
    ) {
      console.warn(`[rules-engine] skipping write to shared (non-working-copy) resource ${url}`);
      continue;
    }
    requests.push(
      ...claimResourceChangeRequests({
        resource,
        before,
        agent,
        claimReference,
        ifMatch: makeOptimisticLockIfMatchHeader(resource),
      })
    );
    written += 1;
  }
  if (requests.length) await oystehr.fhir.transaction({ requests });
  return written;
}
