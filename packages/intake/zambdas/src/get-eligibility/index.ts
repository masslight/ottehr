import Oystehr, { Bundle } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Coverage,
  CoverageClass,
  CoverageEligibilityRequest,
  InsurancePlan,
  Organization,
  Patient,
  Practitioner,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ELIGIBILITY_BENEFIT_CODES,
  ELIGIBILITY_FAILED_REASONS,
  ELIGIBILITY_FAILED_REASON_META_TAG,
  ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX,
  ELIGIBILITY_RELATED_PERSON_META_TAG,
  GetEligibilityInsuranceData,
  GetEligibilityPolicyHolder,
  INSURANCE_COVERAGE_CODING,
  InsuranceEligibilityCheckStatus,
  InsurancePlanDTO,
  PRIVATE_EXTENSION_BASE_URL,
  createOystehrClient,
  removeTimeFromDate,
} from 'utils';
import { SecretsKeys, ZambdaInput, getSecret, lambdaResponse, topLevelCatch } from 'zambda-utils';
import { createInsurancePlanDto, createOrUpdateRelatedPerson, getAuth0Token } from '../shared';
import { parseEligibilityCheckResponse } from './helpers';
import { prevalidationHandler } from './prevalidation-handler';
import { validateInsuranceRequirements, validateRequestParameters } from './validation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let primary: InsuranceEligibilityCheckStatus;
  let secondary: InsuranceEligibilityCheckStatus | undefined;
  try {
    console.group('validateRequestParameters');
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      console.error(error);
      return lambdaResponse(400, { message: error.message });
    }
    const {
      appointmentId,
      primaryInsuranceData,
      patientId,
      primaryPolicyHolder,
      secrets,
      secondaryInsuranceData,
      secondaryPolicyHolder,
      coveragePrevalidationInput,
    } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    console.log('validatedParameters', JSON.stringify(validatedParameters));

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    console.group('createOystehrClient');
    const apiUrl = getSecret(SecretsKeys.PROJECT_API, secrets);
    const oystehr = createOystehrClient(
      zapehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.groupEnd();
    console.debug('createOystehrClient success');

    if (coveragePrevalidationInput) {
      console.log('prevalidation path...');
      const result = await prevalidationHandler(
        { ...validatedParameters, coveragePrevalidationInput, apiUrl, accessToken: zapehrToken, secrets: secrets },
        oystehr
      );
      console.log('prevalidation primary', result.primary);
      console.log('prevalidation secondary', result.primary);
      primary = result.primary;
      secondary = result.secondary;
    } else {
      console.group('getFhirResources');
      const fhirResources = await getFhirResources(
        appointmentId,
        oystehr,
        primaryInsuranceData,
        patientId,
        secondaryInsuranceData
      );
      console.groupEnd();
      console.debug('getFhirResources success');
      console.log('fhirResources', JSON.stringify(fhirResources));
      const {
        appointment,
        billingProviderGroup,
        billingProviderIndividual,
        patient,
        coverages,
        // Primary insurance resources
        primaryInsurancePlan,
        primaryPayor,
        primaryRelatedPerson,
        // Secondary insurance resources
        secondaryInsurancePlan,
        secondaryPayor,
        secondaryRelatedPerson,
      } = fhirResources;

      console.group('validateInsuranceRequirements');
      const primaryInsurancePlanRequirements = createInsurancePlanDto(primaryInsurancePlan);
      try {
        validateInsuranceRequirements({
          insurancePlanDto: primaryInsurancePlanRequirements,
          insuranceData: primaryInsuranceData,
          policyHolder: primaryPolicyHolder,
          primary: true,
        });
      } catch (error: any) {
        console.error(error);
        return lambdaResponse(400, { message: error.message });
      }
      console.groupEnd();
      console.debug('validateInsuranceRequirements success');

      const areSecondaryInsuranceDetailsProvided =
        secondaryInsuranceData && secondaryInsurancePlan && secondaryPolicyHolder && secondaryPayor;

      let secondaryInsurancePlanRequirements: InsurancePlanDTO | undefined;
      if (areSecondaryInsuranceDetailsProvided) {
        console.group('validateInsuranceRequirements secondary');
        secondaryInsurancePlanRequirements = createInsurancePlanDto(secondaryInsurancePlan);
        try {
          validateInsuranceRequirements({
            insurancePlanDto: secondaryInsurancePlanRequirements,
            insuranceData: secondaryInsuranceData,
            policyHolder: secondaryPolicyHolder,
            primary: false,
          });
        } catch (error: any) {
          console.error(error);
          return lambdaResponse(400, { message: error.message });
        }
        console.groupEnd();
        console.debug('validateInsuranceRequirements secondary success');
      }

      console.group('createRelatedPersonCoverageAndEligibilityRequest');
      const coverageEligibilityRequest = await createRelatedPersonCoverageAndEligibilityRequest({
        billingProviderGroup,
        billingProviderIndividual,
        coverages,
        oystehr,
        insurancePlan: primaryInsurancePlan,
        insuranceData: primaryInsuranceData,
        patientId,
        patient,
        payor: primaryPayor,
        policyHolder: primaryPolicyHolder,
        relatedPerson: primaryRelatedPerson,
        primary: true,
      });
      console.groupEnd();
      console.debug('createRelatedPersonCoverageAndEligibilityRequest success');

      let secondaryCoverageEligibilityRequest: CoverageEligibilityRequest | undefined;
      if (areSecondaryInsuranceDetailsProvided) {
        console.log('Secondary insurance details are provided.');

        console.group('createRelatedPersonCoverageAndEligibilityRequest secondary');
        secondaryCoverageEligibilityRequest = await createRelatedPersonCoverageAndEligibilityRequest({
          billingProviderGroup,
          billingProviderIndividual,
          coverages,
          oystehr,
          insurancePlan: secondaryInsurancePlan,
          insuranceData: secondaryInsuranceData,
          patientId,
          patient,
          payor: secondaryPayor,
          policyHolder: secondaryPolicyHolder,
          relatedPerson: secondaryRelatedPerson,
          primary: false,
        });
        console.groupEnd();
        console.debug('createRelatedPersonCoverageAndEligibilityRequest secondary success');
      }

      if (!primaryInsurancePlanRequirements.enabledEligibilityCheck) {
        console.log('Eligibility checking disabled for this insurance.');
        // Bypass insurance will end up here too so it doesn't need a special case or tag.
        await tagAppointmentWithEligibilityFailureReason({
          appointment,
          appointmentId,
          oystehr,
          reason: ELIGIBILITY_FAILED_REASONS.eligibilityCheckDisabled,
        });
        primary = InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported;
      } else {
        const projectApiURL = getSecret(SecretsKeys.PROJECT_API, secrets);
        // TODO replace with SDK calls when out of public beta https://docs.oystehr.com/services/rcm/eligibility/
        /*
        console.group('createAppClient');
        const appClient = createAppClient(zapehrToken, projectApiURL);
        console.groupEnd();
        console.debug('createAppClient success');

        Replace `createEligibilityCheckPromise` with appClient.rcm.eligibilityCheck(...)
      */

        const eligibilityCheckRequest = performEligibilityCheck(coverageEligibilityRequest.id, projectApiURL);
        const eligibilityCheckRequestPromises = [eligibilityCheckRequest];
        if (secondaryCoverageEligibilityRequest && secondaryInsurancePlanRequirements?.enabledEligibilityCheck) {
          eligibilityCheckRequestPromises.push(
            performEligibilityCheck(secondaryCoverageEligibilityRequest.id, projectApiURL)
          );
        }

        // secondaryEligibilityCheckResponse might be undefined but TS doesn't seem to know that.
        const [primaryEligibilityCheckResponse, secondaryEligibilityCheckResponse] = await Promise.allSettled(
          eligibilityCheckRequestPromises
        );

        // If the primary insurance fails, return the error and don't continue.
        if (primaryEligibilityCheckResponse.status === 'rejected') {
          await tagAppointmentWithEligibilityFailureReason({
            appointment,
            appointmentId,
            oystehr,
            reason: ELIGIBILITY_FAILED_REASONS.apiFailure,
          });
          throw new Error(primaryEligibilityCheckResponse.reason);
        } else if (!primaryEligibilityCheckResponse.value.ok) {
          await tagAppointmentWithEligibilityFailureReason({
            appointment,
            appointmentId,
            oystehr,
            reason: ELIGIBILITY_FAILED_REASONS.apiFailure,
          });
          throw new Error(
            `Eligibility endpoint returned a status that was not ok for primary insurance. Value: ${JSON.stringify(
              await primaryEligibilityCheckResponse.value.json()
            )}`
          );
        }

        console.group('checkEligibility');
        // Enable QA to test failed eligibility response
        if (primaryPayor.name === 'VA UHC UMR' && secrets?.ENVIRONMENT !== 'production') {
          console.log('Bypassing eligibility check in lowers. Returning false.');
          primary = InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;
        } else {
          primary = await checkEligibility({
            eligibilityCheckResponse: primaryEligibilityCheckResponse,
            tagProps: {
              appointment,
              appointmentId,
              oystehr,
            },
          });
        }
        console.groupEnd();
        console.debug('checkEligibility success');

        if (secondaryEligibilityCheckResponse) {
          secondary = await checkEligibility({
            eligibilityCheckResponse: secondaryEligibilityCheckResponse,
            tagProps: {
              appointment,
              appointmentId,
              oystehr,
            },
          });
        }
      }
    }
    return lambdaResponse(200, { primary, secondary });
  } catch (error: any) {
    console.error(error, error.issue);
    return topLevelCatch('get-eligibility', error, input.secrets);
  }
};

