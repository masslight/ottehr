import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { CandidApi } from 'candidhealth';
import {
  Appointment,
  Coverage,
  Encounter,
  Location,
  Organization,
  Patient,
  RelatedPerson,
  Resource,
  Schedule,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createCandidApiClient,
  formatDateToMDYWithTime,
  getMemberIdFromCoverage,
  getPayerId,
  getSecret,
  Secrets,
  SecretsKeys,
  StatementDetails,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { getDefaultBillingProviderResource } from '../../patient/get-eligibility/validation';
import { getCandidEncounterIdFromEncounter } from '../candid';
import { getLogoBase64 } from './get-logo-base64';

export type StatementType = 'standard' | 'past-due' | 'final-notice';

interface StatementResources {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
  location: Location | undefined;
}

interface StatementInsuranceDetails {
  payerName: string;
  memberId: string;
}

interface StatementBillerDetails {
  name: string;
  addressLine1: string;
  addressLine2: string | undefined;
  city: string;
  provinceOrState: string;
  postalOrZip: string;
  countryCode: string | 'US';
  website: string;
  email: string;
}

interface StatementLineDetails {
  serviceLines: StatementDetails['service'];
  totals: StatementDetails['totals'];
}

interface GetStatementDetailsInput {
  encounterId: string;
  statementType: StatementType;
  secrets: Secrets;
  oystehr: Oystehr;
}

const UNKNOWN_BILLER_VALUE = 'unknown';

const getResources = async (encounterId: string, oystehr: Oystehr): Promise<StatementResources> => {
  const items: Array<Appointment | Encounter | Patient | Location | Schedule> = (
    await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Schedule>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
      ],
    })
  ).unbundle();

  const appointment = items.find((item: Resource) => item.resourceType === 'Appointment') as Appointment | undefined;
  if (!appointment) throw new Error('Appointment not found');

  const encounter = items.find((item: Resource) => item.resourceType === 'Encounter') as Encounter | undefined;
  if (!encounter) throw new Error('Encounter not found');

  const patient = items.find((item: Resource) => item.resourceType === 'Patient') as Patient | undefined;
  if (!patient) throw new Error('Patient not found');

  const location = items.find((item: Resource) => item.resourceType === 'Location') as Location | undefined;

  return {
    appointment,
    encounter,
    patient,
    location,
  };
};

function getDateOfBirth(birthDate?: string): string {
  if (!birthDate) return '';
  return DateTime.fromISO(birthDate).toFormat('MM/dd/yyyy');
}

function getInsuranceDetails(
  coverages: { primary?: Coverage; secondary?: Coverage },
  insuranceOrgs: Organization[]
): StatementInsuranceDetails {
  const coverage = coverages.primary ?? coverages.secondary;
  if (!coverage) {
    return {
      payerName: '',
      memberId: '',
    };
  }

  const payorReference = coverage.payor?.[0]?.reference;
  const payerOrgByReference = payorReference
    ? insuranceOrgs.find((org) => `Organization/${org.id}` === payorReference)
    : undefined;
  const payerOrgByPayerId = coverage.class?.[0]?.value
    ? insuranceOrgs.find((org) => getPayerId(org) === coverage.class?.[0]?.value)
    : undefined;
  const payerOrg = payerOrgByReference ?? payerOrgByPayerId;

  return {
    payerName: payerOrg?.name ?? '',
    memberId: getMemberIdFromCoverage(coverage) ?? coverage.subscriberId ?? '',
  };
}

function getBillerDetails(billingResource: Organization): StatementBillerDetails {
  const fallback: StatementBillerDetails = {
    name: UNKNOWN_BILLER_VALUE,
    addressLine1: UNKNOWN_BILLER_VALUE,
    addressLine2: undefined,
    city: UNKNOWN_BILLER_VALUE,
    provinceOrState: UNKNOWN_BILLER_VALUE,
    postalOrZip: UNKNOWN_BILLER_VALUE,
    countryCode: 'US',
    website: UNKNOWN_BILLER_VALUE,
    email: UNKNOWN_BILLER_VALUE,
  };

  const billingAddress = [billingResource.address]
    .flatMap((address) => address ?? [])
    .find((address) => address.type === 'postal' && address.use === 'work');
  const fallbackAddress = [billingResource.address].flatMap((address) => address ?? [])[0];
  const address = billingAddress ?? fallbackAddress;

  const website = billingResource.telecom?.find((contact) => contact.system === 'url')?.value;
  const email = billingResource.telecom?.find((contact) => contact.system === 'email')?.value;

  return {
    name: getBillerName(billingResource) ?? fallback.name,
    addressLine1: address?.line?.[0] ?? fallback.addressLine1,
    addressLine2: address?.line?.[1] ?? fallback.addressLine2,
    city: address?.city ?? fallback.city,
    provinceOrState: address?.state ?? fallback.provinceOrState,
    postalOrZip: address?.postalCode ?? fallback.postalOrZip,
    countryCode: address?.country ?? fallback.countryCode,
    website: website ?? fallback.website,
    email: email ?? fallback.email,
  };
}

