import { BrowserContext, expect, Page, test } from '@playwright/test';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import {
  ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL,
  PaymentVariant,
  updateEncounterPaymentVariantExtension,
} from 'utils/lib/fhir/encounter';
import { hasAttorneyInformationPage, hasEmployerInformationPage } from 'utils/lib/helpers/create-demo-visits';
import {
  getAttorneyInformationStepAnswers,
  getConsentStepAnswers,
  getContactInformationAnswers,
  getEmergencyContactStepAnswers,
  getEmployerInformationStepAnswers,
  getPatientDetailsStepAnswers,
  getPaymentOptionSelfPayAnswers,
  getResponsiblePartyStepAnswers,
  isoToDateObject,
} from 'utils/lib/helpers/helpers';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `inPersonHeaderPayment.spec.ts-${DateTime.now().toMillis()}`;

const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person', async ({ patientInfo }) => {
  return [
    getContactInformationAnswers({
      firstName: patientInfo.firstName,
      lastName: patientInfo.lastName,
      birthDate: isoToDateObject(patientInfo.dateOfBirth || '') || undefined,
      email: patientInfo.email,
      phoneNumber: patientInfo.phoneNumber,
      birthSex: patientInfo.sex,
    }),
    getPatientDetailsStepAnswers({}),
    getPaymentOptionSelfPayAnswers(),
    getResponsiblePartyStepAnswers({}),
    ...(hasEmployerInformationPage() ? [getEmployerInformationStepAnswers({})] : []),
    getEmergencyContactStepAnswers({}),
    ...(hasAttorneyInformationPage() ? [getAttorneyInformationStepAnswers({})] : []),
    getConsentStepAnswers({}),
  ];
});

test.describe('In-person header: Payment display', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources(page);
    await page.close();
    await context.close();
  });

  const navigateToVisit = async (): Promise<void> => {
    await page.goto(`/in-person/${resourceHandler.appointment.id}/cc-and-intake-notes`);
    await page.getByTestId(dataTestIds.inPersonHeader.container).waitFor({ timeout: 15000 });
  };

  const setEncounterPaymentVariant = async (variant: PaymentVariant | null): Promise<void> => {
    const oystehr = await resourceHandler.apiClient;
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: resourceHandler.encounter.id!,
    });

    const patched =
      variant === null
        ? {
            ...encounter,
            extension: (encounter.extension ?? []).filter((ext) => ext.url !== ENCOUNTER_PAYMENT_VARIANT_EXTENSION_URL),
          }
        : updateEncounterPaymentVariantExtension(encounter, variant);

    await oystehr.fhir.update(patched);
  };

  test('shows "Payment: Not set" in warning style when no payment variant is on the encounter', async () => {
    await setEncounterPaymentVariant(null);
    await navigateToVisit();

    const header = new InPersonHeader(page);
    await header.verifyPaymentIsUnset();
  });

  test('shows "Payment: Self-Pay" and no warning style when encounter payment variant is selfPay', async () => {
    await setEncounterPaymentVariant(PaymentVariant.selfPay);
    await navigateToVisit();

    const header = new InPersonHeader(page);
    await header.verifyPaymentText('Self-Pay');
    await header.verifyPaymentIsSet();
    await expect(page.getByTestId(dataTestIds.inPersonHeader.payment)).not.toHaveCSS('font-weight', '600');
  });
});
