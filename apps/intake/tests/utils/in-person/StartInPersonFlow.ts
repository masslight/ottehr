import { BaseInPersonFlow } from './BaseInPersonFlow';

export class StartInPersonFlow extends BaseInPersonFlow {
  protected async clickVisitButton(): Promise<void> {
    await this.locator.startInPersonVisitButton.click();
  }
  protected async completeBooking(): Promise<void> {
    await this.locator.confirmWalkInButton.click();
  }
  protected async additionalStepsForPrebook(): Promise<
    Partial<{ selectedSlot: { buttonName: string | null; selectedSlot: string | undefined }; location: string | null }>
  > {
    return {}; // No additional steps needed for walk-ins
  }
}
