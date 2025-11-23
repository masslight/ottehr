import { expect } from '@playwright/test';
import { DEPLOYED_TELEMED_LOCATIONS, shouldShowServiceCategorySelectionPage } from 'utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { BaseTelemedFlow, SlotAndLocation, StartVisitResponse } from './BaseTelemedFlow';

export class PrebookTelemedFlow extends BaseTelemedFlow {
  async clickVisitButton(): Promise<void> {
    const scheduleButton = this.page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
  }
  async completeBooking(): Promise<void> {
    await this.locator.clickReserveButton();
  }
  async selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>> {
    // Handle service category selection if present
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'telemed', visitType: 'prebook' })) {
      await this.fillingInfo.selectFirstServiceCategory();
    }

    const statesSelector = this.page.getByTestId(dataTestIds.scheduleVirtualVisitStatesSelector);
    await expect(statesSelector).toBeVisible();

    await statesSelector.getByRole('button').click();
    const firstAvailableState = DEPLOYED_TELEMED_LOCATIONS[0]?.name;
    if (!firstAvailableState) {
      throw new Error('No deployed telemed locations found');
    }
    const locationOption = this.page.locator('[role="option"]').getByText(firstAvailableState, { exact: true });
    const location = (await locationOption.textContent()) ?? undefined;
    await locationOption.click();
    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    const locationTitle = title ? title.replace('Book a visit at ', '').trim() : null;
    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    await this.continue();
    return { selectedSlot: { time: selectedSlot.time, fullSlot: selectedSlot.fullSlot }, location, locationTitle };
  }

  async startVisitFullFlow(): Promise<StartVisitResponse> {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.selectTimeLocationAndContinue();
    await this.selectDifferentFamilyMemberAndContinue();
    const patientBasicInfo = await this.fillNewPatientDataAndContinue();
    await this.completeBooking();
    await this.page.waitForURL(/\/visit/);
    const bookingURL = this.page.url();
    const match = bookingURL.match(/visit\/([0-9a-fA-F-]+)/);
    const bookingUUID = match ? match[1] : null;
    return {
      patientBasicInfo,
      slotAndLocation,
      bookingURL,
      bookingUUID,
    };
  }
}