// -----------------------------------------------------------------------------

const findActiveInsuranceCoveragesForPatient = (resources: Coverage[], patient: Patient): Coverage[] => {
  return resources.filter(
    (resource) =>
      resource.resourceType === 'Coverage' &&
      resource.status === 'active' &&
      resource.beneficiary.reference?.split('/')[1] === patient.id &&
      Boolean(
        resource.type?.coding?.find(
          (coding) =>
            coding.code === INSURANCE_COVERAGE_CODING.code && coding.system === INSURANCE_COVERAGE_CODING.system
        )
      )
  ) as Coverage[];
};

const getFhirResources = async (
  appointmentId: string,
  oystehr: Oystehr,
  primaryInsuranceData: GetEligibilityInsuranceData,
  patientId: string,
  secondaryInsuranceData?: GetEligibilityInsuranceData
): Promise<{
  appointment: Appointment;
  billingProviderGroup: Practitioner;
  billingProviderIndividual: Practitioner;
  coverages: Coverage[];
  primaryInsurancePlan: InsurancePlan;
  patient: Patient;
  primaryPayor: Organization;
  primaryRelatedPerson: RelatedPerson | undefined;
  secondaryInsurancePlan?: InsurancePlan;
  secondaryPayor?: Organization;
  secondaryRelatedPerson?: RelatedPerson | undefined;
}> => {
  const appointmentResourcePromise = oystehr.fhir.search<Appointment>({
    resourceType: 'Appointment',
    params: [
      {
        name: '_id',
        value: appointmentId,
      },
    ],
  });

  const patientAndCoverageResourcesPromise = oystehr.fhir.search<Patient | Coverage>({
    resourceType: 'Patient',
    params: [
      {
        name: '_id',
        value: patientId,
      },
      {
        name: '_revinclude',
        value: 'Coverage:beneficiary',
      },
    ],
  });
  const insuranceResourcesPromise = oystehr.fhir.search<InsurancePlan | Organization>({
    resourceType: 'InsurancePlan',
    params: [
      {
        name: '_id',
        value: primaryInsuranceData.insuranceId,
      },
      {
        name: '_include',
        value: 'InsurancePlan:owned-by',
      },
    ],
  });
  let secondaryInsuranceResourcesPromise: Promise<Bundle<InsurancePlan | Organization>> | undefined;
  if (secondaryInsuranceData)
    secondaryInsuranceResourcesPromise = oystehr.fhir.search<InsurancePlan | Organization>({
      resourceType: 'InsurancePlan',
      params: [
        {
          name: '_id',
          value: secondaryInsuranceData.insuranceId,
        },
        {
          name: '_include',
          value: 'InsurancePlan:owned-by',
        },
      ],
    });
  const billingProviderResourcesPromise = oystehr.fhir.search<Practitioner>({
    resourceType: 'Practitioner',
    params: [
      {
        name: '_tag:contains',
        value: ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX,
      },
    ],
  });
  const relatedPersonResourcesPromise = oystehr.fhir.search<RelatedPerson>({
    resourceType: 'RelatedPerson',
    params: [
      {
        name: 'patient',
        value: patientId,
      },
      {
        name: '_tag',
        value: `${ELIGIBILITY_RELATED_PERSON_META_TAG}_1`,
      },
    ],
  });
  const secondaryRelatedPersonResourcesPromise = oystehr.fhir.search<RelatedPerson>({
    resourceType: 'RelatedPerson',
    params: [
      {
        name: 'patient',
        value: patientId,
      },
      {
        name: '_tag',
        value: `${ELIGIBILITY_RELATED_PERSON_META_TAG}_2`,
      },
    ],
  });

  const [
    appointmentResources,
    patientAndCoverageResources,
    insuranceResources,
    billingProviderResources,
    relatedPersonResources,
    secondaryInsuranceResources,
    secondaryRelatedPersonResources,
  ] = await Promise.all([
    appointmentResourcePromise,
    patientAndCoverageResourcesPromise,
    insuranceResourcesPromise,
    billingProviderResourcesPromise,
    relatedPersonResourcesPromise,
    secondaryInsuranceResourcesPromise,
    secondaryRelatedPersonResourcesPromise,
  ]);

  const appointment = appointmentResources.unbundle()[0];
  const patient = patientAndCoverageResources
    .unbundle()
    .find((resource) => resource.resourceType === 'Patient') as Patient;
  const billingProviderGroup = billingProviderResources
    .unbundle()
    .find(
      (provider) => provider.meta?.tag?.[0].code === `${ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX}_group`
    ) as Practitioner;
  const billingProviderIndividual = billingProviderResources
    .unbundle()
    .find(
      (provider) => provider.meta?.tag?.[0].code === `${ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX}_individual`
    ) as Practitioner;

  // Primary insurance resources
  const insurancePlan = insuranceResources
    .unbundle()
    .find((resource) => resource.resourceType === 'InsurancePlan') as InsurancePlan;
  const payor = insuranceResources
    .unbundle()
    .find((resource) => resource.resourceType === 'Organization') as Organization;

  const coverageResources = patientAndCoverageResources
    .unbundle()
    .filter((res) => res.resourceType === 'Coverage') as Coverage[];
  const coverages = findActiveInsuranceCoveragesForPatient(coverageResources, patient);

  const relatedPerson = relatedPersonResources.unbundle()[0];

  // Secondary insurance resources
  const secondaryInsurancePlan = secondaryInsuranceResources
    ?.unbundle()
    .find((resource) => resource.resourceType === 'InsurancePlan') as InsurancePlan | undefined;
  const secondaryPayor = secondaryInsuranceResources
    ?.unbundle()
    .find((resource) => resource.resourceType === 'Organization') as Organization | undefined;

  const secondaryRelatedPerson = secondaryRelatedPersonResources.unbundle()[0];

  return {
    appointment,
    billingProviderGroup,
    billingProviderIndividual,
    patient,
    coverages,
    // Primary insurance resources
    primaryInsurancePlan: insurancePlan,
    primaryPayor: payor,
    primaryRelatedPerson: relatedPerson,
    // Secondary insurance resources
    secondaryInsurancePlan,
    secondaryPayor,
    secondaryRelatedPerson,
  };
};

