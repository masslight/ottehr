import {
  BOOKING_CONFIG,
  BRANDING_CONFIG,
  createQuestionnaireItemFromConfig,
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE,
  PATIENT_RECORD_CONFIG,
  VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE,
} from 'utils';
import { expect, test } from 'vitest';
import InPersonIntakeQuestionnaireConfig from '../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import VirtualIntakeQuestionnaireConfig from '../../../config/oystehr/virtual-intake-questionnaire.json' assert { type: 'json' };
import BookingQuestionnaire from './data/booking-questionnaire.json' assert { type: 'json' };
import IntakePaperworkQuestionnaire from './data/intake-paperwork-questionnaire.json' assert { type: 'json' };
import PatientRecordQuestionnaire from './data/patient-record-questionnaire.json' assert { type: 'json' };
import VirtualIntakePaperworkQuestionnaire from './data/virtual-intake-paperwork-questionnaire.json' assert { type: 'json' };

describe('testing Questionnaire generation from config objects', () => {
  test.concurrent('in person intake paperwork config JSON matches generated questionnaire', () => {
    const generatedQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
    const key = Object.keys((InPersonIntakeQuestionnaireConfig as any).fhirResources as any)[0];
    const actualConfigQuestionnaire = (InPersonIntakeQuestionnaireConfig as any).fhirResources[key].resource;

    expect(actualConfigQuestionnaire).toBeDefined();
    expect(generatedQuestionnaire).toEqual(actualConfigQuestionnaire);
  });

  test.concurrent('virtual intake paperwork config JSON matches generated questionnaire', () => {
    const generatedQuestionnaire = VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE();
    const key = Object.keys((VirtualIntakeQuestionnaireConfig as any).fhirResources as any)[0];
    const actualConfigQuestionnaire = (VirtualIntakeQuestionnaireConfig as any).fhirResources[key].resource;

    expect(actualConfigQuestionnaire).toBeDefined();
    expect(generatedQuestionnaire).toEqual(actualConfigQuestionnaire);
  });

  // skip this test if BRANDING_CONFIG.projectName !== 'Ottehr'
  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('patient record questionnaire config generates expected questionnaire items', async () => {
      const questionnaireItems = createQuestionnaireItemFromConfig(PATIENT_RECORD_CONFIG);
      expect(questionnaireItems).toBeDefined();
      expect(questionnaireItems).toEqual(PatientRecordQuestionnaire);
    });

  // skip this test if BRANDING_CONFIG.projectName !== 'Ottehr'
  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('booking questionnaire config generates expected questionnaire items', async () => {
      const questionnaireItems = createQuestionnaireItemFromConfig(BOOKING_CONFIG.formConfig);
      expect(questionnaireItems).toBeDefined();
      expect(questionnaireItems).toEqual(BookingQuestionnaire.item);
    });

  // skip this test if BRANDING_CONFIG.projectName !== 'Ottehr'
  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('intake paperwork questionnaire generates expected questionnaire', async () => {
      const generatedQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
      expect(generatedQuestionnaire).toBeDefined();

      const generatedSections = generatedQuestionnaire.item;
      const expectedSections = (IntakePaperworkQuestionnaire as any).item;

      // Compare each section
      expect(generatedSections?.length).toBe(expectedSections?.length);

      for (let i = 0; i < (expectedSections?.length || 0); i++) {
        const expSection = expectedSections![i];
        const genSection = generatedSections![i];

        // Compare section-level properties
        expect(genSection.linkId).toBe(expSection.linkId);
        expect(genSection.text).toBe(expSection.text);
        expect(genSection.type).toBe(expSection.type);

        // Compare section-level extensions if present
        if (expSection.extension) {
          expect(genSection.extension).toEqual(expSection.extension);
        }
        if (expSection.enableWhen) {
          expect(genSection.enableWhen).toEqual(expSection.enableWhen);
        }
        if (expSection.enableBehavior) {
          expect(genSection.enableBehavior).toBe(expSection.enableBehavior);
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

        expect(genLogicalIds).toEqual(expLogicalIds);

        // For each logical item, check that it exists with the same properties (order-independent)
        for (const expLogical of expLogicalItems) {
          const genLogical = genLogicalItems.find((g: any) => g.linkId === expLogical.linkId);
          expect(genLogical).toBeDefined();
          expect(genLogical).toEqual(expLogical);
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
        expect(genRegularItems.length).toBe(expRegularItems.length);
        for (let j = 0; j < expRegularItems.length; j++) {
          const normalizedGen = normalizeItem(genRegularItems[j]);
          const normalizedExp = normalizeItem(expRegularItems[j]);
          expect(normalizedGen).toEqual(normalizedExp);
        }
      }
    });

  // skip this test if BRANDING_CONFIG.projectName !== 'Ottehr'
  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('virtual intake paperwork questionnaire generates expected questionnaire', async () => {
      const generatedQuestionnaire = VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE();
      expect(generatedQuestionnaire).toBeDefined();

      const generatedSections = generatedQuestionnaire.item;
      const expectedSections = VirtualIntakePaperworkQuestionnaire as any;

      // Compare each section
      expect(generatedSections?.length).toBe(expectedSections?.length);

      for (let i = 0; i < (expectedSections?.length || 0); i++) {
        const expSection = expectedSections![i];
        const genSection = generatedSections![i];

        // Compare section-level properties
        expect(genSection.linkId).toBe(expSection.linkId);
        expect(genSection.text).toBe(expSection.text);
        expect(genSection.type).toBe(expSection.type);

        // Compare section-level extensions if present
        if (expSection.extension) {
          expect(genSection.extension).toEqual(expSection.extension);
        }
        if (expSection.enableWhen) {
          expect(genSection.enableWhen).toEqual(expSection.enableWhen);
        }
        if (expSection.enableBehavior) {
          expect(genSection.enableBehavior).toBe(expSection.enableBehavior);
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

        expect(genLogicalIds).toEqual(expLogicalIds);

        // For each logical item, check that it exists with the same properties (order-independent)
        for (const expLogical of expLogicalItems) {
          const genLogical = genLogicalItems.find((g: any) => g.linkId === expLogical.linkId);
          expect(genLogical).toBeDefined();
          expect(genLogical).toEqual(expLogical);
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
        expect(genRegularItems.length).toBe(expRegularItems.length);
        for (let j = 0; j < expRegularItems.length; j++) {
          const normalizedGen = normalizeItem(genRegularItems[j]);
          const normalizedExp = normalizeItem(expRegularItems[j]);
          expect(normalizedGen).toEqual(normalizedExp);
        }
      }
    });
});
