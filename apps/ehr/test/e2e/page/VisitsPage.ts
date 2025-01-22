import { Page } from '@playwright/test';

export class VisitsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }
}

export async function expectVisitsPage(page: Page): Promise<VisitsPage> {
  await page.waitForURL(`/visits`);
  return new VisitsPage(page);
}
