import { Page, Response } from '@playwright/test';
import { Practitioner } from 'fhir/r4b';
import { DeleteChartDataResponse, GetChartDataResponse, SaveChartDataResponse } from 'utils';

type ResponsePredicate<T extends object = object> = (json: T) => boolean;

/**
 * Generic function to wait for a specific API response and verify its data
 * @param page Playwright page object
 * @param urlPart Part of the URL to match
 * @param predicate Function to verify response data
 * @param options Additional options for response waiting
 * @returns Promise that resolves when matching response is found
 */
export async function waitForResponseWithData<T extends object = object>(
  page: Page,
  urlPart: string | RegExp,
  predicate?: ResponsePredicate<T>,
  options: {
    method?: string;
    status?: number;
    timeout?: number;
  } = {}
): Promise<Response> {
  const { status = 200, timeout = 30000 } = options;

  return page.waitForResponse(
    (response) =>
      (typeof urlPart === 'string' ? response.url().includes(urlPart) : urlPart.test(response.url())) &&
      response.status() === status &&
      response.json().then((json) => (predicate ? predicate(json.output || json) : true)),
    { timeout }
  );
}

/**
 * Helper function to wait for Get chart data response
 * @param page Playwright page object
 * @param predicate Function to verify chart data
 * @returns Promise that resolves when matching chart data response is found
 */
export async function waitForGetChartDataResponse(
  page: Page,
  predicate?: ResponsePredicate<GetChartDataResponse>
): Promise<Response> {
  return waitForResponseWithData(page, '/get-chart-data', predicate);
}

/**
 * Helper function to wait for Save chart data response
 * @param page Playwright page object
 * @param predicate Function to verify chart data
 * @returns Promise that resolves when matching chart data response is found
 */
export async function waitForSaveChartDataResponse(
  page: Page,
  predicate?: ResponsePredicate<SaveChartDataResponse>
): Promise<Response> {
  return waitForResponseWithData(page, '/save-chart-data', predicate);
}

/**
 * Helper function to wait for chart data deletion response
 * @param page Playwright page object
 * @returns Promise that resolves when chart data deletion response is found
 */
export async function waitForChartDataDeletion(page: Page): Promise<Response> {
  return waitForResponseWithData<DeleteChartDataResponse>(page, '/delete-chart-data', () => true);
}

/**
 * Helper function to wait for practitioner response
 * @param page Playwright page object
 * @param predicate Function to verify practitioner data
 * @returns Promise that resolves when matching practitioner response is found
 */
export async function waitForPractitionerResponse(
  page: Page,
  predicate?: ResponsePredicate<Practitioner>
): Promise<Response> {
  return waitForResponseWithData(page, '/Practitioner/', predicate);
}
