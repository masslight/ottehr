import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, QuestionnaireItem, Slot } from 'fhir/r4b';
import {
  CreateSlotParams,
  getSlugForBookableResource,
  getTimezone,
  INTEGRATION_TEST_TAG_SYSTEM,
  M2MClientMockType,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
  SLUG_SYSTEM,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { buildSimpleScheduleExt, persistSchedule, startOfDayWithTimezone } from '../helpers/testScheduleUtils';

interface GetBookingQuestionnaireResponseShape {
  allItems: QuestionnaireItem[];
  questionnaireResponse: { item?: QuestionnaireItem[]; questionnaire?: string };
  title?: string;
}

// Booking-questionnaire integration coverage for the FHIR-backed service
// category case: when a Slot is scoped to a HealthcareService that lives
// outside BOOKING_CONFIG (registered via the runtime admin UI), the returned
// Questionnaire's reason-for-visit item should be enriched with the HS's
// configured reasonsForVisit AND carry an answerDisplayFilter narrowing the
// shown options to that (category, mode) pair. Without that enrichment, the
// intake side's useDisplayFilteredOptions falls through to "return all
// options" and the patient sees the wrong RFV list.
describe('get-booking-questionnaire — FHIR-backed RFV enrichment', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  const createdResourceIds: { resourceType: string; id: string }[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-booking-questionnaire.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    for (const r of createdResourceIds.reverse()) {
      try {
        await oystehrAdmin.fhir.delete({ resourceType: r.resourceType as 'Slot', id: r.id });
      } catch {
        // best-effort cleanup
      }
    }
    await cleanup();
  });

  const buildFhirBackedServiceCategory = (
    code: string,
    name: string,
    reasons: Array<{ label: string; value: string }>
  ): HealthcareService => ({
    resourceType: 'HealthcareService',
    active: true,
    name,
    meta: {
      tag: [SERVICE_CATEGORY_TAG, { system: INTEGRATION_TEST_TAG_SYSTEM, code: `DELETE_ME-${processId}` }],
    },
    type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code, display: name }] }],
    characteristic: serviceCategoryCharacteristics({
      modes: [ServiceMode['in-person']],
      visitTypes: [ServiceVisitType.prebook],
      durationMinutes: 30,
    }),
    extension:
      reasons.length > 0
        ? [
            {
              url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
              valueString: JSON.stringify({ reasonsForVisit: reasons }),
            },
          ]
        : undefined,
  });

  const findReasonForVisitItem = (items: QuestionnaireItem[] | undefined): QuestionnaireItem | undefined => {
    if (!items) return undefined;
    for (const item of items) {
      if (item.linkId === 'reason-for-visit') return item;
      const nested = findReasonForVisitItem(item.item);
      if (nested) return nested;
    }
    return undefined;
  };

  const setupBookingFixture = async (
    code: string,
    name: string,
    reasons: Array<{ label: string; value: string }>
  ): Promise<{ slotId: string }> => {
    const hs = await oystehrAdmin.fhir.create<HealthcareService>(buildFhirBackedServiceCategory(code, name, reasons));
    assert(hs.id);
    createdResourceIds.push({ resourceType: 'HealthcareService', id: hs.id });

    const scheduleExt = buildSimpleScheduleExt({ prebookSlots: 4 });
    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'BookingQTestLocation',
      identifier: [{ system: SLUG_SYSTEM, value: `bkqtest-${randomUUID().slice(0, 8)}` }],
    };
    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: scheduleExt, processId, scheduleOwner: ownerLocation },
      oystehrAdmin
    );
    assert(schedule.id);
    assert(owner);
    const persistedLocation = owner as Location;
    assert(persistedLocation.id);
    createdResourceIds.push({ resourceType: 'Schedule', id: schedule.id });
    createdResourceIds.push({ resourceType: 'Location', id: persistedLocation.id });

    const slotStartISO = startOfDayWithTimezone({ timezone: getTimezone(schedule) })
      .plus({ days: 1, hours: 9 })
      .toISO()!;

    const createSlotParams: CreateSlotParams = {
      scheduleId: schedule.id,
      startISO: slotStartISO,
      serviceModality: ServiceMode['in-person'],
      lengthInMinutes: 30,
      status: 'busy-tentative',
      originalBookingUrl: `bkq-test?bookingOn=${getSlugForBookableResource(persistedLocation)}`,
      serviceCategoryCode: code,
    };
    const persistedSlot = (
      await oystehrPatient.zambda.executePublic({
        id: 'create-slot',
        ...createSlotParams,
      })
    ).output as Slot;
    assert(persistedSlot?.id);
    createdResourceIds.push({ resourceType: 'Slot', id: persistedSlot.id });
    return { slotId: persistedSlot.id };
  };

  const callGetBookingQuestionnaire = async (slotId: string): Promise<GetBookingQuestionnaireResponseShape> => {
    const response = await oystehrPatient.zambda.execute({
      id: 'get-booking-questionnaire',
      slotId,
    });
    return response.output as GetBookingQuestionnaireResponseShape;
  };

  it('appends FHIR-backed reasons to the reason-for-visit answerOption list', async () => {
    const code = `fhir-rfv-${randomUUID().slice(0, 8)}`;
    const reasons = [
      { label: 'Muscle soreness', value: 'Muscle soreness' },
      { label: 'Tension', value: 'Tension' },
    ];
    const { slotId } = await setupBookingFixture(code, 'Swedish Massage Test', reasons);

    const result = await callGetBookingQuestionnaire(slotId);

    const rfvItem = findReasonForVisitItem(result.allItems);
    assert(rfvItem, 'expected the questionnaire to contain a reason-for-visit item');
    const optionValues = (rfvItem.answerOption ?? [])
      .map((opt) => opt.valueString)
      .filter((v): v is string => typeof v === 'string');
    for (const r of reasons) {
      expect(optionValues, `option "${r.value}" should be in answerOption list`).toContain(r.value);
    }
  });

  it('adds an answer-display-filter scoped to (category, mode) so other categories are masked out', async () => {
    const code = `fhir-rfv-filter-${randomUUID().slice(0, 8)}`;
    const reasons = [{ label: 'Boredom', value: 'Boredom' }];
    const { slotId } = await setupBookingFixture(code, 'Bored Visit Test', reasons);

    const result = await callGetBookingQuestionnaire(slotId);

    const rfvItem = findReasonForVisitItem(result.allItems);
    assert(rfvItem);
    // The paperwork mapper turns raw extensions into the structured
    // `answerDisplayFilters` array; that's the shape the intake side reads.
    const filters =
      (
        rfvItem as unknown as {
          answerDisplayFilters?: Array<{
            conditions: { question: string; operator: string; answer: string }[];
            includeValues: string[];
          }>;
        }
      ).answerDisplayFilters ?? [];
    const ours = filters.find((f) => {
      const matchesCategory = f.conditions.some(
        (c) => c.question === 'appointment-service-category' && c.answer === code
      );
      const matchesMode = f.conditions.some(
        (c) => c.question === 'appointment-service-mode' && c.answer === 'in-person'
      );
      const matchesValue = f.includeValues.includes('Boredom');
      return matchesCategory && matchesMode && matchesValue;
    });
    expect(ours, 'a filter for (this category, in-person) with the configured reason should be present').toBeDefined();
  });

  it('is a no-op when the HealthcareService has no reasonsForVisit configured', async () => {
    const code = `fhir-rfv-empty-${randomUUID().slice(0, 8)}`;
    const { slotId } = await setupBookingFixture(code, 'No-Reasons Service', []);

    const result = await callGetBookingQuestionnaire(slotId);

    const rfvItem = findReasonForVisitItem(result.allItems);
    assert(rfvItem);
    // No filter should have been added for our category. (Filters for
    // BOOKING_CONFIG categories may still be present — they're not our
    // concern here.)
    const filters =
      (
        rfvItem as unknown as {
          answerDisplayFilters?: Array<{ conditions: { question: string; operator: string; answer: string }[] }>;
        }
      ).answerDisplayFilters ?? [];
    const ours = filters.find((f) =>
      f.conditions.some((c) => c.question === 'appointment-service-category' && c.answer === code)
    );
    expect(ours, 'no display filter should be added for a category with empty reasonsForVisit').toBeUndefined();
  });
});
