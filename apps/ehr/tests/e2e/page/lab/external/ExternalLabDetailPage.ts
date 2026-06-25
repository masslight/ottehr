import { expect, Locator, Page } from '@playwright/test';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  configAoeChoiceEntryOptionTestId,
  configAoeDecimalEntryTestId,
  configAoeRadioEntryTestId,
  configAoeSingleChoiceEntryTestId,
  configAoeTextEntryTestId,
} from 'src/features/external-labs/utils/test-ids';
import { OrderableItemSpecimen } from 'utils';
import { MockLabResultAeoAnswerConfig } from './mock-data';

const detailPgTestIds = dataTestIds.externalLabs.detailsPg;

export class ExternalLabDetailPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  static async isOpen(page: Page): Promise<ExternalLabDetailPage> {
    await page.waitForURL(new RegExp('/in-person/.*/external-lab-orders/.*/order-details'));
    await expect(
      page.getByTestId(detailPgTestIds.pageContainer),
      'confirming create external lab page is open'
    ).toBeVisible();
    return new ExternalLabDetailPage(page);
  }

  async checkBreadCrumbs(text: string): Promise<void> {
    const crumbs = this.#page.getByTestId(dataTestIds.externalLabs.labsBreadCrumbs);
    const parts = (await crumbs.innerText()).split('/').map((p) => p.trim());

    expect(parts, `Validating breadcrumbs appear as expected, should include ${text})`).toEqual([
      'External Labs',
      text,
    ]);
  }

  async confirmOrderingOfficeIsDisplayed(expectedName: string): Promise<void> {
    const orderingOfficeBox = this.#page.getByTestId(detailPgTestIds.orderingOffice);
    await expect(orderingOfficeBox, 'confirming ordering office is displayed').toBeVisible();
    await expect(orderingOfficeBox, `confirming ordering office contains "${expectedName}"`).toContainText(
      expectedName
    );
  }

  async confirmClinicalNoteIsDisplayed(expectedNote: string): Promise<void> {
    const clinicalNoteBox = this.#page.getByTestId(detailPgTestIds.clinicalNote);
    await expect(clinicalNoteBox, 'confirming clinical note is displayed').toBeVisible();
    await expect(clinicalNoteBox, `confirming clinical note contains "${expectedNote}"`).toContainText(expectedNote);
  }

  async confirmRequisitionNumberIsDisplayed(): Promise<void> {
    const requisitionBox = this.#page.getByTestId(detailPgTestIds.requisitionNumber);
    await expect(requisitionBox, 'confirming requisition number is displayed').toBeVisible();
    const text = await requisitionBox.textContent();
    expect(text, 'confirming requisition number has text').toBeTruthy();
  }

  async enterAoeAnswers(answers: MockLabResultAeoAnswerConfig): Promise<void> {
    const aoeAnswerContainer = this.#page.getByTestId(detailPgTestIds.aoeAnswers);

    const linkIds = Object.keys(answers!);
    for (const linkId of linkIds) {
      const { type, answer } = answers[linkId];
      if (type === 'text') {
        const textField = aoeAnswerContainer.getByTestId(configAoeTextEntryTestId(linkId));
        await textField.fill(answer);
      } else if (type === 'boolean') {
        const radioGroup = aoeAnswerContainer.getByTestId(configAoeRadioEntryTestId(linkId));
        const label = answer === true ? 'Yes' : 'No';
        const radio = radioGroup.getByRole('radio', { name: label });
        await radio.check();
      } else if (type === 'choice') {
        const selectField = aoeAnswerContainer.getByTestId(configAoeSingleChoiceEntryTestId(linkId));
        await selectField.click();

        const answerOption = this.#page.getByTestId(configAoeChoiceEntryOptionTestId(answer));
        await answerOption.click();
      } else if (type === 'decimal') {
        const decimalInput = aoeAnswerContainer.getByTestId(configAoeDecimalEntryTestId(linkId));

        await decimalInput.click();
        await decimalInput.fill(String(answer));
      }
    }
  }

  async validateSampleCollectionInstructions(specimens: OrderableItemSpecimen[], timezone?: string): Promise<void> {
    const expectField = async (locator: Locator, label: string, value?: string | null): Promise<void> => {
      const expectedText = `${label}: ${value ?? 'Not specified'}`;
      await expect(locator, `Confirming sample collection card displays ${expectedText}`).toHaveText(expectedText);
    };

    const sampleCollectionCards = this.#page.getByTestId(detailPgTestIds.samples.card);

    await expect(
      sampleCollectionCards,
      `Confirming the correct number of collection instruction cards are present. There should be ${specimens.length}.`
    ).toHaveCount(specimens.length);

    for (let i = 0; i < specimens.length; i++) {
      const getNow = (): DateTime => (timezone ? DateTime.now().setZone(timezone) : DateTime.now());
      const now = getNow();
      const today = now.toFormat('yyyy-MM-dd');

      const card = sampleCollectionCards.nth(i);
      const specimen = specimens[i];

      await expectField(card.getByTestId(detailPgTestIds.samples.container), 'Container', specimen.container);

      await expectField(card.getByTestId(detailPgTestIds.samples.volume), 'Volume', specimen.volume);

      await expectField(card.getByTestId(detailPgTestIds.samples.minVolume), 'Minimum Volume', specimen.minimumVolume);

      await expectField(
        card.getByTestId(detailPgTestIds.samples.storage),
        'Storage Requirements',
        specimen.storageRequirements
      );

      await expectField(
        card.getByTestId(detailPgTestIds.samples.instructions),
        'Collection Instructions',
        specimen.collectionInstructions
      );

      const dateInput = card.getByTestId(detailPgTestIds.samples.collectionDate);
      await expect(dateInput, `Confirming date input is ${today} (timezone: ${timezone})`).toHaveValue(today);
      await expect(dateInput).toBeEnabled();

      // this could be flakey if by chance the time rolls over a minute, so we calculate a new now right before we check
      const nowBeforeSubmit = getNow();
      const expectedTime = nowBeforeSubmit.toFormat('HH:mm');
      const timeInput = card.getByTestId(detailPgTestIds.samples.collectionTime);
      await expect(timeInput, `Confirming time input is ${expectedTime} (timezone: ${timezone})`).toHaveValue(
        expectedTime
      );
      await expect(timeInput).toBeEnabled();
    }
  }

  async clickMarkAsReady(input: { isPSC: boolean; expectIntegratedFallback?: boolean }): Promise<void> {
    const { isPSC, expectIntegratedFallback = false } = input;
    const btnLabel = `Mark as Ready${!isPSC ? ' & Print Label' : ''}`;
    const markAsReadyBtn = this.#page.getByTestId(detailPgTestIds.markReadyBtn);

    await expect(markAsReadyBtn, `Confirming button label - expecting ${btnLabel}`).toHaveText(btnLabel);

    if (!isPSC) {
      // Patch window.open to capture the URL before the popup opens
      await this.#page.evaluate(() => {
        const original = window.open;
        (window as any).lastOpenUrl = '';
        window.open = new Proxy(original, {
          apply(target, thisArg, argArray: unknown[]) {
            try {
              (window as any).lastOpenUrl = String(argArray?.[0] ?? '');
            } catch (e) {
              console.warn('Failed to capture open URL', e);
            }
            return target.apply(thisArg, argArray as any);
          },
        });
      });

      // Set up the popup listener before clicking so it doesn't miss a fast-opening tab.
      // In fallback mode the tab opens after a ~2s delay, so we use a longer timeout.
      const popupTimeout = expectIntegratedFallback ? 15_000 : 35_000;
      const popupPromise = this.#page.waitForEvent('popup', { timeout: popupTimeout }).catch(() => null);

      const snackbar = this.#page.locator('div[id=notistack-snackbar]').filter({ hasText: 'print' });
      const [popup] = await Promise.all([
        popupPromise,
        markAsReadyBtn.click(),
        ...(expectIntegratedFallback
          ? [expect(snackbar, 'Confirming Dymo Connect warning snackbar appears').toBeVisible({ timeout: 15_000 })]
          : []),
      ]);

      expect(popup, 'Confirming label PDF opened in a new tab (via fallback to manual)').toBeTruthy();

      const openedUrl = await this.#page.evaluate(() => (window as any).lastOpenUrl || '');
      expect(openedUrl, 'Confirming a URL was opened').not.toEqual('');
      const formattedUrl = openedUrl.split(/[?#]/)[0];
      expect(formattedUrl.toLowerCase(), 'Confirming opened URL is a PDF').toMatch(/\.pdf$/);
    } else {
      await markAsReadyBtn.click();
    }
  }
}
