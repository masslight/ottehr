/**
 * Paperwork flow integration test — custom, test-isolated FHIR-backed service category.
 *
 * Goal: assert that when a paperwork flow is configured for a (service category × mode), the flow's
 * assembled paperwork renders as expected. Everything is owned by the test — a custom FHIR-backed service
 * category, a flow, and the ≥2 custom forms the flow is assembled from — so nothing global/ottehr-managed
 * is touched and the test is fully isolated per worker.
 *
 * How the pieces fit:
 *  - TestServiceCategoryFlowManager deploys two single-page custom forms, a flow Questionnaire whose
 *    `derivedFrom` lists both, and a service-category HealthcareService with the flow assigned for the
 *    in-person mode (a per-mode extension on that HealthcareService). The flow's assignment lives on the
 *    HealthcareService itself, hence isolatable (unlike ottehr-managed categories' global tag).
 *  - The bookable owner is the existing prebook in-person group. Its `type[]` allow-list is empty, so
 *    get-schedule accepts any serviceCategory code and its Location-owned schedule vends slots stamped with
 *    the resolved custom-category coding (get-schedule fetches all active service-category
 *    HealthcareServices unconditionally). Same path the urgent-care group booking uses.
 *  - Booking is driven via the group deeplink with `serviceCategory=<customCode>` (bypassing homepage +
 *    picker). At create-slot the flow wins over the baseline questionnaire and its canonical is stamped on
 *    the Slot — the test asserts that stamp to prove the flow (not the baseline) rendered.
 *  - The test then enters paperwork and fills the flow's two custom pages through to completion, asserting
 *    the rendered page sequence equals the flow's assembled pages (in derivedFrom order).
 *
 * NOTE: like the other specs in this directory, this test requires a live Oystehr environment (it creates
 * FHIR resources and drives the real intake app); it cannot run offline. Runtime assumptions worth noting
 * for maintenance: (1) the intake paperwork QR is recognized via INTAKE_PAPERWORK_QR_TAG (stamped by
 * create-appointment), so the flow renders regardless of its url; (2) the booking form's reason-for-visit
 * options for a FHIR-backed category come from the category config, so the category is created with a
 * reasonsForVisit entry the test then fills; (3) the custom forms' fields are optional, so the review page
 * reports "complete" and its submit button reads "Finish" (with a "Continue" fallback in the driver).
 */

import { expect, test } from '@playwright/test';
import { Appointment, Slot } from 'fhir/r4b';
import {
  BOOKING_CONFIG,
  BookingConfig,
  CONFIG_INJECTION_KEYS,
  parseQuestionnaireCanonicalExtension,
  SERVICE_CATEGORY_SYSTEM,
  SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL,
} from 'utils';
import { BookingFlowHelpers, PatientTestData } from '../utils/booking/BookingFlowHelpers';
import {
  CreatedGroupBookingResources,
  TEST_FIXTURE_TIMEZONES,
  TestLocationManager,
} from '../utils/booking/TestLocationManager';
import {
  CreatedServiceCategoryFlow,
  TestServiceCategoryFlowManager,
} from '../utils/booking/TestServiceCategoryFlowManager';
import { injectTestConfig } from '../utils/config/injectTestConfig';
import { PagedQuestionnaireFlowHelper } from '../utils/paperwork/PagedQuestionnaireFlowHelper';
import { ResourceHandler } from '../utils/resource-handler';

test.describe.configure({ mode: 'parallel' });

