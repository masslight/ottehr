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
  BillingRule,
  CLAIM_TAG_SYSTEM,
  collectSetResourceRefs,
  getResourcesFromBatchInlineRequests,
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
  addErrorProvenanceForClaimSubmission,
  claimProvenanceRequest,
  claimResourceChangeRequests,
  commitClaimMetaTagsWithProvenance,
  recordedNow,
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
  const agent = await resolveClaimActor('rules', oystehr, undefined, secrets);
  const env = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  try {
    const validated = await complexValidation(oystehr, engine, claimId, env);
    return await performEffect(oystehr, validated, agent);
  } catch (error) {
    try {
      // wrapTaskHandler marks the Task failed and reports to Sentry; log here so the failure carries
      // the claim context, and make sure the claim ends up held — a failed run must never leave the
      // claim looking ready to proceed.
      console.error(`[rules-engine] ${engine} failed for Claim/${claimId}:`, error);
      const claim = await fetchById<Claim>(oystehr, 'Claim', claimId);
      await addErrorProvenanceForClaimSubmission(oystehr, claim, error as Error, agent);
      await ensureClaimHeld(oystehr, claim, agent);
    } catch (handleErrorError) {
      console.error(
        `[rules-engine] could not add error or apply Hold tag to Claim/${claimId} after failure:`,
        handleErrorError
      );
    }
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
  model.referenceResources = await loadReferenceResources(oystehr, rules);
  console.log(
    `[rules-engine] loaded ${rules.length} rule(s); patient=${model.patient?.id ?? 'none'}, ` +
      `coverages=${model.coverages.length}, renderingProvider=${model.renderingProvider?.id ?? 'none'}, ` +
      `billingProvider=${model.billingProvider?.id ?? 'none'}, ` +
      `serviceFacility=${model.serviceFacility?.id ?? 'none'}, subscribers=${model.subscribers.length}` +
      (model.referenceResources ? `, referenceResources=${model.referenceResources.size}` : '')
  );
  return { engine, claimId, rules, model };
}

