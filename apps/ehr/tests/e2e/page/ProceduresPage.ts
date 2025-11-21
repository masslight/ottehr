import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DocumentProcedurePage, expectDocumentProcedurePage } from './DocumentProcedurePage';

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
    const code = (await this.#container.getByTestId(dataTestIds.proceduresPage.cptCode).allInnerTexts()).find((text) =>
      text.includes(procedureCptCode)
    );
    expect(code).toBe(procedureCptCode);
  }

  async verifyProcedureType(procedureType: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.proceduresPage.procedureType)).toHaveText(procedureType);
  }

  async verifyProcedureDiagnosis(procedureDiagnosis: string): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.proceduresPage.diagnosis).filter({ hasText: procedureDiagnosis })
    ).toBeVisible();
  }

  async verifyProcedureDocumentedBy(procedureDocumentedBy: string): Promise<void> {
    await expect(this.#container.getByTestId(dataTestIds.proceduresPage.documentedBy)).toHaveText(
      procedureDocumentedBy
    );
  }

  async click(): Promise<DocumentProcedurePage> {
    // sometimes there are 2 procedures, and this breaks playwright's strict mode
    this.#container.getByTestId(dataTestIds.proceduresPage.cptCode);
    await this.#container.click();
    return expectDocumentProcedurePage(this.#container.page());
  }
}

export async function expectProceduresPage(page: Page): Promise<ProceduresPage> {
  await page.waitForURL(new RegExp('/in-person/.*/procedures'));
  await expect(page.getByTestId(dataTestIds.proceduresPage.title)).toBeVisible();
  return new ProceduresPage(page);
}

export async function openProceduresPage(appointmentId: string, page: Page): Promise<ProceduresPage> {
  await page.goto(`/in-person/${appointmentId}/procedures`);
  return expectProceduresPage(page);
}
