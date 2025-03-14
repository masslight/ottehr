import { ZambdaInput } from 'zambda-utils';
import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';
import {
  Appointment,
  ChargeItem,
  Claim,
  Coverage,
  CoverageEligibilityResponse,
  Encounter,
  InsurancePlan,
  Location,
  Patient,
  PaymentReconciliation,
  Practitioner,
  Resource,
} from 'fhir/r4b';
import {
  ClaimsQueueGetRequest,
  ClaimsQueueGetResponse,
  ClaimsQueueItem,
  ClaimsQueueItemStatus,
  ClaimsQueueItemStatuses,
} from 'utils';
import { createReference, getResourcesFromBatchInlineRequests } from 'utils';
import {
  addCoverageAndRelatedResourcesToPackages,
  addInsuranceToResultPackages,
  getInsuranceNameFromCoverage,
} from './helpers/fhir-utils';
import { DateTime } from 'luxon';
import Oystehr from '@oystehr/sdk';

export interface ClaimPackage {
  appointment?: Appointment;
  location?: Location;
  coverage?: Coverage;
  assignee?: Practitioner;
  chargeItem?: ChargeItem;
  eligibilityResponse?: CoverageEligibilityResponse;
  claim?: Claim;
  paymentReconciliation?: PaymentReconciliation;
  paymentData?: any;
  status?: ClaimsQueueItemStatus | undefined;
  daysInQueue?: number;
  patient?: Patient;
  insurance?: InsurancePlan;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mtoken, validatedParameters.secrets);
    // const userToken = input.headers.Authorization.replace('Bearer ', '');
    console.log('Created zapToken and fhir client');

    const response = await performEffect(oystehr, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error(error, JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error trying to get claims.' }),
    };
  }
};

async function performEffect(oystehr: Oystehr, validatedInput: ClaimsQueueGetRequest): Promise<ClaimsQueueGetResponse> {
  const packages = await getPrefilteredClaimPackages(oystehr, validatedInput);
  const items: ClaimsQueueItem[] = [];
  packages.forEach((pkg) => {
    const {
      claim,
      appointment,
      coverage,
      chargeItem,
      eligibilityResponse,
      location,
      paymentData,
      status,
      patient,
      insurance,
    } = pkg;
    if (claim && claim.id && appointment && location && coverage && paymentData && status && patient) {
      items.push({
        id: claim?.id,
        appointment,
        location,
        coverage,
        assignee: undefined,
        claim,
        eligibilityResponse,
        chargeItem,
        paymentData,
        status,
        patient,
        insurancePlan: insurance,
      });
    }
  });
  return {
    items,
    offset: validatedInput.offset ?? 0,
    count: items.length,
  };
}

async function getPrefilteredClaimPackages(
  oystehr: Oystehr,
  validatedInput: ClaimsQueueGetRequest
): Promise<ClaimPackage[]> {
  const {
    offset,
    pageSize,
    claimId,
    visitId,
    patient,
    teamMember,
    facility,
    facilityGroup,
    insurance,
    dosFrom,
    dosTo,
    queue,
    status,
    dayInQueue,
    // balance,
  } = validatedInput;
  console.time('track-all');
  console.log('Getting first set of resources');
  let query = `/Claim?_include=Claim:encounter&_include=Claim:patient&_include:iterate=Encounter:appointment&_revinclude:iterate=ChargeItem:context&_include=Claim:facility`;
  if (pageSize) query = query.concat(`&_count=${pageSize}`);
  if (offset) query = query.concat(`&_offset=${offset}`);
  if (patient) query = query.concat(`&patient=${patient}`); // id
  if (claimId) query = query.concat(`&_id=${claimId}`);
  if (visitId) query = query.concat(`&encounter.appointment=${visitId}`);
  if (teamMember) query = query.concat(`&enterer=${teamMember}`);
  if (facility) query = query.concat(`&facility=${facility}`);
  if (facilityGroup) query = query.concat(`&facility.organization=${facilityGroup}`);
  if (dosFrom) query = query.concat(`&encounter.date=ge${dosFrom}`);
  if (dosTo) query = query.concat(`&encounter.date=le${dosTo}`);
  if (queue) query = query.concat(`&_tag=${queue}`);
  if (status) query = query.concat(`&_tag=${status}`);

  console.log('Query before searching resources: ', query);
  const resources = await getResourcesFromBatchInlineRequests(oystehr, [query]);
  console.log('Parsing claim resources into claims packages');
  let resultPackages = parseResourcesIntoClaimPackages(resources);
  console.log('Getting coverage and related resources to packages async');
  await addCoverageAndRelatedResourcesToPackages(oystehr, resultPackages);
  console.log('Add payment status to packages');
  addPaymentStatusToPackages(resultPackages);

  // console.log('Filter by balance');
  // if (balance) {
  //   resultPackages = resultPackages.filter((pkg) => (pkg.claim?.total?.value ?? 0) > balance);
  // }
  console.log('Filter by insurance name');
  if (insurance) {
    // here we are filtering claims packages by insurance name,
    // coverage resource contains insurance name in class.name property
    resultPackages = resultPackages.filter(
      (pkg) => pkg.coverage && getInsuranceNameFromCoverage(pkg.coverage) === insurance
    );
  }
  console.log('Filter by day in queue');
  if (dayInQueue) {
    console.log('Adding day in queue to packages');
    addDayInQueueToClaimPackages(resultPackages);
    console.log('Filtering');
    resultPackages = resultPackages.filter((pkg) => pkg.daysInQueue === dayInQueue);
  }

  // todo: think about making pagination at the end, after we processed all resources and getting as much as we need

  await addInsuranceToResultPackages(oystehr, resultPackages);
  console.timeEnd('track-all');
  return resultPackages;
}