// The reference resources (provider/facility page originals) named by the rule set's "set
// provider/facility from list" actions, prefetched so the synchronous writers can copy them. A
// rule referencing a resource that is missing — deleted, mistyped, or itself a working copy —
// finds no entry and fails at apply time, holding the claim rather than mis-pointing it.
async function loadReferenceResources(
  oystehr: Oystehr,
  rules: BillingRule[]
): Promise<RulesEngineClaimModel['referenceResources']> {
  const refs = new Set(
    rules.filter((rule) => rule.enabled).flatMap((rule) => collectSetResourceRefs(rule).map((r) => r.ref))
  );
  const queries: string[] = [];
  for (const ref of refs) {
    const [type, id] = ref.split('/');
    if ((type === 'Practitioner' || type === 'Organization' || type === 'Location') && id) {
      queries.push(`/${type}?_id=${id}`);
    }
  }
  if (!queries.length) return undefined;
  const resources = await getResourcesFromBatchInlineRequests(oystehr, queries);
  const map: NonNullable<RulesEngineClaimModel['referenceResources']> = new Map();
  for (const resource of resources) {
    const { resourceType } = resource;
    if (resourceType !== 'Practitioner' && resourceType !== 'Organization' && resourceType !== 'Location') continue;
    const typed = resource as Practitioner | Organization | Location;
    if (!typed.id || hasTag(typed, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code)) continue;
    map.set(`${resourceType}/${typed.id}`, typed);
  }
  return map;
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

  // A change to a resource the engine may not write (a shared resource, not a per-claim working
  // copy) can never be stored — persistModel skips it defensively. Completing the run anyway would
  // submit/advance the claim as if the change had applied, so hold it and fail instead.
  const unwritable = failure || heldBy ? [] : findUnwritableChanges(model, unchanged);
  if (unwritable.length > 0) {
    applyAction({ type: RULE_ACTION_TYPE.applyTag, tag: HOLD_TAG_NAME }, model);
  }

  // Persist whatever the rules changed — including the Hold tag — so the claim reflects the run.
  const written = await persistModel(oystehr, model, unchanged, agent);
  console.log(`[rules-engine] persisted ${written} changed resource(s) for Claim/${claimId}`);

  if (unwritable.length > 0) {
    console.log(`[rules-engine] Claim/${claimId} held: rules changed unwritable shared resource(s)`);
    return {
      taskStatus: 'failed',
      statusReason:
        `Rules changed ${unwritable.join(', ')}, which the engine cannot write (shared resources, ` +
        `not per-claim working copies). The claim was held for review.`,
    };
  }

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
export async function ensureClaimHeld(oystehr: Oystehr, claim: Claim, agent: ProvenanceAgent): Promise<void> {
  try {
    if (resourceHasTag(claim, { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME })) return;
    const updatedTags = [...(claim.meta?.tag ?? []), { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME }];
    await commitClaimMetaTagsWithProvenance(oystehr, claim, updatedTags, 'tagChange', agent);
    console.log(`[rules-engine] applied Hold tag to Claim/${claim.id} after failure`);
  } catch (holdError) {
    console.error(`[rules-engine] could not apply Hold tag to Claim/${claim.id} after failure:`, holdError);
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

// Dirty model resources the engine is not allowed to write back: anything that is neither the claim
// itself, nor a per-claim working copy, nor a copy minted by this run's writers. persistModel skips
// such writes defensively; performEffect must fail the run when any exist, or the claim would
// proceed — and possibly submit — with a silently dropped change.
export function findUnwritableChanges(model: RulesEngineClaimModel, snapshot: Map<string, ModelResource>): string[] {
  return modelResources(model)
    .filter((resource) => {
      if (resource.resourceType === 'Claim') return false;
      if (resource.id && model.createdCopyIds?.has(resource.id)) return false;
      if (hasTag(resource, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code)) return false;
      const before = snapshot.get(`${resource.resourceType}/${resource.id}`);
      return !before || JSON.stringify(before) !== JSON.stringify(resource);
    })
    .map((resource) => `${resource.resourceType}/${resource.id}`);
}

// Write back the resources a rule actually changed — each with its claim-history Provenance — in one
// transaction, guarded by ifMatch so a concurrent edit fails the run (Task marked failed) instead of
// being clobbered. Working copies minted by this run's writers (a provider/facility swap) are
// created in a preceding transaction so the claim's own diff records real references. Returns the
// number of resources written.
export async function persistModel(
  oystehr: Oystehr,
  model: RulesEngineClaimModel,
  snapshot: Map<string, ModelResource>,
  agent: ProvenanceAgent
): Promise<number> {
  const claimReference = `Claim/${model.claim.id}`;
  const createdCopies = await createPendingCopies(oystehr, model, agent, claimReference);
  const requests: BatchInputRequest<FhirResource>[] = [];
  let written = createdCopies.size;
  for (const resource of modelResources(model)) {
    // Just created with its final content — nothing further to write this run.
    if (createdCopies.has(resource)) continue;
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

// Phase 1 of persistence: POST the working copies this run's writers minted (fullUrl urn:uuid:<local
// placeholder id> so each copy's create-Provenance can target it), assign the created ids back onto
// the very objects the model holds, and rewrite the claim's temporary urn references to the real
// ids. Runs before the PUT/diff phase so the claim's history diff records real references, not
// urns. Later mutations by subsequent rules are already on the copies when they are POSTed.
async function createPendingCopies(
  oystehr: Oystehr,
  model: RulesEngineClaimModel,
  agent: ProvenanceAgent,
  claimReference: string
): Promise<Set<ModelResource>> {
  const created = new Set<ModelResource>();
  const pendingIds = model.createdCopyIds;
  if (!pendingIds?.size) return created;
  const pending = modelResources(model).filter((r) => r.id && pendingIds.has(r.id));
  if (!pending.length) return created;

  const requests: BatchInputRequest<FhirResource>[] = [];
  // Response entries are order-matched to requests, so remember where each copy's POST landed.
  const copyRequestIndex: number[] = [];
  for (const resource of pending) {
    const urn = `urn:uuid:${resource.id}`;
    const body = structuredClone(resource) as FhirResource;
    delete body.id;
    copyRequestIndex.push(requests.length);
    requests.push({ method: 'POST', url: `/${resource.resourceType}`, resource: body, fullUrl: urn });
    const provenance = claimProvenanceRequest({
      targetReference: urn,
      claimReference,
      after: resource,
      agent,
      activity: 'create',
      recorded: recordedNow(),
    });
    if (provenance) requests.push(provenance as BatchInputRequest<FhirResource>);
  }

  const txResult = await oystehr.fhir.transaction<FhirResource>({ requests });
  const entries = txResult.entry ?? [];
  pending.forEach((resource, i) => {
    const createdResource = entries[copyRequestIndex[i]]?.resource;
    if (!createdResource || createdResource.resourceType !== resource.resourceType || !createdResource.id) {
      throw new Error(`create transaction did not return the ${resource.resourceType} working copy`);
    }
    const urn = `urn:uuid:${resource.id}`;
    resource.id = createdResource.id;
    resource.meta = createdResource.meta;
    rewriteClaimReference(model.claim, urn, `${resource.resourceType}/${resource.id}`);
    created.add(resource);
  });
  return created;
}

// Replace a temporary urn reference on the claim with the created working copy's real reference.
function rewriteClaimReference(claim: Claim, urn: string, reference: string): void {
  if (claim.provider?.reference === urn) claim.provider.reference = reference;
  if (claim.facility?.reference === urn) claim.facility.reference = reference;
  for (const member of claim.careTeam ?? []) {
    if (member.provider?.reference === urn) member.provider.reference = reference;
  }
}