// Haha these names are getting ridiculous
interface CreateRelatedPersonCoverageAndEligibilityRequestParameters {
  billingProviderGroup: Practitioner;
  billingProviderIndividual: Practitioner;
  coverages: Coverage[];
  oystehr: Oystehr;
  insurancePlan: InsurancePlan;
  insuranceData: GetEligibilityInsuranceData;
  patientId: string;
  patient: Patient;
  payor: Organization;
  policyHolder: GetEligibilityPolicyHolder;
  relatedPerson: RelatedPerson | undefined;
  primary: boolean;
}
const createRelatedPersonCoverageAndEligibilityRequest = async ({
  billingProviderGroup,
  billingProviderIndividual,
  coverages,
  oystehr,
  insurancePlan,
  insuranceData,
  patientId,
  patient,
  payor,
  policyHolder,
  relatedPerson,
  primary,
}: CreateRelatedPersonCoverageAndEligibilityRequestParameters): Promise<CoverageEligibilityRequest> => {
  console.log(`Using ${primary ? 'primary' : 'secondary'} insurance and policy holder details.`);
  // RelatedPerson
  let newRelatedPerson: RelatedPerson | undefined;
  if (!policyHolder.isPatient) {
    console.log('Policy holder is not patient.');

    console.group('createOrUpdateRelatedPerson');
    newRelatedPerson = await createOrUpdateRelatedPerson({
      oystehr,
      patient,
      relatedPersonData: policyHolder,
      relatedPerson,
      eligibility: true,
      primary,
    });
    console.groupEnd();
    console.debug('createOrUpdateRelatedPerson success');
    console.log('newRelatedPerson', JSON.stringify(newRelatedPerson));
  }

  if (!policyHolder.isPatient && newRelatedPerson == null) {
    throw new Error("newRelatedPerson wasn't set in createOrUpdateRelatedPerson.");
  }

  // Coverage
  console.group('createOrUpdateCoverage');
  const newCoverage = await createOrUpdateCoverage({
    coverages,
    oystehr,
    insurancePlan,
    insuranceData,
    patient,
    payor,
    policyHolder,
    relatedPerson: newRelatedPerson,
    primary,
  });
  console.groupEnd();
  console.debug('createOrUpdateCoverage success');
  console.log('newCoverage', JSON.stringify(newCoverage));

  if (!newCoverage.id || !payor.id) {
    // This should never happen.
    throw new Error('Fhir resource missing ID.');
  }

  // CoverageEligibilityRequest
  console.group('createCoverageEligibilityRequest');
  const coverageEligibilityRequest = await createCoverageEligibilityRequest({
    coverageId: newCoverage.id,
    oystehr,
    patientId,
    payorId: payor.id,
    providerId: chooseBillingProviderId(billingProviderGroup.id, billingProviderIndividual.id, payor),
  });
  console.groupEnd();
  console.debug('createCoverageEligibilityRequest success');
  console.log('coverageEligibilityRequest', JSON.stringify(coverageEligibilityRequest));

  return coverageEligibilityRequest;
};

