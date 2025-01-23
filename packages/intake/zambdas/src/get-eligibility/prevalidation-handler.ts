import {
  Address,
  Bundle,
  Coverage,
  CoverageClass,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  InsurancePlan,
  Organization,
  RelatedPerson,
} from 'fhir/r4b';
import {
  createFhirHumanName,
  GetEligibilityInput,
  GetEligibilityInsuranceData,
  GetEligibilityPolicyHolder,
  INSURANCE_COVERAGE_CODING,
  InsuranceEligibilityPrevalidationInput,
  InsurancePlanDTO,
} from 'utils';
import { createInsurancePlanDto, CreateRelatedPersonObject } from '../shared';
import { randomUUID } from 'crypto';
import {
  getInsurancePlansAndOrgs,
  makeCoverageEligibilityRequest,
  parseEligibilityCheckResponse,
  performEligibilityCheck,
} from './helpers';
import Oystehr from '@oystehr/sdk';
import { complexBillingProviderValidation, validateInsuranceRequirements } from './validation';

interface Input extends Omit<GetEligibilityInput, 'coveragePrevalidationInput'> {
  coveragePrevalidationInput: InsuranceEligibilityPrevalidationInput;
  apiUrl: string;
  accessToken: string;
}

export const prevalidationHandler = async (
  input: Input,
  oystehrClient: Oystehr
): Promise<Record<string, CoverageEligibilityResponse>> => {
  const {
    // appointmentId,
    primaryInsuranceData,
    patientId,
    primaryPolicyHolder,
    secondaryInsuranceData,
    secondaryPolicyHolder,
    coveragePrevalidationInput,
    apiUrl,
    accessToken,
  } = input;

  const billingProviderData = await complexBillingProviderValidation(coveragePrevalidationInput, oystehrClient);

  console.log('billingProviderData', JSON.stringify(billingProviderData));

  const rps = [makeRP({ patientId, relatedPersonData: primaryPolicyHolder, generateId: true })];
  if (secondaryInsuranceData && secondaryPolicyHolder) {
    rps.push(
      makeRP({
        patientId,
        relatedPersonData: secondaryPolicyHolder,
        generateId: true,
      })
    );
  }

  console.log('rps: ', JSON.stringify(rps));

  const [primary, secondary] = await getInsurancePlansAndOrgs(
    {
      primary: primaryInsuranceData.insuranceId,
      secondary: secondaryInsuranceData?.insuranceId,
    },
    oystehrClient
  );

  console.log('primary and secondary insurances: ', primary, secondary);

  const primaryInsurancePlanRequirements = createInsurancePlanDto(primary.insurancePlan);
  let secondaryInsurancePlanRequirements: InsurancePlanDTO | undefined;

  validateInsuranceRequirements({
    insurancePlanDto: primaryInsurancePlanRequirements,
    insuranceData: primaryInsuranceData,
    policyHolder: primaryPolicyHolder,
    primary: true,
  });

  if (secondary?.insurancePlan && secondaryInsuranceData && secondaryPolicyHolder) {
    try {
      secondaryInsurancePlanRequirements = createInsurancePlanDto(secondary.insurancePlan);
      validateInsuranceRequirements({
        insurancePlanDto: secondaryInsurancePlanRequirements,
        insuranceData: secondaryInsuranceData,
        policyHolder: secondaryPolicyHolder,
        primary: false,
      });
    } catch (error: any) {
      console.error(error);
      secondaryInsurancePlanRequirements = undefined;
    }
  }

  console.log('primary insurance plan requirements', primaryInsurancePlanRequirements);

  const coverages = [
    makeCoverage({
      insuranceData: primaryInsuranceData,
      insurancePlan: primary.insurancePlan,
      patientId,
      payor: primary.organization,
      policyHolder: primaryPolicyHolder,
      relatedPerson: rps[0],
      primary: true,
    }),
  ];

  if (secondaryInsuranceData && secondaryPolicyHolder && secondary && rps.length > 1) {
    coverages.push(
      makeCoverage({
        insuranceData: secondaryInsuranceData,
        insurancePlan: secondary.insurancePlan,
        policyHolder: secondaryPolicyHolder,
        patientId,
        payor: secondary.organization,
        relatedPerson: rps[1],
        primary: false,
      })
    );
  }

  console.log('coverage 1', JSON.stringify(coverages[0], null, 2));

  const eligibilityRequests = coverages.map((coverage, idx) => {
    const isPrimary = idx === 0;
    const id = isPrimary ? 'covPrimary' : 'covSecondary';
    coverage.id = id;
    const coverageReference = `#${coverage.id}`;
    const patientReference = `Patient/${patientId}`;
    const payorReference = `Organization/${isPrimary ? primary.organization.id : secondary.organization.id}`;
    const providerReference = `${billingProviderData.resourceType}/${billingProviderData.id}`;

    const CER = makeCoverageEligibilityRequest({
      coverageReference,
      payorReference,
      providerReference,
      patientReference,
      contained: [coverage, rps[idx]],
    });
    console.log('CER', JSON.stringify(CER, null, 2));
    return CER;
  });

  const batchResults = (await oystehrClient.fhir.batch({
    requests: eligibilityRequests.map((cer) => {
      return {
        method: 'POST',
        url: '/CoverageEligibilityRequest',
        resource: cer,
      };
    }),
  })) as Bundle<CoverageEligibilityRequest>;

  console.log('batchResults', JSON.stringify(batchResults, null, 2));

  const requestIds = batchResults.entry?.flatMap((e) => e?.resource?.id ?? []) ?? [];

  console.log('requestIds', requestIds);

  const results = await Promise.allSettled(
    requestIds.map((reqId) => {
      return performEligibilityCheck(reqId, apiUrl, accessToken);
    })
  );
  console.log('results', JSON.stringify(results, null, 2));
  const eligibilityVerdicts = await Promise.all(
    results.map((p) => (p.status === 'fulfilled' ? parseEligibilityCheckResponse(p) : false))
  );

  console.log('eligibility verdicts', eligibilityVerdicts);
  throw new Error('This just isnt done yet, sorry');

  // create the EligibilityRequest resources
};

