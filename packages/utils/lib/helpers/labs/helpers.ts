import { ServiceRequest } from 'fhir/r4b';
import { PSC_HOLD_CONFIG } from '../../types';

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