interface CreateOrUpdateCoverageParameters {
  coverages: Coverage[];
  oystehr: Oystehr;
  insurancePlan: InsurancePlan;
  insuranceData: GetEligibilityInsuranceData;
  patient: Patient;
  payor: Organization;
  policyHolder: GetEligibilityPolicyHolder;
  relatedPerson: RelatedPerson | undefined;
  primary: boolean;
}
const createOrUpdateCoverage = async ({
  coverages,
  oystehr,
  insurancePlan,
  insuranceData,
  patient,
  payor,
  policyHolder,
  relatedPerson,
  primary,
}: CreateOrUpdateCoverageParameters): Promise<Coverage> => {
  const { isPatient } = policyHolder;

  const currentActiveCoverage = coverages.find((cov) => cov.order === (primary ? 1 : 2));

  const coverageExistsAndHasSameInsuranceData =
    currentActiveCoverage &&
    currentActiveCoverage.subscriberId === insuranceData?.memberId &&
    Boolean(currentActiveCoverage.payor.find((payor) => payor.reference?.split('/')[1] === payor?.id));

  // Default to 'Self' if isPatient is true.
  let relationshipValue: 'Child' | 'Parent' | 'Spouse' | 'Other' | 'Self' = 'Self';

  if (!isPatient) {
    switch (policyHolder.relationship) {
      case 'Father':
      case 'Mother':
      case 'Parent':
        relationshipValue = 'Parent';
        break;
      case 'Spouse':
        relationshipValue = 'Spouse';
        break;
      case 'Sibling':
      case 'Other':
        relationshipValue = 'Other';
        break;
      default:
        relationshipValue = 'Child';
        break;
    }
  }

  let coverageClass: CoverageClass | undefined;
  let insuranceIdentifierId: string | undefined;
  payor.identifier?.forEach((id) => {
    id.type?.coding?.forEach((coding) => {
      if (coding.system === 'payer-id') insuranceIdentifierId = coding.code;
    });
  });
  if (insuranceIdentifierId) {
    coverageClass = {
      type: {
        coding: [
          {
            code: 'plan',
            system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
          },
        ],
      },
      value: insuranceIdentifierId,
      name: insurancePlan.name,
    };
  }

  let coverage: Coverage;
  if (coverageExistsAndHasSameInsuranceData) {
    const operations: Operation[] = [];

    if (insuranceData.additionalInfo) {
      const notes = currentActiveCoverage.extension
        ?.filter((extension) => extension.url === 'insurance-note')
        .map((note) => note.valueString);
      if (!notes?.includes(insuranceData.additionalInfo)) {
        console.log('Creating a note using additional insurance info.');
        if (currentActiveCoverage.extension === undefined) {
          operations.push({
            op: 'add',
            path: '/extension',
            value: [
              {
                url: 'insurance-note',
                valueString: insuranceData.additionalInfo,
              },
            ],
          });
        } else {
          operations.push({
            op: 'add',
            path: '/extension/0',
            value: {
              url: 'insurance-note',
              valueString: insuranceData.additionalInfo,
            },
          });
        }
      }
    }

    if (coverageClass) {
      operations.push({
        op: currentActiveCoverage?.class ? 'replace' : 'add',
        path: '/class',
        value: [coverageClass],
      });
    }

    console.log('Updating the found coverage resource.');
    coverage = await oystehr.fhir.patch<Coverage>({
      resourceType: 'Coverage',
      id: currentActiveCoverage.id ?? '',
      operations,
    });
  } else {
    const subscriber = {
      reference: '',
    };
    if (isPatient) {
      subscriber.reference = `Patient/${patient.id}`;
    } else {
      if (!relatedPerson) {
        // This should never happen.
        throw new Error("RelatedPerson wasn't created.");
      }
      subscriber.reference = `RelatedPerson/${relatedPerson.id}`;
    }

    // todo: this resource creation / updating shouldn't be happening here, especially before we know the result of the coverage check
    // instead we should be creating a contained Coverage resource with all the relevant data on the CoverageEligibilityRequest
    // that gets submitted to Oystehr. actually writing these resources should happen in the harvest module.
    console.log('Creating a new coverage resource and updating previous coverages to mark as non-active.');

    const [createdCoverage, _] = await Promise.all([
      oystehr.fhir.create<Coverage>({
        resourceType: 'Coverage',
        subscriberId: insuranceData.memberId,
        subscriber,
        payor: [
          {
            reference: `Organization/${payor.id}`,
          },
        ],
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
              code: relationshipValue.toLowerCase(),
              display: relationshipValue,
            },
          ],
        },
        status: 'active',
        class: coverageClass ? [coverageClass] : [],
        type: { coding: [INSURANCE_COVERAGE_CODING] },
        order: primary ? 1 : 2,
        beneficiary: { reference: `Patient/${patient.id}` },
        extension: insuranceData.additionalInfo
          ? [
              {
                url: 'insurance-note',
                valueString: insuranceData.additionalInfo,
              },
            ]
          : [],
      }),
      currentActiveCoverage
        ? oystehr.fhir.patch<Coverage>({
            resourceType: 'Coverage',
            id: currentActiveCoverage.id || '',
            operations: [{ op: 'replace', path: '/status', value: 'cancelled' }],
          })
        : Promise.resolve(),
    ]);
    coverage = createdCoverage;
  }

  return coverage;
};

