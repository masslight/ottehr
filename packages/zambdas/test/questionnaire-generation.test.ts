import {
  BOOKING_CONFIG,
  createQuestionnaireItemFromConfig,
  INTAKE_PAPERWORK_QUESTIONNAIRE,
  PATIENT_RECORD_CONFIG,
} from 'utils';
import BookingQuestionnaire from './data/booking-questionnaire.json' assert { type: 'json' };
import IntakePaperworkQuestionnaire from './data/intake-paperwork-questionnaire.json' assert { type: 'json' };
import PatientRecordQuestionnaire from './data/patient-record-questionnaire.json' assert { type: 'json' };
// this is for testing the generation logic with a specific reference Q resource. this will almost always break
// downstream so this will be commented out and exist here only as a local dev tool
describe('testing Questionnaire generation from config objects', () => {
  test.concurrent('patient record questionnaire config generates expected questionnaire items', async () => {
    const questionnaireItems = createQuestionnaireItemFromConfig(PATIENT_RECORD_CONFIG);
    expect(questionnaireItems).toBeDefined();
    expect(questionnaireItems).toEqual(PatientRecordQuestionnaire);
  });
  test.concurrent('booking questionnaire config generates expected questionnaire items', async () => {
    const questionnaireItems = createQuestionnaireItemFromConfig(BOOKING_CONFIG.formConfig);
    expect(questionnaireItems).toBeDefined();
    expect(questionnaireItems).toEqual(BookingQuestionnaire.item);
  });
  test.concurrent(
    'intake paperwork questionnaire generates expected questionnaire (excluding payment-option pages)',
    async () => {
      const generatedQuestionnaire = INTAKE_PAPERWORK_QUESTIONNAIRE();
      expect(generatedQuestionnaire).toBeDefined();

      // Filter out payment-option pages (we changed the structure from the original)
      const filterPaymentOptionPages = (items: any[] | undefined): any[] | undefined => {
        return items?.filter((item: any): boolean => !item.linkId.startsWith('payment-option'));
      };

      const generatedSections = filterPaymentOptionPages(generatedQuestionnaire.item);
      const expectedSections = filterPaymentOptionPages((IntakePaperworkQuestionnaire as any).item);

      // Write generated to file for debugging
      await import('fs/promises')
        .then(
          (fs): Promise<void> =>
            fs.writeFile('./test/data/generated-intake-paperwork.json', JSON.stringify(generatedSections, null, 2))
        )
        .catch((): void => {});

      // Compare each section
      expect(generatedSections?.length).toBe(expectedSections?.length);

      for (let i = 0; i < (expectedSections?.length || 0); i++) {
        const expSection = expectedSections![i];
        const genSection = generatedSections![i];

        // Compare section-level properties
        expect(genSection.linkId, `Section ${i} linkId`).toBe(expSection.linkId);
        expect(genSection.text, `Section ${i} text`).toBe(expSection.text);
        expect(genSection.type, `Section ${i} type`).toBe(expSection.type);

        // Compare section-level extensions if present
        if (expSection.extension) {
          expect(genSection.extension, `Section ${i} extensions`).toEqual(expSection.extension);
        }
        if (expSection.enableWhen) {
          expect(genSection.enableWhen, `Section ${i} enableWhen`).toEqual(expSection.enableWhen);
        }
        if (expSection.enableBehavior) {
          expect(genSection.enableBehavior, `Section ${i} enableBehavior`).toBe(expSection.enableBehavior);
        }

        // Separate logical items from regular items
        const isLogicalItem = (item: any): boolean => item.readOnly === true || (item.required === false && !item.text);

        const expLogicalItems = expSection.item?.filter(isLogicalItem) || [];
        const expRegularItems = expSection.item?.filter((item: any): boolean => !isLogicalItem(item)) || [];

        const genLogicalItems = genSection.item?.filter(isLogicalItem) || [];
        const genRegularItems = genSection.item?.filter((item: any): boolean => !isLogicalItem(item)) || [];

        // Check that all logical items are present (order doesn't matter)
        const expLogicalIds = new Set(expLogicalItems.map((i: any): string => i.linkId));
        const genLogicalIds = new Set(genLogicalItems.map((i: any): string => i.linkId));

        expect(genLogicalIds, `Section ${i} (${expSection.linkId}) logical item linkIds`).toEqual(expLogicalIds);

        // For each logical item, check that it exists with the same properties (order-independent)
        for (const expLogical of expLogicalItems) {
          const genLogical = genLogicalItems.find((g: any) => g.linkId === expLogical.linkId);
          expect(genLogical, `Section ${i} logical item ${expLogical.linkId} exists`).toBeDefined();
          expect(genLogical, `Section ${i} logical item ${expLogical.linkId}`).toEqual(expLogical);
        }

        // Helper to normalize items by sorting extensions (order-independent comparison)
        const normalizeItem = (item: any): any => {
          if (!item) return item;
          const normalized = { ...item };
          if (normalized.extension && Array.isArray(normalized.extension)) {
            normalized.extension = [...normalized.extension].sort((a: any, b: any): number =>
              (a.url || '').localeCompare(b.url || '')
            );
          }
          return normalized;
        };

        // Check that regular items are in the exact expected order
        expect(genRegularItems.length, `Section ${i} (${expSection.linkId}) regular item count`).toBe(
          expRegularItems.length
        );
        for (let j = 0; j < expRegularItems.length; j++) {
          const normalizedGen = normalizeItem(genRegularItems[j]);
          const normalizedExp = normalizeItem(expRegularItems[j]);
          expect(normalizedGen, `Section ${i} (${expSection.linkId}) item ${j}`).toEqual(normalizedExp);
        }
      }
    }
  );
});
