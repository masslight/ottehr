import { DiagnosticReport, Location, Organization, ServiceRequest } from 'fhir/r4b';
import {
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LabsTableColumn,
  MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING,
  ORDER_NUMBER_LEN,
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

export const getColumnWidth = (column: LabsTableColumn): string => {
  switch (column) {
    case 'testType':
      return '15%';
    case 'visit':
      return '10%';
    case 'orderAdded':
      return '10%';
    case 'provider':
      return '13%';
    case 'ordered':
      return '15%';
    case 'dx':
      return '13%';
    case 'resultsReceived':
      return '15%';
    case 'accessionNumber':
      return '10%';
    case 'status':
      return '5%';
    case 'detail':
      return '2%';
    case 'actions':
      return '1%';
    default:
      return '10%';
  }
};

export const getColumnHeader = (column: LabsTableColumn): string => {
  switch (column) {
    case 'testType':
      return 'Test type';
    case 'visit':
      return 'Visit';
    case 'orderAdded':
      return 'Order added';
    case 'provider':
      return 'Provider';
    case 'ordered':
      return 'Ordered';
    case 'dx':
      return 'Dx';
    case 'resultsReceived':
      return 'Results received';
    case 'accessionNumber':
      return 'Accession Number';
    case 'requisitionNumber':
      return 'Requisition Number';
    case 'status':
      return 'Status';
    case 'detail':
      return '';
    case 'actions':
      return '';
    default:
      return '';
  }
};

export function createOrderNumber(length = ORDER_NUMBER_LEN): string {
  // https://sentry.io/answers/generate-random-string-characters-in-javascript/
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
}
