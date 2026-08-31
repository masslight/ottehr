import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { List, Resource } from 'fhir/r4b';
import { getResourcesFromBatchInlineRequests } from 'utils/lib/fhir/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import {
  collectApplyTagNames,
  collectSetResourceRefs,
  getRuleFieldDef,
} from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import { BillingRule, BillingRulesResponse } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { isSystemManagedTagName } from 'utils/lib/types/data/billing/system-tags';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { rulesToList } from '../rules-engine/serialization';
import {
  BILLING_WORKING_COPY_TAG,
  createBillingClient,
  ensureSystemManagedTags,
  fetchDefinedTagNames,
  findRulesEngineList,
  hasTag,
  listToRulesReportingMalformed,
  PROVIDER_ROLE_TAG,
} from '../shared';
import { SaveBillingRulesParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-rules';

// Saves the full ordered rule set as the engine's singleton rules List (create/edit/reorder/delete
// all in one atomic write). Echoes back the saved rules + new versionId.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const existing = await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params, existing, getSecret(SecretsKeys.ENVIRONMENT, params.secrets));
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function complexValidation(oystehr: Oystehr, params: SaveBillingRulesParams): Promise<List | undefined> {
  const [existing] = await Promise.all([
    findRulesEngineList(oystehr, params.engine),
    validateAppliedTagsExist(oystehr, params.rules),
    validateReferencedResourcesExist(oystehr, params.rules),
  ]);
  return existing;
}

// Every tag a rule applies must exist in the tags feature, so the rule builder's tag dropdown and
// API-created rules obey the same contract. System-managed tags (Hold, Auto Accident, …) are
// exempt: they are built into the system and may not be seeded as stored tags yet (that only
// happens when an engine's first rules List is created). Runs at most one Basic search, and none
// when no rule applies a non-system tag.
async function validateAppliedTagsExist(oystehr: Oystehr, rules: SaveBillingRulesParams['rules']): Promise<void> {
  const perRule = rules
    .map((rule) => ({
      name: rule.name,
      tags: collectApplyTagNames(rule).filter((tag) => !isSystemManagedTagName(tag)),
    }))
    .filter((entry) => entry.tags.length > 0);
  if (perRule.length === 0) return;

  const defined = await fetchDefinedTagNames(oystehr);
  const problems = perRule.flatMap((entry) =>
    entry.tags
      .filter((tag) => !defined.has(tag))
      .map((tag) => `rule "${entry.name}" applies unknown tag "${tag}" — create it on the Tags page first`)
  );
  if (problems.length > 0) throw INVALID_INPUT_ERROR(problems.join('; '));
}

// Every provider/facility reference a rule assigns must point at an existing reference resource —
// the shared kind managed on the provider/facility pages, never a per-claim working copy — and a
// provider must carry the role the field targets. One batched fetch covers all distinct refs, and
// none runs when no rule sets a provider/facility. The engine re-checks at apply time (a resource
// deleted after save fails the rule and holds the claim).
async function validateReferencedResourcesExist(
  oystehr: Oystehr,
  rules: SaveBillingRulesParams['rules']
): Promise<void> {
  const perRule = rules
    .map((rule) => ({ name: rule.name, refs: collectSetResourceRefs(rule) }))
    .filter((entry) => entry.refs.length > 0);
  if (perRule.length === 0) return;

  const distinct = [...new Set(perRule.flatMap((entry) => entry.refs.map((r) => r.ref)))];
  const queries = distinct.map((ref) => {
    const [type, id] = ref.split('/');
    return `/${type}?_id=${id}`;
  });
  const resources = await getResourcesFromBatchInlineRequests(oystehr, queries);
  const byRef = new Map(resources.filter((r) => r.id).map((r) => [`${r.resourceType}/${r.id}`, r]));

  const problems = perRule.flatMap((entry) =>
    entry.refs
      .map(({ field, ref }) => ({ ref, field, problem: referencedResourceProblem(byRef.get(ref), field) }))
      .filter((item) => item.problem)
      .map((item) => `rule "${entry.name}" sets "${item.field}" to ${item.ref} — ${item.problem}`)
  );
  if (problems.length > 0) throw INVALID_INPUT_ERROR(problems.join('; '));
}

function referencedResourceProblem(resource: Resource | undefined, field: string): string | undefined {
  if (!resource) return 'no such resource exists';
  if (hasTag(resource, BILLING_WORKING_COPY_TAG.system, BILLING_WORKING_COPY_TAG.code)) {
    return 'it is a per-claim working copy — pick a resource from the reference lists';
  }
  const role = getRuleFieldDef(field)?.providerRole;
  if (role && !hasTag(resource, PROVIDER_ROLE_TAG, role)) return `it is not tagged as a ${role} provider`;
  return undefined;
}

export async function performEffect(
  oystehr: Oystehr,
  params: SaveBillingRulesParams,
  existing: List | undefined,
  env: string
): Promise<BillingRulesResponse> {
  // The backend owns rule identifiers: rules arriving without an id (newly created) get one here.
  const rules: BillingRule[] = params.rules.map((rule) => ({ ...rule, id: rule.id ?? randomUUID() }));
  const newList = rulesToList(params.engine, rules);

  let saved: List;
  if (existing?.id) {
    newList.id = existing.id;
    saved = await oystehr.fhir.update<List>(
      newList,
      params.expectedVersionId ? { optimisticLockingVersionId: params.expectedVersionId } : undefined
    );
  } else {
    saved = await oystehr.fhir.create<List>(newList);
    try {
      await ensureSystemManagedTags(oystehr);
    } catch (error) {
      console.error('Failed to ensure system-managed tags exist:', error);
    }
  }

  return { rules: await listToRulesReportingMalformed(saved, env), versionId: saved.meta?.versionId };
}