function getBillerName(billingResource: Organization): string {
  return billingResource.name ?? UNKNOWN_BILLER_VALUE;
}

function formatMoney(cents: number | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

async function getServiceLines(encounter: Encounter, secrets: Secrets): Promise<StatementLineDetails> {
  const encounterId = encounter.id;
  if (!encounterId) {
    throw new Error('Encounter id is missing');
  }

  const candidEncounterId = getCandidEncounterIdFromEncounter(encounter);
  if (!candidEncounterId) {
    throw new Error(`Candid encounter id is missing for "Encounter/${encounterId}"`);
  }

  const candid = createCandidApiClient(secrets);
  const candidEncounterResponse = await candid.encounters.v4.get(CandidApi.EncounterId(candidEncounterId));

  const candidClaimId =
    candidEncounterResponse && candidEncounterResponse.ok
      ? candidEncounterResponse.body?.claims?.[0]?.claimId
      : undefined;

  if (!candidClaimId) {
    throw new Error(`Candid encounter "${candidEncounterId}" has no claim`);
  }

  const candidClaimResponse = await candid.patientAr.v1.itemize(CandidApi.ClaimId(candidClaimId));
  const itemizationResponse = candidClaimResponse && candidClaimResponse.ok ? candidClaimResponse.body : undefined;

  if (!itemizationResponse) {
    throw new Error('Failed to get itemization response');
  }

  const serviceLines = await Promise.all(
    itemizationResponse.serviceLineItemization.map(async (serviceLine) => {
      const chargeAfterAdjustments =
        serviceLine.chargeAmountCents - serviceLine.insuranceAdjustments.totalAdjustmentCents;
      const insurancePaid = serviceLine.insurancePayments.totalPaymentCents;
      const patientPaid = serviceLine.patientPayments.totalPaymentCents;
      const patientOwes = serviceLine.patientBalanceCents;

      return {
        cpt: serviceLine.procedureCode,
        description: await getProcedureCodeTitle(serviceLine.procedureCode, secrets),
        charged: formatMoney(chargeAfterAdjustments),
        insurancePaid: formatMoney(insurancePaid),
        patientPaid: formatMoney(patientPaid),
        patientOwes: formatMoney(patientOwes),
      };
    })
  );

  const totalsCents = itemizationResponse.serviceLineItemization.reduce(
    (acc, serviceLine) => {
      const chargeAfterAdjustments =
        serviceLine.chargeAmountCents - serviceLine.insuranceAdjustments.totalAdjustmentCents;
      acc.charged += chargeAfterAdjustments;
      acc.insurancePaid += serviceLine.insurancePayments.totalPaymentCents;
      acc.patientPaid += serviceLine.patientPayments.totalPaymentCents;
      acc.balanceDue += serviceLine.patientBalanceCents;
      acc.deductible += serviceLine.deductibleCents ?? 0;
      return acc;
    },
    {
      charged: 0,
      insurancePaid: 0,
      patientPaid: 0,
      balanceDue: 0,
      deductible: 0,
    }
  );

  return {
    serviceLines,
    totals: {
      charged: formatMoney(totalsCents.charged),
      insurancePaid: formatMoney(totalsCents.insurancePaid),
      patientPaid: formatMoney(totalsCents.patientPaid),
      deductible: formatMoney(totalsCents.deductible),
      balanceDue: formatMoney(totalsCents.balanceDue),
    },
  };
}

async function getProcedureCodeTitle(code: string, secrets: Secrets): Promise<string> {
  const apiKey = getSecret(SecretsKeys.NLM_API_KEY, secrets);
  const names = await Promise.all([searchCodeName(code, 'HCPT', apiKey), searchCodeName(code, 'HCPCS', apiKey)]);
  const name = names.find((entry) => entry != null);
  return name ? `${code} - ${name}` : code;
}

async function searchCodeName(code: string, sabs: string, apiKey: string): Promise<string | undefined> {
  const response = await fetch(
    `https://uts-ws.nlm.nih.gov/rest/search/current?apiKey=${apiKey}&returnIdType=code&inputType=code&string=${code}&sabs=${sabs}&partialSearch=true&searchType=rightTruncation`
  );
  if (!response.ok) {
    return undefined;
  }
  const responseBody = (await response.json()) as {
    result: {
      results: {
        ui: string;
        name: string;
      }[];
    };
  };
  return responseBody.result.results.find((entry) => entry)?.name;
}

function createStatementDetails(
  input: GetStatementDetailsInput,
  resources: StatementResources,
  guarantorResource: RelatedPerson | Patient,
  insuranceDetails: StatementInsuranceDetails,
  billerDetails: StatementBillerDetails,
  serviceLines: StatementDetails['service'],
  totals: StatementDetails['totals'],
  paymentUrl: string
): StatementDetails {
  const { statementType } = input;
  const pastDue = statementType === 'past-due' || statementType === 'final-notice';
  const finalNotice = statementType === 'final-notice';
  const logoBase64 = getLogoBase64();
  const { patient, location, appointment } = resources;
  const statementNumber = appointment.id ?? 'unknown';
  const patientName = patient.name?.[0];
  const guarantorName = guarantorResource.name?.[0];
  const guarantorAddress = guarantorResource.address?.[0];
  const { date: visitDate = '', time: visitTime = '' } = formatDateToMDYWithTime(
    appointment?.start,
    'America/New_York'
  ) ?? { date: '', time: '' };

  const today = DateTime.now();
  const patientFirstName = patientName?.given?.[0] ?? '';
  const patientLastName = patientName?.family ?? '';

  return {
    respParty: {
      firstName: guarantorName?.given?.[0] ?? '',
      lastName: guarantorName?.family ?? '',
      addressLine1: guarantorAddress?.line?.[0] ?? '',
      addressLine2: guarantorAddress?.line?.[1] ?? '',
      city: guarantorAddress?.city ?? '',
      provinceOrState: guarantorAddress?.state ?? '',
      postalOrZip: guarantorAddress?.postalCode ?? '',
      countryCode: guarantorAddress?.country ?? 'US',
    },
    pastDue,
    finalNotice,
    statement: {
      number: statementNumber,
      issueDate: today.toFormat('MMMM d, yyyy'),
      dueDate: today.plus({ days: 30 }).toFormat('MMMM d, yyyy'),
    },
    patient: {
      firstName: patientFirstName,
      lastName: patientLastName,
      dob: getDateOfBirth(patient.birthDate),
    },
    insurance: {
      payerName: insuranceDetails.payerName,
      memberId: insuranceDetails.memberId,
    },
    visit: {
      date: visitDate,
      time: visitTime,
    },
    facility: {
      name: location?.name ?? '',
    },
    service: serviceLines,
    totals,
    payment: {
      url: paymentUrl,
    },
    biller: {
      name: billerDetails.name,
      addressLine1: billerDetails.addressLine1,
      addressLine2: billerDetails.addressLine2,
      city: billerDetails.city,
      provinceOrState: billerDetails.provinceOrState,
      postalOrZip: billerDetails.postalOrZip,
      countryCode: billerDetails.countryCode,
      website: billerDetails.website,
      email: billerDetails.email,
      logoBase64,
    },
  };
}

export async function getStatementDetails(input: GetStatementDetailsInput): Promise<StatementDetails> {
  const { encounterId, secrets, oystehr } = input;
  const resources = await getResources(encounterId, oystehr);
  const { guarantorResource, coverages, insuranceOrgs } = await getAccountAndCoverageResourcesForPatient(
    resources.patient.id ?? '',
    oystehr
  );

  if (!guarantorResource) {
    throw new Error(`Guarantor resource not found for Patient/${resources.patient.id}`);
  }

  const insuranceDetails = getInsuranceDetails(coverages, insuranceOrgs);
  const { serviceLines, totals } = await getServiceLines(resources.encounter, secrets);
  const paymentUrl = getSecret(SecretsKeys.PATIENT_LOGIN_REDIRECT_URL, secrets);

  let billerDetails: StatementBillerDetails = {
    name: UNKNOWN_BILLER_VALUE,
    addressLine1: UNKNOWN_BILLER_VALUE,
    addressLine2: UNKNOWN_BILLER_VALUE,
    city: UNKNOWN_BILLER_VALUE,
    provinceOrState: UNKNOWN_BILLER_VALUE,
    postalOrZip: UNKNOWN_BILLER_VALUE,
    countryCode: 'US',
    website: UNKNOWN_BILLER_VALUE,
    email: UNKNOWN_BILLER_VALUE,
  };
  try {
    const defaultBillingResource = await getDefaultBillingProviderResource(secrets, oystehr);
    if (defaultBillingResource.resourceType !== 'Organization') {
      throw new Error(
        `DEFAULT_BILLING_RESOURCE must reference an Organization for statements. Received ${defaultBillingResource.resourceType}.`
      );
    }

    billerDetails = getBillerDetails(defaultBillingResource);
  } catch (error: unknown) {
    captureException(error);
    console.error(
      'Failed to resolve default billing resource for statement details; using unknown biller fields',
      error
    );
  }

  return createStatementDetails(
    input,
    resources,
    guarantorResource,
    insuranceDetails,
    billerDetails,
    serviceLines,
    totals,
    paymentUrl
  );
}
