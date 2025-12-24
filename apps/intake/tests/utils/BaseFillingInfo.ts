import { Page } from '@playwright/test';
import { DateTime } from 'luxon';

export abstract class BaseFillingInfo {
  page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  protected months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Helper method to get a random element from an array
  protected getRandomElement(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Helper method to get a random integer between min and max (inclusive)
  protected getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  protected getStringDateByDateUnits(
    month: string,
    day: string,
    year: string,
    format: string | undefined = 'MMMM dd, yyyy'
  ): string {
    const monthIndex = this.months.indexOf(month);
    return DateTime.fromObject({
      year: +year,
      month: monthIndex + 1,
      day: +day,
    }).toFormat(format);
  }

  protected getRandomString(): string {
    return Math.random().toString().slice(2, 7);
  }

  abstract fillVisitReason(): Promise<{ reason: string; enteredReason: string }>;

  async fillCorrectDOB(month: string, day: string, year: string): Promise<void> {
    await this.page.getByRole('combobox').nth(0).click();
    await this.page.getByRole('option', { name: month }).click();

    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('option', { name: day, exact: true }).click();

    await this.page.getByRole('combobox').nth(2).click();
    await this.page.getByRole('option', { name: year }).click();
  }
}
