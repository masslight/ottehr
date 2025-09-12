import { DiagnosticReport, Location, Organization, ServiceRequest } from 'fhir/r4b';
import {
  LAB_ACCOUNT_NUMBER_SYSTEM,
  MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PSC_HOLD_CONFIG,
} from '../../types';

export const nameLabTest = (testName: string | undefined, labName: string | undefined, isReflex: boolean): string => {
  if (isReflex) {
    return `${testName} (reflex)`;
  } else {
    return `${testName} / ${labName}`;
  }
};

export const isPSCOrder = (serviceRequest: ServiceRequest): boolean => {
  return (
    serviceRequest.orderDetail?.some((detail) => {
      return detail.coding?.some(
        (coding) => coding.system === PSC_HOLD_CONFIG.system && coding.code === PSC_HOLD_CONFIG.code
      );
    }) || false
  );
};

export function generateDeployAccountNumber(length = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

export function externalLabOrderIsManual(sr: ServiceRequest): boolean {
  return !!sr?.category?.find(
    (cat) =>
      cat.coding?.find(
        (c) =>
          c.system === MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING.system &&
          c.code === MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING.code
      )
  );
}

export function getOrderNumber(sr: ServiceRequest): string | undefined {
  return sr.identifier?.find((id) => id.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)?.value;
}

export function getOrderNumberFromDr(dr: DiagnosticReport): string | undefined {
  return dr.identifier?.find((id) => id.system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)?.value;
}

export function getAccountNumberFromLocationAndOrganization(location: Location, org: Organization): string | undefined {
  console.log(`Getting account number from location and org. Location/${location.id} and Organization/${org.id}`);
  const accountNumberFromLocation = location.identifier?.find(
    (id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM && id.assigner?.reference === `Organization/${org.id}` && id.value
  )?.value;
  if (accountNumberFromLocation) {
    console.log(`Found account number from location. Account number is ${accountNumberFromLocation}`);
    return accountNumberFromLocation;
  }

  console.warn(
    `Could not find account number on Location/${location.id} matching assigner Organization/${org.id}. Trying to find acct number from org.`
  );
  // this is mostly for legacy orders before we switched to account numbers living on SR.location for multi-office ordering

  const accountNumberFromOrg = org.identifier?.find((identifier) => identifier.system === LAB_ACCOUNT_NUMBER_SYSTEM)
    ?.value;
  console.log(`Account number from org is ${accountNumberFromOrg}`);
  return accountNumberFromOrg;
}

export async function openPdf(url: string): Promise<void> {
  window.open(url, '_blank');
}
