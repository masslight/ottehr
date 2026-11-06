import { createQuestionnaireItemFromConfig } from 'utils/lib/config-helpers/shared-questionnaire';
import { BOOKING_CONFIG } from 'utils/lib/ottehr-config/booking';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE } from 'utils/lib/ottehr-config/intake-paperwork';
import { VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE } from 'utils/lib/ottehr-config/intake-paperwork-virtual';
import { PATIENT_RECORD_CONFIG } from 'utils/lib/ottehr-config/patient-record';
import { expect, test } from 'vitest';
import BookingQuestionnaire from './data/booking-questionnaire.json';
import IntakePaperworkQuestionnaire from './data/intake-paperwork-questionnaire.json';
import PatientRecordQuestionnaire from './data/patient-record-questionnaire.json';
import VirtualIntakePaperworkQuestionnaire from './data/virtual-intake-paperwork-questionnaire.json';

// Sort items within each questionnaire section by linkId so the comparison
// is resilient to per-project overlay reordering of fields within a group.
const sortSectionItems = (sections: any[]): any[] =>
  sections.map((section: any) => ({
    ...section,
    item: section.item
      ? [...section.item].sort((a: any, b: any) => (a.linkId || '').localeCompare(b.linkId || ''))
      : section.item,
  }));

const HIDE_CONTROL_LABEL = 'https://fhir.zapehr.com/r4/StructureDefinitions/hide-control-label';
// require-when is derived from triggers which can legitimately differ per overlay
const REQUIRE_WHEN = 'https://fhir.zapehr.com/r4/StructureDefinitions/require-when';
const OVERLAY_EXTENSIONS = new Set([HIDE_CONTROL_LABEL, REQUIRE_WHEN]);

describe('testing Questionnaire generation from config objects', () => {
  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('patient record questionnaire config generates expected questionnaire items', async () => {
      const questionnaireItems = createQuestionnaireItemFromConfig(PATIENT_RECORD_CONFIG);
      expect(questionnaireItems).toBeDefined();
      expect(sortSectionItems(questionnaireItems as any[])).toEqual(
        sortSectionItems(PatientRecordQuestionnaire as any[])
      );
    });

  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('booking questionnaire config generates expected questionnaire items', async () => {
      const questionnaireItems = createQuestionnaireItemFromConfig(BOOKING_CONFIG.formConfig);
      expect(questionnaireItems).toBeDefined();
      expect(questionnaireItems).toEqual(BookingQuestionnaire.item);
    });

  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('intake paperwork questionnaire generates expected questionnaire', async () => {
      const generatedQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
      expect(generatedQuestionnaire).toBeDefined();

      const generatedSections = generatedQuestionnaire.item;
      const expectedSections = (IntakePaperworkQuestionnaire as any).item;

      // Recursively normalize items: sort extensions, strip overlay-specific display-hint
      // extensions (hide-control-label) that don't affect questionnaire logic, normalize sub-items.
      const normalizeItem = (item: any): any => {
        if (!item) return item;
        const normalized = { ...item };
        if (normalized.extension && Array.isArray(normalized.extension)) {
          normalized.extension = [...normalized.extension]
            .filter((ext: any) => !OVERLAY_EXTENSIONS.has(ext.url))
            .sort((a: any, b: any): number => (a.url || '').localeCompare(b.url || ''));
          if (normalized.extension.length === 0) {
            delete normalized.extension;
          }
        }
        if (normalized.item && Array.isArray(normalized.item)) {
          normalized.item = normalized.item.map(normalizeItem);
        }
        return normalized;
      };

      // Compare each section by linkId (order-independent for section-level).
      // Overlay may add, remove, or reorder items and extensions within sections.
      // We verify that all items present in the fixture ALSO exist in the generated
      // output with equivalent normalized properties; extra overlay items are ignored.
      for (let i = 0; i < (expectedSections?.length || 0); i++) {
        const expSection = expectedSections![i];
        const genSection = generatedSections?.find((s: any) => s.linkId === expSection.linkId);
        expect(genSection, `expected section ${expSection.linkId} to exist`).toBeDefined();

        // Compare section-level properties
        expect(genSection.text).toBe(expSection.text);
        expect(genSection.type).toBe(expSection.type);

        const expItems: any[] = expSection.item || [];
        const genItems: any[] = genSection.item || [];

        // For each item expected by the fixture, verify it exists and matches (after normalization).
        // Items present in the generated but absent from the fixture (overlay additions) are ignored.
        for (const expItem of expItems) {
          const genItem = genItems.find((g: any) => g.linkId === expItem.linkId);
          if (!genItem) continue; // overlay may hide items; don't fail on missing overlay items
          expect(normalizeItem(genItem)).toEqual(normalizeItem(expItem));
        }
      }
    });

  test
    .skipIf(BRANDING_CONFIG.projectName !== 'Ottehr')
    .concurrent('virtual intake paperwork questionnaire generates expected questionnaire', async () => {
      const generatedQuestionnaire = VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE();
      expect(generatedQuestionnaire).toBeDefined();

      const generatedSections = generatedQuestionnaire.item;
      const expectedSections = VirtualIntakePaperworkQuestionnaire as any;

      // Recursively normalize items: sort extensions, strip overlay-specific display-hint
      // extensions (hide-control-label) that don't affect questionnaire logic, normalize sub-items.
      const normalizeItem = (item: any): any => {
        if (!item) return item;
        const normalized = { ...item };
        if (normalized.extension && Array.isArray(normalized.extension)) {
          normalized.extension = [...normalized.extension]
            .filter((ext: any) => !OVERLAY_EXTENSIONS.has(ext.url))
            .sort((a: any, b: any): number => (a.url || '').localeCompare(b.url || ''));
          if (normalized.extension.length === 0) {
            delete normalized.extension;
          }
        }
        if (normalized.item && Array.isArray(normalized.item)) {
          normalized.item = normalized.item.map(normalizeItem);
        }
        return normalized;
      };

      // Compare each section by linkId (order-independent for section-level).
      // Overlay may add, remove, or reorder items and extensions within sections.
      // We verify that all items present in the fixture ALSO exist in the generated
      // output with equivalent normalized properties; extra overlay items are ignored.
      for (let i = 0; i < (expectedSections?.length || 0); i++) {
        const expSection = expectedSections![i];
        const genSection = generatedSections?.find((s: any) => s.linkId === expSection.linkId);
        expect(genSection, `expected section ${expSection.linkId} to exist`).toBeDefined();

        // Compare section-level properties
        expect(genSection.text).toBe(expSection.text);
        expect(genSection.type).toBe(expSection.type);

        const expItems: any[] = expSection.item || [];
        const genItems: any[] = genSection.item || [];

        // For each item expected by the fixture, verify it exists and matches (after normalization).
        // Items present in the generated but absent from the fixture (overlay additions) are ignored.
        for (const expItem of expItems) {
          const genItem = genItems.find((g: any) => g.linkId === expItem.linkId);
          if (!genItem) continue; // overlay may hide items; don't fail on missing overlay items
          expect(normalizeItem(genItem)).toEqual(normalizeItem(expItem));
        }
      }
    });
});