function addPaymentStatusToPackages(packages: ClaimPackage[]): void {
  packages.forEach((pkg) => {
    const payment = pkg.paymentReconciliation;
    if (payment) {
      console.log(`PaymentReconciliation: ${payment.id} for appointment: ${pkg.appointment?.id}`);
      if (payment.status === 'active' && payment.outcome === 'complete' && payment.disposition !== 'authorized') {
        // it's a pending charge here, according to Roberts words
        pkg.paymentData = { paymentStatus: 'pending' };
      } else if (
        payment.status === 'active' &&
        payment.outcome === 'complete' &&
        payment.disposition === 'authorized'
      ) {
        // fully paid
        pkg.paymentData = { paymentStatus: 'pully paid' };
      } else if (payment.status === 'cancelled' && payment.outcome === 'complete') {
        // refunded
        pkg.paymentData = { paymentStatus: 'refunded' };
      }
    } else {
      // not paid
      pkg.paymentData = { paymentStatus: 'not paid' };
    }
  });
}

function getClaimStatusFromTag(claim: Claim): ClaimsQueueItemStatus {
  const status = claim.meta?.tag?.find((tag) => tag.system === 'current-status')?.code;
  if (status && ClaimsQueueItemStatuses.find((el) => el === status)) return status as ClaimsQueueItemStatus;
  return 'open';
}

function getClaimDaysInQueue(claim: Claim): number {
  const queueHistoryExtension = claim.extension?.find((ext) => ext.url === 'queue-history');
  const lastQueueElement = queueHistoryExtension?.extension?.[queueHistoryExtension.extension.length - 1];
  const lastQueueRecordStartTimeIso = lastQueueElement?.extension?.find((ext) => ext.url === 'period')?.valuePeriod
    ?.start;
  if (lastQueueRecordStartTimeIso) {
    const lastRecordStart = DateTime.fromISO(lastQueueRecordStartTimeIso);
    return DateTime.now().diff(lastRecordStart, 'days').days;
  }
  return 0;
}

function addDayInQueueToClaimPackages(packages: ClaimPackage[]): void {
  packages.forEach((pkg) => {
    if (pkg.claim) pkg.daysInQueue = getClaimDaysInQueue(pkg.claim);
  });
}

function parseResourcesIntoClaimPackages(resources: Resource[]): ClaimPackage[] {
  const resultPackages: ClaimPackage[] = [];
  const claims = resources.filter((res) => res.resourceType === 'Claim') as Claim[];
  claims.forEach((claim) => {
    let appointment: Appointment | undefined;
    let chargeItem: ChargeItem | undefined;
    let location: Location | undefined;

    const encounter = resources.find(
      (res) =>
        res.resourceType === 'Encounter' &&
        claim.item?.find((item) => item.encounter?.find((enc) => enc.reference === createReference(res).reference))
    ) as Encounter;
    if (claim.facility?.reference)
      location = resources.find((res) => claim.facility?.reference === createReference(res).reference) as Location;
    if (encounter) {
      appointment = resources.find(
        (res) => encounter.appointment?.find((appt) => appt.reference === createReference(res).reference)
      ) as Appointment;
      chargeItem = resources.find(
        (res) =>
          res.resourceType === 'ChargeItem' &&
          (res as ChargeItem).context?.reference === createReference(encounter).reference
      ) as ChargeItem;
    }
    const patient = resources.find(
      (res) => res.resourceType === 'Patient' && claim.patient.reference === createReference(res).reference
    ) as Patient;
    const status = getClaimStatusFromTag(claim);

    resultPackages.push({
      claim,
      appointment,
      chargeItem,
      location,
      status,
      patient,
    });
  });
  return resultPackages;
}
