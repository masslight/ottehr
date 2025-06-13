// cSpell:ignore filechooser
import { expect, Locator, Page } from '@playwright/test';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { dataTestIds } from '../../src/helpers/data-test-ids';

export type UploadedFile = { uploadedFile: Locator; link: string | null };
export class UploadDocs {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private getPathToProjectRoot(currentPath: string): string {
    if (currentPath.split('/').at(-1) === 'intake') {
      return currentPath;
    }
    return this.getPathToProjectRoot(path.resolve(currentPath, '..'));
  }

  async uploadPhoto(locator: string, fileName: string): Promise<Locator> {
    let requestUrl: string | undefined;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Listen for all network requests
    this.page.on('request', (request) => {
      // Check if the request URL matches the pattern you are looking for
      if (request.url().includes(`${process.env.WEBSITE_URL}`)) {
        requestUrl = request.url();
      }
    });

    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.page.locator(locator).click(),
    ]);

    const filePath = path.join(this.getPathToProjectRoot(__dirname), `/images-for-tests/${fileName}`);
    await fileChooser.setFiles(filePath);
    await expect(this.page.getByTestId(dataTestIds.fileCardUploadingButton)).toBeVisible({ visible: false });

    expect(requestUrl).toBeDefined();
    const uploadedPhoto = this.page.locator(`img[src*="${requestUrl}"]`);
    await expect(uploadedPhoto).toBeVisible();
    return uploadedPhoto;
  }

  async uploadFile(locator: Locator, file: Locator): Promise<UploadedFile> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const [fileChooser] = await Promise.all([this.page.waitForEvent('filechooser'), locator.click()]);

    const filePath = path.join(this.getPathToProjectRoot(__dirname), `/images-for-tests/template.pdf`);
    await fileChooser.setFiles(filePath);
    await expect(this.page.getByTestId(dataTestIds.continueButton)).toBeEnabled();

    const uploadedFile = file;
    const link = await file.getAttribute('href');
    await expect(uploadedFile).toBeVisible();
    return { uploadedFile, link };
  }

  async fillPhotoFrontID(): Promise<Locator> {
    return await this.uploadPhoto('#photo-id-front', 'Landscape_1.jpg');
  }
  async fillPhotoBackID(): Promise<Locator> {
    return await this.uploadPhoto('#photo-id-back', 'Portrait_2.jpg');
  }
  async fillInsuranceFront(): Promise<Locator> {
    return await this.uploadPhoto('#insurance-card-front', 'Landscape_1.jpg');
  }
  async fillInsuranceBack(): Promise<Locator> {
    return await this.uploadPhoto('#insurance-card-back', 'Portrait_2.jpg');
  }
  async fillSecondaryInsuranceFront(): Promise<Locator> {
    return await this.uploadPhoto('[id="secondary-insurance.item.14"]', 'Landscape_1.jpg');
  }
  async fillSecondaryInsuranceBack(): Promise<Locator> {
    return await this.uploadPhoto('[id="secondary-insurance.item.15"]', 'Portrait_2.jpg');
  }
  async fillPatientCondition(): Promise<Locator> {
    return await this.uploadPhoto('#photo', 'Landscape_1.jpg');
  }
  async fillPatientConditionPhotoPaperwork(): Promise<Locator> {
    return await this.uploadPhoto('#patient-photos', 'Landscape_1.jpg');
  }
}
