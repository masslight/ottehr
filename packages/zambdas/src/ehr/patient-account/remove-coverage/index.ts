import Oystehr, { BatchInputPatchRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, AuditEvent, Bundle, Coverage } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AUDIT_EVENT_OUTCOME_CODE,
  checkBundleOutcomeOk,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getVersionedReferencesFromBundleResources,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  Secrets,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch, ZambdaInput } from '../../../shared';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

let m2mToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const effectInput = await complexValidation(validatedParameters, oystehr);

    await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully removed coverage' }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('remove-coverage', error, ENVIRONMENT);
  }
};

interface EffectInput {
  patientId: string;
  coverage: Coverage;
  providerProfileReference: string;
  account?: Account;
}

const performEffect = async (input: EffectInput, oystehr: Oystehr): Promise<void> => {
  const { account, coverage, providerProfileReference, patientId } = input;
  const batchRequests: BatchInputPatchRequest<Account | Coverage>[] = [];
  const currentAccountCoverage = account?.coverage;
  if (currentAccountCoverage) {
    const newCoverage = currentAccountCoverage.filter((tempCov) => {
      if (tempCov.coverage.reference === `Coverage/${coverage.id}`) {
        return false;
      }
      return true;
    });
    console.log('new coverage', newCoverage, coverage.id);
    batchRequests.push({
      method: 'PATCH',
      url: `Account/${account?.id}`,
      operations: [
        {
          op: 'replace',
          path: '/coverage',
          value: newCoverage,
        },
      ],
    });
  }
  batchRequests.push({
    method: 'PATCH',
    url: `Coverage/${coverage.id}`,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'cancelled',
      },
    ],
  });

  let resultBundle: Bundle;
  try {
    resultBundle = await oystehr.fhir.transaction({ requests: batchRequests });
  } catch (e) {
    console.error('error updating patient account from questionnaire', e);
    const ae = await writeAuditEvent({ resultBundle: null, providerProfileReference, patientId }, oystehr);
    console.log('wrote audit event: ', `AuditEvent/${ae.id}`);
    throw e;
  }

  // console.log('resultBundle', JSON.stringify(resultBundle, null, 2));

  const ae = await writeAuditEvent({ resultBundle, providerProfileReference, patientId }, oystehr);

  console.log('wrote audit event: ', `AuditEvent/${ae.id}`);
};

interface Input {
  userToken: string;
  patientId: string;
  coverageId: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  const { secrets } = input;
  const { patientId, coverageId } = JSON.parse(input.body);

  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  if (!coverageId) {
    throw MISSING_REQUIRED_PARAMETERS(['coverageId']);
  }

  if (isValidUUID(patientId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('patientId');
  }
  if (isValidUUID(coverageId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('coverageId');
  }

  return {
    secrets,
    userToken,
    patientId,
    coverageId,
  };
};

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<EffectInput> => {
  const { patientId, coverageId, userToken, secrets } = input;
  const userOystehr = createOystehrClient(userToken, secrets);
  const user = await userOystehr.user.me();
  if (!user) {
    throw NOT_AUTHORIZED;
  }

  const providerProfileReference = user.profile;

  if (!providerProfileReference) {
    throw NOT_AUTHORIZED;
  }
  const accountAndCoverages = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
  const effectInput: Partial<EffectInput> = {
    account: accountAndCoverages.account,
    providerProfileReference,
    patientId,
  };
  const { coverages } = accountAndCoverages;
  let coverage: Coverage | undefined;

  if (coverages.primary && coverages.primary.id === coverageId) {
    coverage = coverages.primary;
  }
  if (coverages.secondary && coverages.secondary.id === coverageId) {
    coverage = coverages.secondary;
  }

  if (!coverage) {
    throw FHIR_RESOURCE_NOT_FOUND('Coverage');
  }
  effectInput.coverage = coverage;

  return effectInput as EffectInput;
};

interface AuditEventInput {
  resultBundle: Bundle | null;
  providerProfileReference: string;
  patientId: string;
}

const writeAuditEvent = async (input: AuditEventInput, oystehr: Oystehr): Promise<AuditEvent> => {
  const { resultBundle, providerProfileReference, patientId } = input;
  // todo: check that bundle outcome was successful
  console.log('result bundle', JSON.stringify(resultBundle, null, 2));
  const outcome = (() => {
    if (!resultBundle) {
      return AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
    }
    return checkBundleOutcomeOk(resultBundle)
      ? AUDIT_EVENT_OUTCOME_CODE.success
      : AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
  })();
  const entity: AuditEvent['entity'] = [
    {
      what: {
        reference: `Patient/${patientId}`,
      },
      role: {
        system: 'http://terminology.hl7.org/CodeSystem/object-role',
        code: '1',
        display: 'Patient',
      },
    },
  ];
  if (resultBundle) {
    entity.push(
      ...getVersionedReferencesFromBundleResources(resultBundle).map((reference) => {
        return {
          what: reference,
          role: {
            system: 'http://terminology.hl7.org/CodeSystem/object-role',
            code: '4',
            display: 'Domain Resource',
          },
          description: 'Resource updated as a result of processing a remove Coverage request',
        };
      })
    );
  }
  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle',
      code: 'unlink',
      display: 'Unlink Record Lifecycle Event',
    },
    recorded: DateTime.now().toISO(),
    outcome,
    agent: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'AUT',
              display: 'author (originator)',
            },
          ],
        },
        who: {
          reference: providerProfileReference,
        },
        requestor: true,
      },
    ],
    source: {
      site: 'Ottehr',
      observer: {
        reference: providerProfileReference,
      },
    },
    entity,
  };
  return oystehr.fhir.create(auditEvent);
};