test.describe('Paperwork flow — custom FHIR-backed service category', () => {
  let testLocationManager: TestLocationManager;
  let flowManager: TestServiceCategoryFlowManager;
  let resourceHandler: ResourceHandler;
  let group: CreatedGroupBookingResources;
  let flow: CreatedServiceCategoryFlow;

  test.beforeAll(async () => {
    // Short unique worker id, matching the pattern used by the generated booking spec.
    const shortTimestamp = Date.now().toString(36).slice(-6);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const workerUniqueId = `${shortTimestamp}${randomSuffix}`;
    console.log(`Worker unique ID: ${workerUniqueId}`);

    testLocationManager = new TestLocationManager(workerUniqueId);
    flowManager = new TestServiceCategoryFlowManager(workerUniqueId);
    resourceHandler = new ResourceHandler();
    await Promise.all([testLocationManager.init(), flowManager.init(), resourceHandler.initApi()]);

    // Bookable owner: reuse the prebook in-person group. Its Location-owned schedule vends slots for any
    // serviceCategory code (its `type[]` allow-list is empty), so no dedicated bookable owner is needed.
    group = await testLocationManager.ensurePrebookInPersonGroupWithSlots();
    console.log(`✓ Using prebook in-person group: ${group.name} (slug: ${group.slug})`);

    // Stand up the custom service category + in-person flow assembled from two test-managed custom forms.
    flow = await flowManager.createInPersonFlowForCustomService();
  });

  test.afterAll(async () => {
    // Delete the custom forms + flow + service HS (no global sweep for those types), then the group.
    if (flowManager) {
      await flowManager.cleanup();
    }
    if (testLocationManager) {
      await testLocationManager.cleanup();
      console.log('✓ Cleaned up custom-service flow test resources');
    }
  });

  test('books the custom service in-person and renders its assigned paperwork flow', async ({ page }) => {
    const serviceMode = 'in-person' as const;
    const fillingStrategy = { checkValidation: false, fillAllFields: true };

    // Make the client aware of the custom category (label + reason-for-visit) for the booking form. The
    // FHIR catalog also surfaces it, but injecting keeps the client's BOOKING_CONFIG-derived helpers in
    // agreement. injectTestConfig merges per-key, so only serviceCategories is overridden.
    await injectTestConfig(page, CONFIG_INJECTION_KEYS.BOOKING, {
      serviceCategories: [
        ...BOOKING_CONFIG.serviceCategories,
        {
          category: {
            system: SERVICE_CATEGORY_SYSTEM,
            code: flow.serviceCategoryCode,
            display: flow.serviceCategoryDisplay,
          },
          serviceModes: [serviceMode],
          visitTypes: ['prebook'],
          reasonsForVisit: { default: [flow.reasonForVisit] },
        },
      ],
    });

    // --- Booking: deeplink straight to the group booking for the custom category (skips homepage + picker).
    const bookingUrl = `/prebook/${serviceMode}?bookingOn=${group.slug}&scheduleType=group&serviceCategory=${flow.serviceCategoryCode}`;
    console.log(`Navigating to custom-category group booking URL: ${bookingUrl}`);
    await page.goto(bookingUrl, { waitUntil: 'networkidle' });

    await BookingFlowHelpers.selectFirstAvailableTimeSlot(page, TEST_FIXTURE_TIMEZONES.inPerson);
    await BookingFlowHelpers.clickContinueButtonIfPresent(page, 'after time slot selection');

    // Patient info. Supply an explicit reason-for-visit matching the custom category's configured reason —
    // the node-side sample-data helper can't resolve reasons for a non-BOOKING_CONFIG category.
    const patientData: PatientTestData = BookingFlowHelpers.getSamplePatientData(flow.serviceCategoryCode);
    patientData.valid['reason-for-visit'] = flow.reasonForVisit.value;
    await BookingFlowHelpers.completePatientInfoStep(
      page,
      BOOKING_CONFIG as BookingConfig,
      patientData,
      { serviceMode, serviceCategory: flow.serviceCategoryCode },
      fillingStrategy
    );

    const appointmentResponse = await BookingFlowHelpers.confirmBooking(page, 'prebook', serviceMode);
    expect(appointmentResponse.appointmentId).toBeTruthy();
    console.log(`✓ Booked appointment ${appointmentResponse.appointmentId} for custom category`);

    // --- Prove the flow (not the baseline questionnaire) won at create-slot.
    await assertSlotCarriesFlowCanonical(resourceHandler, appointmentResponse.appointmentId, flow);

    // --- Paperwork: navigate in, then fill the flow's custom pages through to completion.
    if (!page.url().includes('/paperwork/')) {
      await page.getByRole('button', { name: 'Proceed to paperwork' }).click();
    }
    await page.waitForURL(/\/paperwork\/[^/]+\/[^/?]+/, { timeout: 30000 });

    // Drive the paperwork helper from the flow's assembled effective questionnaire, so its page model is
    // exactly what the app renders for the flow.
    const paperwork = new PagedQuestionnaireFlowHelper(page, serviceMode, undefined, flow.effectiveQuestionnaire);
    await paperwork.waitForPage();

    const expectedPages = flow.forms.map((f) => f.pageLinkId);
    const renderedPages: string[] = [];
    let currentPage = paperwork.getFirstVisiblePage();
    while (currentPage) {
      const pageLinkId = currentPage.linkId;
      // Assert the app is actually on this expected page (throws on mismatch).
      await paperwork.verifyOnExpectedPage(pageLinkId);
      renderedPages.push(pageLinkId);

      // Fill this custom form's single field with a known value and continue.
      const formForPage = flow.forms.find((f) => f.pageLinkId === pageLinkId);
      const values = formForPage ? { [formForPage.fieldLinkId]: formForPage.fieldValue } : {};
      await paperwork.fillPageAndContinue(values, pageLinkId);

      const next = paperwork.getNextVisiblePage(pageLinkId);
      if (!next) {
        break;
      }
      currentPage = next;
      await paperwork.waitForPage();
    }

    // The flow's two custom pages rendered, in derivedFrom order.
    expect(renderedPages).toEqual(expectedPages);

    // --- Review → complete. Optional fields ⇒ review reports complete ⇒ button reads "Finish"; fall back
    // to "Continue" if a future change makes a page incomplete.
    await page.waitForURL(/\/review/, { timeout: 30000 });
    const finishButton = page.getByRole('button', { name: /^finish$/i });
    const continueButton = page.getByRole('button', { name: /^continue$/i });
    if (await finishButton.isVisible().catch(() => false)) {
      await finishButton.click();
    } else {
      await continueButton.click();
    }

    // Prebook completion lands on /visit/<appointmentId>.
    await page.waitForURL(/\/visit\/[a-f0-9-]+/, { timeout: 30000 });
    console.log('✓ Custom-service paperwork flow rendered and completed successfully');
  });
});

