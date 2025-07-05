import Oystehr from '@oystehr/sdk';
import {
  Address,
  Bundle,
  Coverage,
  CoverageClass,
  CoverageEligibilityRequest,
  FhirResource,
  Organization,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BillingProviderDataObject,
  createFhirHumanName,
  GetEligibilityInsuranceData,
  GetEligibilityPolicyHolder,
  GetEligibilityResponse,
  INSURANCE_COVERAGE_CODING,
  InsuranceEligibilityCheckStatus,
  InsurancePlanDTO,
  Secrets,
} from 'utils';
import { createInsurancePlanDto, CreateRelatedPersonObject } from '../../shared';
import {
  getInsurancePlansAndOrgs,
  makeCoverageEligibilityRequest,
  parseEligibilityCheckResponsePromiseResult,
} from './helpers';
import {
  complexBillingProviderValidation,
  EligibilityCheckPrevalidationStructuredInput,
  validateInsuranceRequirements,
} from './validation';

interface Input extends EligibilityCheckPrevalidationStructuredInput {
  apiUrl: string;
  accessToken: string;
  secrets: Secrets | null;
}

export const prevalidationHandler = async (input: Input, oystehrClient: Oystehr): Promise<GetEligibilityResponse> => {
  const {
    appointmentId,
    primaryInsuranceData,
    patientId,
    primaryPolicyHolder,
    secondaryInsuranceData,
    secondaryPolicyHolder,
    apiUrl,
    accessToken,
  } = input;

  console.log('primary policy holder', JSON.stringify(primaryPolicyHolder), null, 2);

  const rps: RelatedPerson[] = [];
  if (primaryPolicyHolder && primaryPolicyHolder.isPatient === false) {
    rps.push(makeRP({ patientId, relatedPersonData: primaryPolicyHolder, id: 'primaryRP' }));
  }
  if (secondaryInsuranceData && secondaryPolicyHolder && secondaryPolicyHolder.isPatient === false) {
    rps.push(
      makeRP({
        patientId,
        relatedPersonData: secondaryPolicyHolder,
        id: 'secondaryRP',
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

  const primaryInsurancePlanRequirements = createInsurancePlanDto(primary);
  let secondaryInsurancePlanRequirements: InsurancePlanDTO | undefined;

  console.log('primaryPolicyHolder', JSON.stringify(primaryPolicyHolder, null, 2));
  validateInsuranceRequirements({
    insurancePlanDto: primaryInsurancePlanRequirements,
    insuranceData: primaryInsuranceData,
    policyHolder: primaryPolicyHolder,
    primary: true,
  });

  if (secondary && secondaryInsuranceData && secondaryPolicyHolder) {
    try {
      secondaryInsurancePlanRequirements = createInsurancePlanDto(secondary);
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
      patientId,
      payor: primary,
      policyHolder: primaryPolicyHolder,
      relatedPerson: rps[0],
      primary: true,
    }),
  ];

  let billingProviderData: BillingProviderDataObject;
  try {
    /*
      for some use cases it might make more sense to go fetch the billing provider data from Candid,
      in which case a contained resource would be created and added to the eligibility requests contained resources,
      rather than attempting to get a reference to some resource in the FHIR db here. 
    */
    billingProviderData = await complexBillingProviderValidation(
      { primary, secondary },
      appointmentId ?? '',
      input.secrets ?? null,
      oystehrClient
    );
  } catch (e) {
    console.log('error getting billing provider data', e);
    throw e;
  }
  console.log('billingProviderData', JSON.stringify(billingProviderData), null, 2);

  if (secondaryInsuranceData && secondaryPolicyHolder && secondary && rps.length > 1 && billingProviderData.secondary) {
    coverages.push(
      makeCoverage({
        insuranceData: secondaryInsuranceData,
        policyHolder: secondaryPolicyHolder,
        patientId,
        payor: secondary,
        relatedPerson: rps[1],
        primary: false,
      })
    );
  }

  console.log('coverage 1', JSON.stringify(coverages[0], null, 2));

  const eligibilityRequests = coverages.map((coverage, idx) => {
    const isPrimary = idx === 0;
    let providerReference = '';
    if (isPrimary) {
      providerReference = `${billingProviderData.primary.resourceType}/${billingProviderData.primary.id}`;
    } else if (billingProviderData.secondary) {
      providerReference = `${billingProviderData.secondary.resourceType}/${billingProviderData.secondary.id}`;
    }
    const id = isPrimary ? 'covPrimary' : 'covSecondary';
    coverage.id = id;
    const coverageReference = `#${coverage.id}`;
    const patientReference = `Patient/${patientId}`;
    const payorReference = `Organization/${isPrimary ? primary.id : secondary.id}`;
    const contained: FhirResource[] = [coverage];
    if (rps[idx]) {
      contained.push(rps[idx]);
    }
    const CER = makeCoverageEligibilityRequest({
      coverageReference,
      payorReference,
      providerReference,
      patientReference,
      contained,
    });
    console.log('CER', JSON.stringify(CER, null, 2));
    console.log('END CER');
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

  const dateISO = DateTime.now().toISO();
  if (requestIds.length < coverages.length) {
    return {
      primary: { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO },
      secondary:
        coverages.length === 2 ? { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO } : undefined,
    };
  }

  console.log('requestIds', requestIds);

  const results = await Promise.allSettled(
    requestIds.map((reqId) => {
      return performEligibilityCheck(reqId, apiUrl, accessToken);
    })
  );
  console.log('results', JSON.stringify(results, null, 2));
  const eligibilityVerdicts = await Promise.all(results.map((p) => parseEligibilityCheckResponsePromiseResult(p)));

  console.log('eligibility verdicts', eligibilityVerdicts, results.length);

  const res: GetEligibilityResponse = { primary: eligibilityVerdicts[0] };
  if (eligibilityVerdicts.length > 1) {
    res.secondary = eligibilityVerdicts[1];
  }
  console.log('eligibility result', JSON.stringify(res, null, 2));
  return res;
};

interface CoverageInput {
  insuranceData: GetEligibilityInsuranceData;
  policyHolder: GetEligibilityPolicyHolder;
  patientId: string;
  payor: Organization;
  relatedPerson: RelatedPerson;
  primary: boolean;
}
const makeCoverage = (input: CoverageInput): Coverage => {
  const { insuranceData, policyHolder, patientId, payor, relatedPerson, primary } = input;
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
      name: payor.name,
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
  };
};

interface MakeRPInput {
  patientId: string;
  relatedPersonData: CreateRelatedPersonObject;
  id: 'primaryRP' | 'secondaryRP';
}
const makeRP = (input: MakeRPInput): RelatedPerson => {
  const { patientId, relatedPersonData: data, id } = input;
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
    id,
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
const performEligibilityCheck = (
  coverageEligibilityRequestId: string | undefined,
  projectApiURL: string,
  oystehrToken: string
): Promise<Response> => {
  return fetch(`${projectApiURL}/rcm/eligibility-check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${oystehrToken}`,
    },
    body: JSON.stringify({
      eligibilityRequestId: coverageEligibilityRequestId,
    }),
  });
};
