import { Page } from '@playwright/test';
import fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractPdfText } from './pdf-reader';

/**
 * General-purpose PDF helper for Playwright tests.
 * Provides utilities for downloading PDFs (from blob URLs or downloads) and extracting text.
 */
export class PdfTestHelper {
  private page: Page;
  private blobCaptureEnabled: boolean = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Get blob URL from a button that opens PDF in a new window.
   * Handles the technical details of intercepting window.open() and closing the popup.
   * @param element - The button/link element to click
   * @returns The blob URL that was opened
   * @throws Error if no blob URL was captured
   */
  async getBlobUrlFromButton(element: any): Promise<string> {
    // Setup interception if not already done
    if (!this.blobCaptureEnabled) {
      await this.page.evaluate(() => {
        (window as any).lastBlobUrl = '';
        const original = window.open;
        window.open = new Proxy(original, {
          apply(target, thisArg, argArray: unknown[]) {
            const url = String(argArray?.[0] ?? '');
            (window as any).lastBlobUrl = url;
            return target.apply(thisArg, argArray as any);
          },
        });
      });
      this.blobCaptureEnabled = true;
    }

    // Click and wait for popup
    const popupPromise = this.page.waitForEvent('popup');
    await element.click();
    const popup = await popupPromise;
    await popup.close();

    // Get captured blob URL
    const blobUrl = await this.page.evaluate(() => (window as any).lastBlobUrl || '');

    if (!blobUrl || !blobUrl.startsWith('blob:')) {
      throw new Error(`Expected blob URL, but got: ${blobUrl}`);
    }

    return blobUrl;
  }

  /**
   * Download PDF data from a blob URL and save to a temporary file.
   * The blob URL must be accessible from the current page context.
   * @param blobUrl - The blob URL to fetch (e.g., "blob:http://localhost:4002/...")
   * @param fileNamePrefix - Optional prefix for the saved file (default: 'pdf')
   * @returns Path to the saved PDF file in system temp directory
   */
  async downloadFromBlobUrl(blobUrl: string, fileNamePrefix: string = 'pdf'): Promise<string> {
    // Fetch blob directly from the page context (where it was created)
    const pdfBuffer = await this.page.evaluate(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      return Array.from(new Uint8Array(buffer));
    }, blobUrl);

    // Save to temp file
    const filePath = path.join(os.tmpdir(), `${fileNamePrefix}-${Date.now()}.pdf`);
    fs.writeFileSync(filePath, new Uint8Array(pdfBuffer));

    return filePath;
  }

  /**
   * Extract text content from a PDF file.
   * @param filePath - Path to the PDF file
   * @returns Extracted text content
   */
  async extractText(filePath: string): Promise<string> {
    return await extractPdfText(filePath);
  }

  /**
   * Delete a PDF file.
   * @param filePath - Path to the file to delete
   */
  cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup PDF file: ${filePath}`, error);
    }
  }
}
