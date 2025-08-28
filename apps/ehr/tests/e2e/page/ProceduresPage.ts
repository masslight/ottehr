import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

export class ProceduresPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  getProcedureRow(procedureType: string): ProcedureRow {
    return new ProcedureRow(
      this.#page
        .getByTestId(dataTestIds.proceduresPage.procedureRow)
        .filter({
          hasText: procedureType,
        })
        .first()
    );
  }
}

export class ProcedureRow {
  #container: Locator;

  constructor(container: Locator) {
    this.#container = container;
  }

  async verifyProcedureCptCode(procedureCptCode: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.proceduresPage.cptCode)).toHaveText(procedureCptCode);
  }

  async verifyProcedureType(procedureType: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.proceduresPage.procedureType)).toHaveText(procedureType);
  }

  async verifyProcedureDiagnosis(procedureDiagnosis: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.proceduresPage.diagnosis)).toHaveText(procedureDiagnosis);
  }

  async verifyProcedureDocumentedBy(procedureDocumentedBy: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.proceduresPage.documentedBy)).toHaveText(
      procedureDocumentedBy
    );
  }
}

export async function expectProceduresPage(page: Page): Promise<ProceduresPage> {
  await page.waitForURL(new RegExp('/in-person/.*/procedures'));
  await expect(page.getByTestId(dataTestIds.proceduresPage.title)).toBeVisible();
  return new ProceduresPage(page);
}
