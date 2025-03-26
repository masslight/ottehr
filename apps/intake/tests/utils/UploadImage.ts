import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { expect, Locator, Page } from '@playwright/test';

export class UploadImage {
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
    await this.page.waitForTimeout(5000);

    expect(requestUrl).toBeDefined();
    const uploadedPhoto = this.page.locator(`img[src*="${requestUrl}"]`);
    await expect(uploadedPhoto).toBeVisible();
    return uploadedPhoto;
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
  async fillPatientCondition(): Promise<Locator> {
    return await this.uploadPhoto('#photo', 'Landscape_1.jpg');
  }
}
