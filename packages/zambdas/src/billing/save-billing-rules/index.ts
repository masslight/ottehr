import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Basic, List } from 'fhir/r4b';
import {
  BillingRule,
  BillingRulesResponse,
  collectApplyTagNames,
  getSecret,
  HOLD_TAG_NAME,
  INVALID_INPUT_ERROR,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { HOLD_TAG_DESCRIPTION } from '../rules-engine/constants';
import { rulesToList } from '../rules-engine/serialization';
import {
  createBillingClient,
  fetchDefinedTagNames,
  findRulesEngineList,
  listToRulesReportingMalformed,
  TAG_CODE_SYSTEM,
  TAG_DESCRIPTION_URL,
  TAG_IS_SYSTEM_TAG_URL,
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
  ]);
  return existing;
}

// Every tag a rule applies must exist in the tags feature, so the rule builder's tag dropdown and
// API-created rules obey the same contract. Hold is exempt: it is built into the engine and may not
// be seeded as a stored tag yet (that only happens when an engine's first rules List is created).
// Runs at most one Basic search, and none when no rule applies a non-Hold tag.
async function validateAppliedTagsExist(oystehr: Oystehr, rules: SaveBillingRulesParams['rules']): Promise<void> {
  const perRule = rules
    .map((rule) => ({
      name: rule.name,
      tags: collectApplyTagNames(rule).filter((tag) => tag !== HOLD_TAG_NAME),
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
    // Seed the Hold system tag definition the first time rules are configured.
    await ensureHoldTag(oystehr);
  }

  return { rules: await listToRulesReportingMalformed(saved, env), versionId: saved.meta?.versionId };
}

// Best-effort: create the Hold system tag definition if it doesn't already exist. Never fails the save.
async function ensureHoldTag(oystehr: Oystehr): Promise<void> {
  try {
    const result = await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        { name: 'code', value: `${TAG_CODE_SYSTEM}|tag` },
        { name: '_count', value: '200' },
      ],
    });
    if (result.unbundle().some((b) => b.code?.text === HOLD_TAG_NAME)) return;

    const tag: Basic = {
      resourceType: 'Basic',
      code: { text: HOLD_TAG_NAME, coding: [{ system: TAG_CODE_SYSTEM, code: 'tag' }] },
      extension: [
        { url: TAG_DESCRIPTION_URL, valueString: HOLD_TAG_DESCRIPTION },
        { url: TAG_IS_SYSTEM_TAG_URL, valueBoolean: true },
      ],
    };
    await oystehr.fhir.create<Basic>(tag);
  } catch (error) {
    console.error('Failed to ensure Hold system tag exists:', error);
  }
}