/**
 * Read the appointment's Slot and assert it carries the paperwork flow's canonical (url + version). This
 * confirms the flow was resolved at create-slot and won over the baseline questionnaire.
 */
async function assertSlotCarriesFlowCanonical(
  resourceHandler: ResourceHandler,
  appointmentId: string,
  flow: CreatedServiceCategoryFlow
): Promise<void> {
  const oystehr = resourceHandler.apiClient;

  const appointment = await oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId });
  const slotReference = appointment.slot?.[0]?.reference;
  expect(slotReference, 'appointment should reference a Slot').toBeTruthy();

  const slotId = slotReference!.split('/')[1];
  const slot = await oystehr.fhir.get<Slot>({ resourceType: 'Slot', id: slotId });

  const canonicalExtension = slot.extension?.find((e) => e.url === SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL);
  expect(
    canonicalExtension?.valueString,
    'Slot should carry the paperwork-flow canonical (flow should win over the baseline questionnaire)'
  ).toBeTruthy();

  const canonical = parseQuestionnaireCanonicalExtension(canonicalExtension!.valueString!);
  expect(canonical.url).toBe(flow.flowCanonical.url);
  expect(canonical.version).toBe(flow.flowCanonical.version);
  console.log(`✓ Slot ${slotId} carries flow canonical ${canonical.url}|${canonical.version}`);
}
