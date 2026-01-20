import { Coverage, DiagnosticReport, DocumentReference, Location, Organization, ServiceRequest } from 'fhir/r4b';
import {
  CreateLabPaymentMethod,
  DEFAULT_OYSTEHR_LABS_HL7_SYSTEM,
  EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_CLIENT_BILL_COVERAGE_TYPE_CODING,
  LAB_DOC_REF_TAG_hl7_TRANSMISSION,
  LAB_ORDER_DOC_REF_CODING_CODE,
  LAB_RESULT_DOC_REF_CODING_CODE,
  LabPaymentMethod,
  LabsTableColumn,
  MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING,
  ORDER_NUMBER_LEN,
  OYSTEHR_ABN_DOC_CATEGORY_CODING,
  OYSTEHR_LAB_GENERATED_RESULT_CATEGORY_CODING,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  OYSTEHR_LABS_ADDITIONAL_PLACER_ID_SYSTEM,
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

export function getAdditionalPlacerId(dr: DiagnosticReport): string | undefined {
  return dr.identifier?.find((id) => id.system === OYSTEHR_LABS_ADDITIONAL_PLACER_ID_SYSTEM)?.value;
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

export const getTestNameFromDr = (dr: DiagnosticReport): string | undefined => {
  const testName =
    dr.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.display ||
    dr.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.display ||
    dr.code.coding?.find((temp) => temp.system === DEFAULT_OYSTEHR_LABS_HL7_SYSTEM)?.display;
  return testName;
};

export const getTestItemCodeFromDr = (diagnosticReport: DiagnosticReport): string | undefined => {
  const testItemCode =
    diagnosticReport.code.coding?.find((temp) => temp.system === OYSTEHR_LAB_OI_CODE_SYSTEM)?.code ||
    diagnosticReport.code.coding?.find((temp) => temp.system === 'http://loinc.org')?.code ||
    diagnosticReport.code.coding?.find((temp) => temp.system === DEFAULT_OYSTEHR_LABS_HL7_SYSTEM)?.code;
  return testItemCode;
};

export const getTestNameOrCodeFromDr = (dr: DiagnosticReport): string => {
  const testName = getTestNameFromDr(dr);
  const testItemCode = getTestItemCodeFromDr(dr);
  const testDescription = testName || testItemCode || 'missing test name';
  return testDescription;
};

export function paymentMethodFromCoverage(coverage: Coverage): CreateLabPaymentMethod {
  let hasPay = false;
  let hasClientBill = false;

  for (const coding of coverage.type?.coding ?? []) {
    switch (coding.code) {
      case 'WC':
        return LabPaymentMethod.WorkersComp;
      case 'pay':
        hasPay = true;
        break;
      case LAB_CLIENT_BILL_COVERAGE_TYPE_CODING.code:
        hasClientBill = true;
        break;
    }
  }

  if (hasPay) {
    return LabPaymentMethod.SelfPay;
  }

  if (hasClientBill) {
    return LabPaymentMethod.ClientBill;
  }

  return LabPaymentMethod.Insurance;
}

export function serviceRequestPaymentMethod(
  serviceRequest: ServiceRequest,
  coverages: Coverage[]
): CreateLabPaymentMethod | undefined {
  const insuranceCoverageRef = serviceRequest?.insurance?.find(
    (insurance) => insurance.reference?.startsWith('Coverage/')
  );
  if (!insuranceCoverageRef) return LabPaymentMethod.SelfPay;
  const coverageId = insuranceCoverageRef.reference?.replace('Coverage/', '');
  const coverage = coverages.find((coverage) => coverage.id === coverageId);
  if (!coverage) {
    console.warn(`Warning: unable to determine the payment method of this service request ${serviceRequest.id}
      coverages passed: ${coverages.map((coverage) => coverage.id)}`);
    return;
  }
  const paymentMethod = paymentMethodFromCoverage(coverage);
  console.log('service request payment method and id', paymentMethod, serviceRequest.id);
  return paymentMethod;
}

export const docRefIsLabGeneratedResult = (docRef: DocumentReference): boolean => {
  return !!docRef.category?.find(
    (cat) =>
      cat.coding?.find(
        (code) =>
          code.system === OYSTEHR_LAB_GENERATED_RESULT_CATEGORY_CODING.system &&
          code.code === OYSTEHR_LAB_GENERATED_RESULT_CATEGORY_CODING.code
      )
  );
};

export const docRefIsOgHl7Transmission = (docRef: DocumentReference): boolean => {
  return !!docRef.meta?.tag?.some(
    (tag) =>
      tag.system === LAB_DOC_REF_TAG_hl7_TRANSMISSION.system && tag.code === LAB_DOC_REF_TAG_hl7_TRANSMISSION.code
  );
};

export const docRefIsOrderPDFAndCurrent = (docRef: DocumentReference): boolean => {
  const isCurrent = docRef.status === 'current';
  const isOrderPdf = !!docRef.type?.coding?.find(
    (code) => code.system === LAB_ORDER_DOC_REF_CODING_CODE.system && code.code === LAB_ORDER_DOC_REF_CODING_CODE.code
  );
  return isCurrent && isOrderPdf;
};

export const docRefIsLabelPDFAndCurrent = (docRef: DocumentReference): boolean => {
  const isCurrent = docRef.status === 'current';
  const isLabelPdf = !!docRef.type?.coding?.find(
    (code) =>
      code.system === EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.system && code.code === EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code
  );
  return isCurrent && isLabelPdf;
};

export const docRefIsAbnAndCurrent = (docRef: DocumentReference): boolean => {
  const isCurrent = docRef.status === 'current';
  const isAbn = !!docRef.category?.some(
    (cat) =>
      cat.coding?.some(
        (code) =>
          code.code === OYSTEHR_ABN_DOC_CATEGORY_CODING.code && code.system === OYSTEHR_ABN_DOC_CATEGORY_CODING.system
      )
  );
  return isCurrent && isAbn;
};

export const docRefIsOttehrGeneratedResultAndCurrent = (docRef: DocumentReference): boolean => {
  const isCurrent = docRef.status === 'current';
  const isResult = !!docRef.type?.coding?.some(
    (c) => c.system === LAB_RESULT_DOC_REF_CODING_CODE.system && c.code === LAB_RESULT_DOC_REF_CODING_CODE.code
  );
  return isCurrent && isResult;
};
