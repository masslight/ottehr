import { Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

export const configInHouseLabDeleteButtonTestId = (serviceRequestId: string): string => {
  return `${dataTestIds.inHouseLabsPage.deleteButtonPrefix}-${serviceRequestId}`;
};

export const configInHouseLabTableRowTestId = (serviceRequestId: string): string => {
  return `${dataTestIds.inHouseLabsPage.tableRowPrefix}-${serviceRequestId}`;
};

export const getServiceRequestIdFromPageUrl = (page: Page): string => {
  // grab the service request id
  const currentUrl = page.url();
  const urlPathSegments = new URL(currentUrl).pathname.split('/');
  // ['','in-person','e42cd095-df72-42a6-83c0-ee6d99224b0d','in-house-lab-orders','0d164166-6a7b-4e9e-add1-d2d3efb2fa3b','order-details']
  const serviceRequestIdIdx = urlPathSegments.indexOf('in-house-lab-orders') + 1;
  const serviceRequestId = urlPathSegments[serviceRequestIdIdx];

  return serviceRequestId;
};
