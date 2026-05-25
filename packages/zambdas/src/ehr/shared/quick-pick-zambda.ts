import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';
import { QuickPickCreateResponse, QuickPickListResponse, QuickPickUpdateResponse } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { createQuickPick, QuickPickCategory, searchQuickPicks, updateQuickPick } from './quick-pick-helpers';

let m2mToken: string;

export function makeHandler(
  zambdaName: string,
  effect: (oystehr: Oystehr, input: ZambdaInput) => Promise<unknown>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return wrapHandler(zambdaName, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
  parseQuickPick: (body: string) => { quickPick: Omit<T, 'id'> },
  validate?: (oystehr: Oystehr, quickPick: Omit<T, 'id'>) => Promise<void>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return makeHandler(zambdaName, async (oystehr, input): Promise<QuickPickCreateResponse<T>> => {
    if (!input.body) throw new Error('No request body provided');
    const { quickPick: quickPickData } = parseQuickPick(input.body);
    if (validate) await validate(oystehr, quickPickData);
    const quickPick = await createQuickPick(oystehr, quickPickData, category);
    const displayName = category.getDisplayName(quickPickData);
    return { message: `Successfully created quick pick: ${displayName}`, quickPick };
  });
}

export function makeUpdateHandler<T extends { id?: string }>(
  zambdaName: string,
  category: QuickPickCategory<T>,
  parseUpdate: (body: string) => { quickPickId: string; quickPick: Omit<T, 'id'> },
  validate?: (oystehr: Oystehr, quickPickId: string, quickPick: Omit<T, 'id'>) => Promise<void>
): Handler<ZambdaInput, APIGatewayProxyResult> {
  return makeHandler(zambdaName, async (oystehr, input): Promise<QuickPickUpdateResponse<T>> => {
    if (!input.body) throw new Error('No request body provided');
    const { quickPickId, quickPick: quickPickData } = parseUpdate(input.body);
    if (validate) await validate(oystehr, quickPickId, quickPickData);
    const quickPick = await updateQuickPick(oystehr, quickPickId, quickPickData, category);
    const displayName = category.getDisplayName(quickPickData);
    return { message: `Successfully updated quick pick: ${displayName}`, quickPick };
  });
}
