import Oystehr, { RcmListPayersResponse } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization, QuestionnaireItemAnswerOption } from 'fhir/r4b';
import { createOystehrClient, getPayerId, getPayerName } from 'utils/lib/helpers/helpers';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { ClinicalCustomInsuranceOrgOption } from 'utils/lib/types/data/billing/custom-insurance-org.types';
import {
  ANSWER_OPTION_FROM_RESOURCE_UNDEFINED,
  APIError,
  isApiError,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  MISSING_REQUIRED_PARAMETERS,
} from 'utils/lib/types/errors';
import { listCustomInsuranceOrganizations } from '../../shared/custom-insurance-org-directory';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';

interface Input {
  secrets: ZambdaInput['secrets'];
  prependIdentifier?: boolean;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(
  'get-all-insurance-payers',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const validatedInput = validateInput(input);

    console.group('getAuth0Token');
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(validatedInput.secrets);
    } else {
      console.log('already have token');
    }
    console.groupEnd();
    console.debug('getAuth0Token success');

    console.group('createOystehrClient');
    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, validatedInput.secrets),
      getSecret(SecretsKeys.PROJECT_API, validatedInput.secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    const answerOptions: QuestionnaireItemAnswerOption[] = await getAllInsurancePayers(
      oystehr,
      validatedInput.prependIdentifier
    );

    return {
      statusCode: 200,
      body: JSON.stringify(answerOptions),
    };
  }
);

export async function getAllInsurancePayers(
  oystehr: Oystehr,
  prependIdentifier?: boolean
): Promise<QuestionnaireItemAnswerOption[]> {
  console.group('listPayers');
  const payers = [];
  let hasMore = true;
  let nextCursor: string | null = null;
  while (hasMore) {
    const result: RcmListPayersResponse = await oystehr.rcm.listPayers({
      limit: 200,
      cursor: nextCursor ?? undefined,
    });
    payers.push(...result.data);
    nextCursor = result.metadata.nextCursor;
    hasMore = !!nextCursor;
  }
  console.groupEnd();

  let error: APIError | undefined;
  const mappedResults = payers
    .map((payer) => {
      try {
        return formatPayerAsAnswerOption(oystehr, payer, prependIdentifier);
      } catch (e) {
        if (isApiError(e)) {
          error = e as APIError;
        }
        return undefined;
      }
    })
    .filter((res) => !!res) as QuestionnaireItemAnswerOption[];
  if (mappedResults.length === 0 && error) {
    throw error;
  }

  // Custom insurance organizations are user-defined payers not present in RCM's payer directory —
  // shown and selectable alongside the RCM payers above, via the clinical directory's one door into
  // billing (see custom-insurance-org-directory.ts), the same way NIOs are surfaced clinically. Gated
  // per-deployment: with the flag off, only Oystehr payers are offered (existing coverages that
  // already reference a custom insurance organization still resolve and display correctly).
  if (FEATURE_FLAGS_CONFIG.customOrganizationsEnabled) {
    console.group('listCustomInsuranceOrganizations');
    const customOrgs = await listCustomInsuranceOrganizations(oystehr, {});
    console.groupEnd();
    mappedResults.push(...customOrgs.map((org) => formatCustomInsuranceOrgAsAnswerOption(org, prependIdentifier)));
  }

  mappedResults.push({
    valueReference: {
      reference: oystehr.rcm.constructPayerUrl({ id: '00000' }),
      display: 'Other',
      type: 'other',
    },
  });
  return mappedResults.sort((r1, r2) => {
    const r1Val = r1.valueReference?.display?.split(' - ')[1] ?? r1.valueReference?.display ?? '';
    const r2Val = r2.valueReference?.display?.split(' - ')[1] ?? r2.valueReference?.display ?? '';

    return r1Val.localeCompare(r2Val);
  });
}

const formatPayerAsAnswerOption = (
  oystehr: Oystehr,
  payer: Organization,
  prependIdentifier?: boolean
): QuestionnaireItemAnswerOption => {
  let name = getPayerName(payer);
  const payerId = getPayerId(payer);
  if (prependIdentifier) {
    if (payerId) {
      name = `${payerId} - ${name}`;
    }
  }
  if (name && payerId && typeof name === 'string' && typeof payerId === 'string') {
    return {
      valueReference: {
        reference: oystehr.rcm.constructPayerUrl({ id: payerId }),
        display: name,
        type: payer.name === 'Other' ? 'other' : undefined,
      },
    };
  }
  throw ANSWER_OPTION_FROM_RESOURCE_UNDEFINED('Organization');
};

const formatCustomInsuranceOrgAsAnswerOption = (
  org: ClinicalCustomInsuranceOrgOption,
  prependIdentifier?: boolean
): QuestionnaireItemAnswerOption => {
  // org.reference is a reference token (see getCustomInsuranceOrgReferenceUrl), not a direct
  // "Organization/<id>" reference — harvest resolves it through the billing zambda interface when
  // the paperwork answer is turned into a Coverage.
  const name = prependIdentifier && org.orgId ? `${org.orgId} - ${org.name}` : org.name;
  return {
    valueReference: {
      reference: org.reference,
      display: name,
    },
  };
};

function validateInput(input: ZambdaInput): Input {
  const { body, secrets } = input;
  if (!body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { answerSource } = JSON.parse(body);
  if (!body) {
    throw MISSING_REQUIRED_PARAMETERS(['answerSource']);
  }
  const { prependIdentifier } = answerSource;

  return {
    secrets,
    prependIdentifier: prependIdentifier === 'true' || prependIdentifier === true,
  };
}
