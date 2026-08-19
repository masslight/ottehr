import { expect, Page } from '@playwright/test';

const DEFAULT_TIMEOUT = { timeout: 15000 };

// The admin Locations panel. Payment/Stripe config moved out of the old
// `/admin/billing/payment-locations` tab and into this general Locations panel:
// the list lives at `/admin/locations`, and each row opens
// `/admin/locations/:location-id`, where the payment/Stripe fields are one
// (role-gated) section among Address, Contact, etc.
export const LOCATIONS_ROUTE = '/admin/locations';

export class LocationsAdminPage {
  constructor(private page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(LOCATIONS_ROUTE);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTableLoaded(): Promise<void> {
    // The list column header is now "Name" (was "Location").
    await expect(this.page.locator('th').getByText('Name', { exact: true })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async getLocationRows(): Promise<number> {
    return this.page.locator('tbody tr').count();
  }

  async searchLocations(text: string): Promise<void> {
    // Single search field, label "Search name or ID" — filters name + id client-side.
    const input = this.page.getByLabel(/search name or id/i);
    await input.fill(text);
  }

  async clickLocationByName(name: string): Promise<void> {
    // The whole row is clickable, and the name cell also renders the location id
    // as a caption — so match the row by text rather than an exact cell.
    await this.locationRow(name).click();
  }

  async verifyLocationVisible(name: string): Promise<void> {
    await expect(this.locationRow(name)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyLocationNotVisible(name: string): Promise<void> {
    // Search filters the table client-side, so a non-match is removed from the DOM.
    await expect(this.page.getByRole('row').filter({ hasText: name })).toHaveCount(0);
  }

  async getFirstNamedLocationName(): Promise<string> {
    // The name cell renders `location.name || '-'` (name as a body2 <p>, id as a
    // caption <span> below it), so unnamed locations show "-". Return the first row
    // that has a real name rather than blindly taking row 0, which may be unnamed.
    const rows = this.page.locator('tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const name = (await rows.nth(i).locator('td').first().locator('p').first().innerText()).trim();
      if (name && name !== '-') return name;
    }
    throw new Error('No named locations found in the Locations admin table');
  }

  private locationRow(name: string): ReturnType<Page['getByRole']> {
    return this.page.getByRole('row').filter({ hasText: name }).first();
  }
}

export class LocationDetailPage {
  constructor(private page: Page) {}

  async waitForLoaded(): Promise<void> {
    await expect(this.page.getByLabel('breadcrumb')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyLocationName(name: string): Promise<void> {
    // The config page has no name heading; the name shows as the last breadcrumb
    // item and as the "Name" field value. Assert both anchors.
    await expect(this.page.getByLabel('breadcrumb').getByText(name, { exact: true })).toBeVisible(DEFAULT_TIMEOUT);
    await expect(this.page.getByLabel('Name', { exact: true })).toHaveValue(name, DEFAULT_TIMEOUT);
  }

  async verifyAddressAndContactSections(): Promise<void> {
    // The old single "Contact & Address" section is now two headings.
    await expect(this.page.getByRole('heading', { name: 'Address' })).toBeVisible(DEFAULT_TIMEOUT);
    await expect(this.page.getByRole('heading', { name: 'Contact' })).toBeVisible(DEFAULT_TIMEOUT);
  }

  // Only rendered for Administrator / CustomerSupport (canSeePaymentFields). Not
  // asserted by default since the run's user role isn't guaranteed.
  async verifyStripeConnectSection(): Promise<void> {
    await expect(this.page.getByText('Stripe Connect')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async verifyBreadcrumbs(): Promise<void> {
    const breadcrumb = this.page.getByLabel('breadcrumb');
    await expect(breadcrumb.getByRole('link', { name: 'Locations' })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async clickLocationsBreadcrumb(): Promise<void> {
    await this.page.getByLabel('breadcrumb').getByRole('link', { name: 'Locations' }).click();
  }
}

export async function expectLocationsAdminPage(page: Page): Promise<LocationsAdminPage> {
  const listPage = new LocationsAdminPage(page);
  await listPage.waitForTableLoaded();
  return listPage;
}

export async function expectLocationDetailPage(page: Page): Promise<LocationDetailPage> {
  const detailPage = new LocationDetailPage(page);
  await detailPage.waitForLoaded();
  return detailPage;
}