interface CoverageInput {
  insuranceData: GetEligibilityInsuranceData;
  insurancePlan: InsurancePlan;
  policyHolder: GetEligibilityPolicyHolder;
  patientId: string;
  payor: Organization;
  relatedPerson: RelatedPerson;
  primary: boolean;
}
const makeCoverage = (input: CoverageInput): Coverage => {
  const { insuranceData, insurancePlan, policyHolder, patientId, payor, relatedPerson, primary } = input;
  const subscriber = {
    reference: '',
  };
  if (policyHolder.isPatient) {
    subscriber.reference = `Patient/${patientId}`;
  } else {
    subscriber.reference = `#${relatedPerson.id}`;
  }
  const relationship = policyHolder.relationship;

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

  // const contained = [relatedPerson, insurancePlan, payor];

  return {
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
          code: relationship?.toLowerCase(),
          display: relationship,
        },
      ],
    },
    status: 'active',
    class: coverageClass ? [coverageClass] : [],
    type: { coding: [INSURANCE_COVERAGE_CODING] },
    order: primary ? 1 : 2,
    beneficiary: { reference: `Patient/${patientId}` },
    extension: insuranceData.additionalInfo
      ? [
          {
            url: 'insurance-note',
            valueString: insuranceData.additionalInfo,
          },
        ]
      : [],
  };
};

interface MakeRPInput {
  patientId: string;
  relatedPersonData: CreateRelatedPersonObject;
  generateId?: boolean;
}
const makeRP = (input: MakeRPInput): RelatedPerson => {
  const { patientId, relatedPersonData: data, generateId } = input;
  let code = '';
  switch (data.relationship) {
    case 'Father':
      code = 'FTH';
      break;
    case 'Mother':
      code = 'MTH';
      break;
    case 'Parent':
      code = 'PRN';
      break;
    case 'Spouse':
      code = 'SPS';
      break;
    case 'Sibling':
      code = 'SIB';
      break;
    case 'Other':
      code = 'O';
      break;
    default:
      code = 'CHILD';
      break;
  }

  const address: Address[] = [
    {
      line: data.address ? [data.address] : [],
      city: data.city,
      state: data.state,
      postalCode: data.zip,
      country: 'US',
    },
  ];

  const relatedPerson: RelatedPerson = {
    resourceType: 'RelatedPerson',
    patient: { reference: `Patient/${patientId}` }, // is this valid?
    id: generateId ? randomUUID() : undefined,
    name: createFhirHumanName(data.firstName, data.middleName, data.lastName),
    birthDate: data.dob,
    gender: getGender(data.sex),
    address,
    relationship: [
      {
        coding: [
          {
            code,
            display: data.relationship ? data.relationship : 'Child',
            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
          },
        ],
      },
    ],
  };
  return relatedPerson;
};

const getGender = (sex: string | undefined): 'male' | 'female' | 'unknown' | 'other' => {
  if (sex != undefined) {
    switch (sex.toLowerCase()) {
      case 'male':
        return 'male';
      case 'female':
        return 'female';
      case 'unknown':
        return 'unknown';
      default:
        return 'other';
    }
  }
  return 'unknown';
};
