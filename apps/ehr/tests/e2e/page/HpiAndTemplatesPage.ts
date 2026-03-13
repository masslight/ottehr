import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

export class HpiAndTemplatesPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async fillHPI(): Promise<void> {
    const hpiTextField = this.#page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes);
    await expect(hpiTextField).toBeVisible();
    await hpiTextField.locator('textarea').first().fill('The patient reports having a cough for 3 days.');
  }
}

export async function expectHpiAndTemplatesPage(page: Page): Promise<HpiAndTemplatesPage> {
  await page.waitForURL(new RegExp(`/in-person/.*/history-of-present-illness-and-templates`), { timeout: 10000 });
  await expect(page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiTitle)).toBeVisible();
  return new HpiAndTemplatesPage(page);
}
