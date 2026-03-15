import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';
import {
  getSecret,
  QuickPickCreateResponse,
  QuickPickListResponse,
  QuickPickRemoveResponse,
  QuickPickUpdateResponse,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  createQuickPick,
  QuickPickCategory,
  removeQuickPick,
  searchQuickPicks,
  updateQuickPick,
} from './quick-pick-helpers';

let m2mToken: string;

function makeHandler(
  zambdaName: string,
  effect: (oystehr: Oystehr, input: ZambdaInput) => Promise<unknown>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return wrapHandler(zambdaName, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      if (!input.secrets) {
        throw new Error('No secrets provided in input');
      }
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
      const oystehr = createOystehrClient(m2mToken, input.secrets);
      const response = await effect(oystehr, input);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      console.error('Error: ' + error);
      return topLevelCatch(zambdaName, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
    }
  });
}

export function makeGetHandler<T extends { id?: string }>(
  zambdaName: string,
  category: QuickPickCategory<T>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return makeHandler(zambdaName, async (oystehr): Promise<QuickPickListResponse<T>> => {
    const quickPicks = await searchQuickPicks(oystehr, category);
    return { message: `Found ${quickPicks.length} quick picks`, quickPicks };
  });
}

export function makeCreateHandler<T extends { id?: string }>(
  zambdaName: string,
  category: QuickPickCategory<T>,
  parseQuickPick: (body: string) => { quickPick: Omit<T, 'id'>; secrets: Secrets }
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return makeHandler(zambdaName, async (oystehr, input): Promise<QuickPickCreateResponse<T>> => {
    const { quickPick: quickPickData } = parseQuickPick(input.body!);
    const quickPick = await createQuickPick(oystehr, quickPickData, category);
    const displayName = category.getDisplayName(quickPickData);
    return { message: `Successfully created quick pick: ${displayName}`, quickPick };
  });
}

export function makeUpdateHandler<T extends { id?: string }>(
  zambdaName: string,
  category: QuickPickCategory<T>,
  parseUpdate: (body: string) => { quickPickId: string; quickPick: Omit<T, 'id'>; secrets: Secrets }
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return makeHandler(zambdaName, async (oystehr, input): Promise<QuickPickUpdateResponse<T>> => {
    const { quickPickId, quickPick: quickPickData } = parseUpdate(input.body!);
    const quickPick = await updateQuickPick(oystehr, quickPickId, quickPickData, category);
    const displayName = category.getDisplayName(quickPickData);
    return { message: `Successfully updated quick pick: ${displayName}`, quickPick };
  });
}

export function makeRemoveHandler(zambdaName: string): Handler<ZambdaInput, APIGatewayProxyResult> {
  return makeHandler(zambdaName, async (oystehr, input): Promise<QuickPickRemoveResponse> => {
    if (!input.body) throw new Error('No request body provided');
    const parsed = JSON.parse(input.body) as Record<string, unknown>;
    const quickPickId = parsed.quickPickId;
    if (typeof quickPickId !== 'string') throw new Error('quickPickId must be a string');
    await removeQuickPick(oystehr, quickPickId);
    return { message: 'Successfully removed quick pick' };
  });
}
