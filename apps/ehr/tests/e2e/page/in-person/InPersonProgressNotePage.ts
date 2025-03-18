import { Page } from '@playwright/test';
import { CssHeader } from '../CssHeader';
import { SideMenu } from '../SideMenu';
import { BaseProgressNotePage } from '../abstract/BaseProgressNotePage';

export class InPersonProgressNotePage extends BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  cssHeader(): CssHeader {
    return new CssHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }
}

export async function expectInPersonProgressNotePage(page: Page): Promise<InPersonProgressNotePage> {
  await page.waitForURL(new RegExp('/in-person/.*/progress-note'));
  return new InPersonProgressNotePage(page);
}
