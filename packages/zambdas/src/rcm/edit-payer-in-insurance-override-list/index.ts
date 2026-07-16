import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Extension, List } from 'fhir/r4b';
import {
  createOystehrClient,
  getSecret,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  PRECONDITION_FAILED,
  SecretsKeys,
} from 'utils';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { z } from 'zod';
import { formatZodError, getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';
import { getInsuranceOverrideList, ListName } from '../get-insurance-override-list/handler';

const payerInfoSchema = z.discriminatedUnion('listName', [
  z.object({
    listName: z.literal(ListName.EHR),
    payerId: z.string(),
    payerNote: z.string(),
  }),
  z.object({
    listName: z.literal(ListName.Patient),
    payerId: z.string(),
    payerNameOverride: z.string().optional(),
  }),
]);

type PayerInfo = z.infer<typeof payerInfoSchema>;

interface Input {
  secrets: ZambdaInput['secrets'];
  payerInfo: PayerInfo;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(
  'edit-payer-in-insurance-override-list',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets } = input;
    const validatedInput = validateInput(input);

    console.group('getAuth0Token');
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }
    console.groupEnd();
    console.debug('getAuth0Token success');

    console.group('createOystehrClient');
    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    const list: List = await editPayerInInsuranceOverrideList(oystehr, validatedInput.payerInfo);

    return {
      statusCode: 200,
      body: JSON.stringify(list),
    };
  }
);

async function editPayerInInsuranceOverrideList(oystehr: Oystehr, payerInfo: PayerInfo): Promise<List> {
  const list = await getInsuranceOverrideList(oystehr, payerInfo.listName);
  if (!list.entry) {
    throw INVALID_INPUT_ERROR('Cannot find insurance override list');
  }
  const entryIndex = list.entry.findIndex(
    (entry) => entry.item.reference === oystehr.rcm.constructPayerUrl({ id: payerInfo.payerId })
  );
  if (entryIndex < 0) {
    throw INVALID_INPUT_ERROR('Cannot find insurance override list entry');
  }

  const extensionValue: Extension | undefined =
    payerInfo.listName === ListName.EHR
      ? {
          url: ottehrExtensionUrl('insurance-override-note'),
          valueString: payerInfo.payerNote,
        }
      : payerInfo.payerNameOverride
        ? {
            url: ottehrExtensionUrl('insurance-override-name'),
            valueString: payerInfo.payerNameOverride,
          }
        : undefined;

  try {
    return await oystehr.fhir.patch<List>(
      {
        resourceType: 'List',
        id: list.id,
        operations: [
          {
            op: 'replace',
            path: `/entry/${entryIndex}/extension`,
            value: [extensionValue],
          },
        ],
      },
      {
        optimisticLockingVersionId: list.meta?.versionId,
      }
    );
  } catch (err) {
    if (err instanceof Oystehr.OystehrFHIRError && err.code === 412) {
      // requery and try again
      const list = await getInsuranceOverrideList(oystehr, payerInfo.listName);
      if (!list.entry) {
        throw INVALID_INPUT_ERROR('Cannot find insurance override list');
      }
      const entryIndex = list.entry.findIndex(
        (entry) => entry.item.reference === oystehr.rcm.constructPayerUrl({ id: payerInfo.payerId })
      );
      if (entryIndex < 0) {
        throw INVALID_INPUT_ERROR('Cannot find insurance override list entry');
      }
      try {
        return await oystehr.fhir.patch<List>(
          {
            resourceType: 'List',
            id: list.id,
            operations: [
              {
                op: 'replace',
                path: `/entry/${entryIndex}/extension`,
                value: [extensionValue],
              },
            ],
          },
          {
            optimisticLockingVersionId: list.meta?.versionId,
          }
        );
      } catch (err) {
        if (err instanceof Oystehr.OystehrFHIRError && err.code === 412) {
          // bail out this time
          throw PRECONDITION_FAILED();
        }
        // throw as internal error
        throw err;
      }
    }
    // throw as internal error
    throw err;
  }
}

function validateInput(input: ZambdaInput): Input {
  const { body, secrets } = input;
  if (!body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const payerInfo = payerInfoSchema.safeParse(JSON.parse(body));
  if (payerInfo.error) {
    throw INVALID_INPUT_ERROR(`Invalid request parameters: ${formatZodError(payerInfo.error)}`);
  }

  return {
    payerInfo: payerInfo.data,
    secrets,
  };
}
