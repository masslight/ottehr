import { expect, Page } from '@playwright/test';

const DEFAULT_TIMEOUT = { timeout: 15000 };

export class PaymentLocationsPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/admin/billing/payment-locations');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTableLoaded(): Promise<void> {
    await expect(this.page.locator('th').getByText('Location')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async getLocationRows(): Promise<number> {
    return this.page.locator('tbody tr').count();
  }

  async searchLocations(text: string): Promise<void> {
    const input = this.page.getByLabel(/search by location name/i);
    await input.fill(text);
  }

  async clickLocationByName(name: string): Promise<void> {
    await this.page.getByRole('cell', { name, exact: true }).click();
  }

  async verifyLocationVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name, exact: true })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyLocationNotVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('cell', { name, exact: true })).not.toBeVisible();
  }

  async verifyPaginationDisplayed(): Promise<void> {
    await expect(this.page.locator('.MuiTablePagination-root')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async getFirstLocationName(): Promise<string> {
    const firstRow = this.page.locator('tbody tr').first();
    const cells = firstRow.locator('td');
    return (await cells.first().innerText()).trim();
  }
}

export class PaymentLocationDetailPage {
  constructor(private page: Page) {}

  async waitForLoaded(): Promise<void> {
    await expect(this.page.getByLabel('breadcrumb')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyLocationName(name: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyContactAndAddressSection(): Promise<void> {
    await expect(this.page.getByText('Contact & Address')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyStripeConnectSection(): Promise<void> {
    await expect(this.page.getByText('Stripe Connect')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyBreadcrumbs(): Promise<void> {
    const breadcrumb = this.page.getByLabel('breadcrumb');
    await expect(breadcrumb.getByRole('link', { name: 'Payment Locations' })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async clickPaymentLocationsBreadcrumb(): Promise<void> {
    await this.page.getByLabel('breadcrumb').getByRole('link', { name: 'Payment Locations' }).click();
  }

  async hasVirtualVisitsChip(): Promise<boolean> {
    return this.page.getByText('Virtual Visits Supported').isVisible();
  }

  async verifyLocationId(id: string): Promise<void> {
    await expect(this.page.getByText(id)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyStripeAccountId(accountId: string): Promise<void> {
    await expect(this.page.getByText(accountId)).toBeVisible(DEFAULT_TIMEOUT);
  }
}

export async function expectPaymentLocationsPage(page: Page): Promise<PaymentLocationsPage> {
  const plp = new PaymentLocationsPage(page);
  await plp.waitForTableLoaded();
  return plp;
}

export async function expectPaymentLocationDetailPage(page: Page): Promise<PaymentLocationDetailPage> {
  const detailPage = new PaymentLocationDetailPage(page);
  await detailPage.waitForLoaded();
  return detailPage;
}
