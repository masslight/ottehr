import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Basic, List } from 'fhir/r4b';
import { BillingRulesResponse, HOLD_TAG_DESCRIPTION, HOLD_TAG_NAME, listToRules, rulesToList } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import {
  createBillingClient,
  findPresubmissionRulesList,
  TAG_CODE_SYSTEM,
  TAG_DESCRIPTION_URL,
  TAG_IS_SYSTEM_TAG_URL,
} from '../shared';
import { SaveBillingRulesParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-rules';

// Saves the full ordered rule set as the singleton rules List (create/edit/reorder/delete all in one
// atomic write). Echoes back the saved rules + new versionId.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

async function performEffect(oystehr: Oystehr, params: SaveBillingRulesParams): Promise<BillingRulesResponse> {
  const existing = await findPresubmissionRulesList(oystehr);
  const newList = rulesToList(params.rules);

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

  return { rules: listToRules(saved), versionId: saved.meta?.versionId };
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
