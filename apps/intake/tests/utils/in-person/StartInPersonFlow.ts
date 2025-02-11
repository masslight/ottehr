import { BaseInPersonFlow } from './BaseInPersonFlow';

export class StartInPersonFlow extends BaseInPersonFlow {
  protected async clickVisitButton(): Promise<void> {
    await this.locator.startInPersonVisitButton.click();
  }
  protected async completeBooking(): Promise<void> {
    await this.locator.confirmWalkInButton.click();
  }
}
