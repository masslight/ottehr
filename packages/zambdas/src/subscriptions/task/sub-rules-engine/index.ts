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
  Task,
} from 'fhir/r4b';
import {
  BillingRule,
  CLAIM_TAG_SYSTEM,
  getSecret,
  HOLD_TAG_NAME,
  makeOptimisticLockIfMatchHeader,
  resourceHasTag,
  RULE_ACTION_TYPE,
  RULES_ENGINES,
  RulesEngineType,
  SecretsKeys,
} from 'utils';
import {
  claimResourceChangeRequests,
  commitClaimMetaTagsWithProvenance,
  resolveClaimActor,
} from '../../../billing/provenance';
import { RulesEngineClaimModel } from '../../../billing/rules-engine/claim-model';
import { RULES_ENGINE_TASK_SYSTEM, rulesEngineForTaskCode } from '../../../billing/rules-engine/constants';
import { applyAction, executeRule } from '../../../billing/rules-engine/evaluator';
import {
  BILLING_WORKING_COPY_TAG,
  createBillingClient,
  fetchById,
  fetchClaimGraph,
  findRulesEngineList,
  hasTag,
  listToRulesReportingMalformed,
} from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { wrapTaskHandler } from '../helpers';
import { finalizeEngineRun } from './finalize';

// ---------------------------------------------------------------------------
// Billing rules engines.
//
// One zambda serves every rules engine (Claim Submission, Non-Insurance Payer Pre-Invoice, Patient
// AR Pre-Invoice). It is triggered by a Subscription when an engine's kickoff Task is created
// (status `requested`); the Task's code identifies the engine and Task.focus references the claim.
// The engine loads its ordered rules List, runs each rule against the claim's resources in order,
// persists the mutations, and — unless a rule applied the Hold tag — performs the engine's success
// effect: Claim Submission submits the claim; the pre-invoice engines move their AR stage's status
// to Ready to invoice.
// ---------------------------------------------------------------------------

let m2mToken: string;

export const index = wrapTaskHandler('sub-rules-engine', async (input, _oystehr) => {
  const { task, secrets } = input;
  const claimId = extractClaimId(task);
  const engine = extractEngine(task);

  // Use the billing client (same as every other billing zambda) so reads/writes are scoped to the
  // billing workspace where the claim, its working copies, and the rules Lists live.
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);
  // No auth header on a subscription invocation, so this resolves to the rules-engine Device — every
  // change the engine writes lands in the claim history attributed to it.
  const agent = await resolveClaimActor(oystehr, undefined, secrets);
  const env = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  try {
    const validated = await complexValidation(oystehr, engine, claimId, env);
    return await performEffect(oystehr, validated, agent);
  } catch (error) {
    // wrapTaskHandler marks the Task failed and reports to Sentry; log here so the failure carries
    // the claim context, and make sure the claim ends up held — a failed run must never leave the
    // claim looking ready to proceed.
    console.error(`[rules-engine] ${engine} failed for Claim/${claimId}:`, error);
    await ensureClaimHeld(oystehr, claimId, agent);
    throw error;
  }
});

export interface ValidatedRulesRun {
  engine: RulesEngineType;
  claimId: string;
  rules: BillingRule[];
  model: RulesEngineClaimModel;
}

export async function complexValidation(
  oystehr: Oystehr,
  engine: RulesEngineType,
  claimId: string,
  env: string
): Promise<ValidatedRulesRun> {
  console.log(`[rules-engine] ${engine} starting for Claim/${claimId}`);
  const [rules, model] = await Promise.all([loadRules(oystehr, engine, env), loadClaimModel(oystehr, claimId)]);
  console.log(
    `[rules-engine] loaded ${rules.length} rule(s); patient=${model.patient?.id ?? 'none'}, ` +
      `coverages=${model.coverages.length}, renderingProvider=${model.renderingProvider?.id ?? 'none'}, ` +
      `serviceFacility=${model.serviceFacility?.id ?? 'none'}`
  );
  return { engine, claimId, rules, model };
}

export async function performEffect(
  oystehr: Oystehr,
  { engine, claimId, rules, model }: ValidatedRulesRun,
  agent: ProvenanceAgent
): Promise<{ taskStatus: Task['status']; statusReason: string }> {
  const unchanged = snapshotModel(model);

  let heldBy: BillingRule | undefined;
  let failure: { rule: BillingRule; error: string } | undefined;
  for (const rule of rules) {
    const { held, appliedActions, error } = executeRule(rule, model);
    console.log(
      `[rules-engine] rule "${rule.name}" (enabled=${rule.enabled}) applied ${appliedActions.length} action(s)` +
        `${held ? ' — applied Hold, stopping' : ''}${error ? ` — failed: ${error}` : ''}`
    );
    if (error) {
      // A rule whose action can't be applied must not fail quietly — the claim would proceed with
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
      statusReason: `Held by rule "${heldBy.name}": ${RULES_ENGINES[engine].label} did not complete and the claim requires review.`,
    };
  }

  const finalized = await finalizeEngineRun(engine, { oystehr, model, agent });
  console.log(`[rules-engine] ${engine} completed for Claim/${claimId}: ${finalized.statusReason}`);
  return { taskStatus: 'completed', statusReason: finalized.statusReason };
}

// Backstop for the catch path: whatever went wrong (load, persist, finalize), the claim must end
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

// The engine a kickoff Task belongs to, from its code (each engine's Subscription matches one code).
export function extractEngine(task: Task): RulesEngineType {
  const code = task.code?.coding?.find((c) => c.system === RULES_ENGINE_TASK_SYSTEM)?.code;
  const engine = rulesEngineForTaskCode(code);
  if (!engine) {
    throw new Error(`Task ${task.id} does not carry a known rules-engine code: ${code ?? 'none'}`);
  }
  return engine;
}

async function loadRules(oystehr: Oystehr, engine: RulesEngineType, env: string): Promise<BillingRule[]> {
  const list = await findRulesEngineList(oystehr, engine);
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
    serviceFacility: graph.serviceFacility,
  };
}

type ModelResource = Claim | Patient | Coverage | Practitioner | Organization | Location;

function modelResources(model: RulesEngineClaimModel): ModelResource[] {
  return [model.claim, model.patient, ...model.coverages, model.renderingProvider, model.serviceFacility].filter(
    (r): r is ModelResource => !!r?.id
  );
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
