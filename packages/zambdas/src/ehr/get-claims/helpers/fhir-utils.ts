import Oystehr from '@oystehr/sdk';
import { Coverage, CoverageEligibilityResponse, InsurancePlan, PaymentReconciliation } from 'fhir/r4b';
import { getInsuranceNameFromCoverage, getResourcesFromBatchInlineRequests } from 'utils';
import {
  AppointmentInsuranceRelatedResRefs,
  getInsuranceRelatedRefsFromAppointmentExtension,
} from '../../../shared/appointment/helpers';
import { ClaimPackage } from '../index';

export function createSearchUrlFromReference(inputReference: string): string {
  const parsedReference = inputReference.split('/');
  const resourceType = parsedReference[0];
  const id = parsedReference[1];
  return `${resourceType}?_id=${id}`;
}

export async function addCoverageAndRelatedResourcesToPackages(
  oystehr: Oystehr,
  packages: ClaimPackage[]
): Promise<void> {
  const appointmentIdToResourcesRefsMap: Record<string, AppointmentInsuranceRelatedResRefs> = {};
  const requests: string[] = [];
  packages.forEach((pkg) => {
    if (pkg.appointment && pkg.appointment.id) {
      const resourcesRefs = getInsuranceRelatedRefsFromAppointmentExtension(pkg.appointment);
      // console.log('all resources refs: ', JSON.stringify(resourcesRefs));
      appointmentIdToResourcesRefsMap[pkg.appointment.id] = resourcesRefs;
      const paymentReconciliationRef = pkg.chargeItem?.supportingInformation?.find(
        (info) => info.type === 'PaymentReconciliation'
      )?.reference;

      if (paymentReconciliationRef) requests.push(createSearchUrlFromReference(paymentReconciliationRef));
      if (resourcesRefs.primaryCoverage) requests.push(createSearchUrlFromReference(resourcesRefs.primaryCoverage));
      if (resourcesRefs.primaryCoverageEligibilityResponse)
        requests.push(createSearchUrlFromReference(resourcesRefs.primaryCoverageEligibilityResponse));

      // This code to search all coverage resources from all fields
      // for (const ref in resourcesRefs) {
      //   requests.push(createSearchUrlFromReference(ref));
      // }
    }
  });
  console.log('Requests to get all coverages and related resources: ', JSON.stringify(requests));
  const batchResponse = await getResourcesFromBatchInlineRequests(oystehr, requests);
  // console.log('resources we received: ', JSON.stringify(batchResponse));
  packages.forEach((pkg) => {
    if (pkg.appointment && pkg.appointment.id) {
      const resourcesRefs = appointmentIdToResourcesRefsMap[pkg.appointment.id];
      const primaryCoverageId = resourcesRefs.primaryCoverage?.split('/')[1];
      const primaryEligibilityResponseId = resourcesRefs.primaryCoverageEligibilityResponse?.split('/')[1];
      const paymentReconciliationId = pkg.chargeItem?.supportingInformation
        ?.find((info) => info.type === 'PaymentReconciliation')
        ?.reference?.split('/')[1];

      if (primaryCoverageId) pkg.coverage = batchResponse.find((res) => res.id === primaryCoverageId) as Coverage;
      if (primaryEligibilityResponseId)
        pkg.eligibilityResponse = batchResponse.find(
          (res) => res.id === primaryEligibilityResponseId
        ) as CoverageEligibilityResponse;
      if (paymentReconciliationId)
        pkg.paymentReconciliation = batchResponse.find(
          (res) => res.id === paymentReconciliationId
        ) as PaymentReconciliation;
    }
  });
}

export async function addInsuranceToResultPackages(oystehr: Oystehr, packages: ClaimPackage[]): Promise<void> {
  const requests: string[] = [];
  packages.forEach((pkg) => {
    if (pkg.coverage) requests.push(`/InsurancePlan?phonetic=${getInsuranceNameFromCoverage(pkg.coverage)}`);
  });
  const resources = await getResourcesFromBatchInlineRequests(oystehr, requests);
  packages.forEach((pkg) => {
    const coverage = pkg.coverage;
    if (coverage) {
      console.log(`Searching for ${getInsuranceNameFromCoverage(coverage)} insurance`);
      pkg.insurance = resources.find(
        (res) =>
          res.resourceType === 'InsurancePlan' && (res as InsurancePlan).name === getInsuranceNameFromCoverage(coverage)
      ) as InsurancePlan;
    }
  });
}
