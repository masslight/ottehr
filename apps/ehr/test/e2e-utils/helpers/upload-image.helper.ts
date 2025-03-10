import path, { dirname } from 'path';
import { Page } from '@playwright/test';
import { fileURLToPath } from 'url';

export class UploadImage {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private getPathToProjectRoot(currentPath: string): string {
    if (currentPath.split('/').at(-1) === 'ehr') {
      return currentPath;
    }
    return this.getPathToProjectRoot(path.resolve(currentPath, '..'));
  }

  async fetchImageByName(fileName: string): Promise<File> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const filePath = path.join(this.getPathToProjectRoot(__dirname), `/images-for-tests/${fileName}`);
    const response = await fetch(filePath);
    if (!response.ok) throw new Error('Error when uploading a file');

    const blob: Blob = await response.blob();

    return new File([blob], 'filename.jpg', { type: blob.type });
  }
}
