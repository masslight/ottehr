import { Page } from '@playwright/test';
import { configResultPageContainerTestId } from 'src/features/in-house-labs/utils/test-ids';
import { EntryMode } from 'utils';
import { FinalResultPage } from '../../FinalResultPage';
import { InHouseLabsPage } from '../../in-person/InHouseLabsPage';

export const getServiceRequestIdFromPageUrl = (page: Page): string => {
  // grab the service request id
  const currentUrl = page.url();
  const urlPathSegments = new URL(currentUrl).pathname.split('/');
  // ['','in-person','e42cd095-df72-42a6-83c0-ee6d99224b0d','in-house-lab-orders','0d164166-6a7b-4e9e-add1-d2d3efb2fa3b','order-details']
  const serviceRequestIdIdx = urlPathSegments.indexOf('in-house-lab-orders') + 1;
  const serviceRequestId = urlPathSegments[serviceRequestIdIdx];

  return serviceRequestId;
};

export async function expectInHouseLabPage(page: Page): Promise<InHouseLabsPage> {
  await page.waitForURL(new RegExp('/in-person/.*/in-house-lab-orders'));
  return new InHouseLabsPage(page);
}

export async function expectFinalResultsPage(page: Page): Promise<FinalResultPage> {
  // wait for final page to be loaded
  await page.getByTestId(configResultPageContainerTestId(EntryMode.Edit)).waitFor({ state: 'visible' });

  return new FinalResultPage(page);
}
