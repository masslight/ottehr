import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coverage, CoverageEligibilityResponse, Practitioner } from 'fhir/r4b';
import { pullCoverageIdentifyingDetails } from 'utils/lib/fhir/billing';
import { parseCoverageEligibilityResponse } from 'utils/lib/fhir/billing';
import { getPreferredPharmacyFromPatient } from 'utils/lib/fhir/patient';
import { Secrets } from 'utils/lib/secrets';
import { CoverageCheckWithDetails, PatientAccountResponse } from 'utils/lib/types/api/patient-account';
import { INVALID_RESOURCE_ID_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getAccountAndCoverageResourcesForPatient } from '../../shared/harvest';

const ZAMBDA_NAME = 'get-patient-account';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
  const { secrets } = validatedParameters;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const resources = await performEffect(validatedParameters, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(resources),
  };
});

const performEffect = async (input: Input, oystehr: Oystehr): Promise<PatientAccountResponse> => {
  const { patientId } = input;
  console.log('performing effect for patient account get');
  // due to really huge CEResponses causing response-too-large errors, we need to chop our querying for the CEResponses into
  // manageable chunks. We'll do this by first querying for just the IDs of the CEResponses, then querying for the full resources in parallel.
  // Even just two resources returned in a query can still result in response-too-large errors based on prod data we've encountered.
  //
  // That id query needs nothing but the patient id, so it is issued alongside the account resources
  // rather than after them — waiting cost a whole serialized round trip on every load of the patient
  // details screen.
  console.time('account resources + CER ids');
  const [accountAndCoverages, eligibilityCheckIdBundle] = await Promise.all([
    getAccountAndCoverageResourcesForPatient(patientId, oystehr),
    oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        {
          name: `patient._id`,
          value: patientId,
        },
        {
          name: '_sort',
          value: '-created',
        },
        {
          name: '_elements',
          value: 'id',
        },
        {
          name: '_count', // we shouldn't need more than the most recent 10 eligibility checks
          value: '10',
        },
      ],
    }),
  ]);
  console.timeEnd('account resources + CER ids');

  const primaryCarePhysician = accountAndCoverages.patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;

  const eligibilityCheckIds = eligibilityCheckIdBundle
    .unbundle()
    .map((cer) => cer.id)
    .filter((id): id is string => !!id);
  console.log('fetching the following CERs:', JSON.stringify(eligibilityCheckIds));

  const eligibilityCheckResults: CoverageEligibilityResponse[] = await Promise.all(
    eligibilityCheckIds.map((id) =>
      oystehr.fhir.get<CoverageEligibilityResponse>({ resourceType: 'CoverageEligibilityResponse', id })
    )
  );

  // The account query above already returned this patient's coverages, and eligibility checks are
  // normally run against exactly those — so most of the ids below are already in hand. Fetching only
  // the ones that are not (typically none) usually skips this round trip entirely, and skipping it
  // when nothing is needed also avoids the empty batch request this used to send unconditionally.
  const knownCoverages: Coverage[] = Object.values(accountAndCoverages.coverages ?? {}).filter(
    (coverage): coverage is Coverage => coverage?.resourceType === 'Coverage'
  );
  const knownCoverageIds = new Set(knownCoverages.map((coverage) => coverage.id).filter(Boolean));

  const coverageIdsToFetch = [
    ...new Set(
      eligibilityCheckResults.flatMap((ecr) => {
        if (ecr.insurance?.[0]?.coverage?.reference) {
          const [resourceType, id] = ecr.insurance[0].coverage.reference.split('/');
          if (resourceType === 'Coverage' && !knownCoverageIds.has(id)) {
            return id;
          }
        }
        return [];
      })
    ),
  ];
  const coverageRequests: BatchInputGetRequest[] = coverageIdsToFetch.map((id) => ({
    method: 'GET',
    url: `Coverage/${id}`,
  }));
  const fetchedCoverages: Coverage[] = coverageRequests.length
    ? (await oystehr.fhir.batch<Coverage>({ requests: coverageRequests })).entry?.flatMap((e) => e.resource ?? []) ?? []
    : [];
  const coverages: Coverage[] = [...fetchedCoverages, ...knownCoverages];

  const mapped = eligibilityCheckResults
    .map((result) => {
      const coverage = [...coverages, ...(result.contained ?? [])].find(
        (resource) =>
          resource.resourceType === 'Coverage' &&
          result.insurance?.[0]?.coverage?.reference?.includes(resource.id ?? '')
      ) as Coverage;
      // console.log('coverageDetails', JSON.stringify(coverage, null, 2));
      if (!coverage) {
        return null;
      }
      const coverageDetails = pullCoverageIdentifyingDetails(coverage);
      if (!coverageDetails) {
        return null;
      }
      return {
        ...parseCoverageEligibilityResponse(result),
        ...coverageDetails,
      } as CoverageCheckWithDetails;
    })
    .filter((result) => result !== null) as CoverageCheckWithDetails[];
  const { patient } = accountAndCoverages;
  const pharmacy = getPreferredPharmacyFromPatient(patient);
  return {
    ...accountAndCoverages,
    primaryCarePhysician,
    coverageChecks: mapped,
    pharmacy,
  };
};

interface Input {
  userToken: string;
  patientId: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
  // at some point and it should always be available, so throwing it in the input interface anticipatorily
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { patientId } = JSON.parse(input.body);

  if (!patientId) {
    throw MISSING_REQUIRED_PARAMETERS(['patientId']);
  }

  if (isValidUUID(patientId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('patientId');
  }

  return {
    secrets,
    userToken,
    patientId,
  };
};