const chooseBillingProviderId = (
  billingProviderGroupId: string | undefined,
  billingProviderIndividualId: string | undefined,
  payor: Organization
): string => {
  if (!billingProviderGroupId || !billingProviderIndividualId) {
    // This should never happen.
    throw new Error('Billing provider resource missing ID.');
  }

  const billingProviderToUse = payor.extension?.find(
    (extension) => extension.url === `${PRIVATE_EXTENSION_BASE_URL}/npi-type-needed`
  )?.valueString;
  return billingProviderToUse === 'group' ? billingProviderGroupId : billingProviderIndividualId;
};

interface CreateCoverageEligibilityRequestParameters {
  coverageId: string;
  oystehr: Oystehr;
  patientId?: string;
  payorId: string;
  providerId: string;
}

const createCoverageEligibilityRequest = async ({
  coverageId,
  oystehr,
  patientId,
  payorId,
  providerId,
}: CreateCoverageEligibilityRequestParameters): Promise<CoverageEligibilityRequest> => {
  const today = removeTimeFromDate(DateTime.now().toISO());

  const coverageEligibilityRequest: CoverageEligibilityRequest = {
    resourceType: 'CoverageEligibilityRequest',
    status: 'active',
    purpose: ['benefits'],
    created: today,
    servicedDate: today,
    patient: {
      reference: `Patient/${patientId}`,
    },
    insurer: {
      reference: `Organization/${payorId}`,
    },
    provider: {
      reference: `Practitioner/${providerId}`,
    },
    item: [
      {
        category: {
          coding: [
            {
              system: 'http://terminology.oystehr.com/CodeSystem/benefit-category',
              code: ELIGIBILITY_BENEFIT_CODES,
            },
          ],
        },
      },
    ],
    insurance: [
      {
        coverage: {
          reference: `Coverage/${coverageId}`,
        },
      },
    ],
  };
  return await oystehr.fhir.create<CoverageEligibilityRequest>(coverageEligibilityRequest);
};

const performEligibilityCheck = (
  coverageEligibilityRequestId: string | undefined,
  projectApiURL: string
): Promise<Response> => {
  return fetch(`${projectApiURL}/rcm/eligibility-check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({
      eligibilityRequestId: coverageEligibilityRequestId,
    }),
  });
};

const checkEligibility = async ({
  eligibilityCheckResponse,
  tagProps,
}: {
  eligibilityCheckResponse: PromiseFulfilledResult<Response> | PromiseSettledResult<Response>;
  tagProps: Omit<TagAppointmentWithEligibilityFailureReasonParameters, 'reason'>;
}): Promise<InsuranceEligibilityCheckStatus> => {
  const res = await parseEligibilityCheckResponse(eligibilityCheckResponse);
  if (res === InsuranceEligibilityCheckStatus.eligibilityConfirmed) {
    return res;
  }
  if (res === InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported) {
    console.log('Payer does not support real-time eligibility. Bypassing.');
    await tagAppointmentWithEligibilityFailureReason({
      ...tagProps,
      reason: ELIGIBILITY_FAILED_REASONS.realTimeEligibilityUnsupported,
    });
    return res;
  }
  if (res === InsuranceEligibilityCheckStatus.eligibilityNotChecked) {
    await tagAppointmentWithEligibilityFailureReason({
      ...tagProps,
      reason: ELIGIBILITY_FAILED_REASONS.apiFailure,
    });
  }

  return res;
};

interface TagAppointmentWithEligibilityFailureReasonParameters {
  appointment: Appointment;
  appointmentId: string;
  oystehr: Oystehr;
  reason: string;
}
// todo: not sure putting a meta tag on the appointment is the best thing to do here. probably better
// to return information about the outcome and let the handler decide what to do with that information
const tagAppointmentWithEligibilityFailureReason = async ({
  appointment,
  appointmentId,
  oystehr,
  reason,
}: TagAppointmentWithEligibilityFailureReasonParameters): Promise<void> => {
  const system = `${PRIVATE_EXTENSION_BASE_URL}/${ELIGIBILITY_FAILED_REASON_META_TAG}`;
  const index = appointment.meta?.tag?.findIndex((tag) => tag.system === system);

  await oystehr.fhir.patch<Appointment>({
    resourceType: 'Appointment',
    id: appointmentId,
    operations: [
      {
        op: 'add',
        path: `/meta/tag/${index === -1 ? 0 : index}`,
        value: {
          system,
          code: reason,
          display: reason,
        },
      },
    ],
  });
};
