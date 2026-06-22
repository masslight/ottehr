import { List, Resource } from 'fhir/r4b';
import {
  chartDataTagSystem,
  collectKnownExamFields,
  collectKnownRosFields,
  examConfig,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
} from 'utils';
import { describe, expect, test } from 'vitest';
import { analyzeTemplateVersionData } from '../../src/ehr/shared/template-helpers';
import seed from '../../src/scripts/data/global-templates-seed.json';

// Guards the committed global-templates seed (packages/zambdas/src/scripts/data/global-templates-seed.json,
// created once on a fresh env by src/scripts/recreate-global-templates.ts) against drifting away from the
// product.
//
// It reuses the EXACT validation the EHR runs at runtime — analyzeTemplateVersionData with the same
// exam/ROS config (list-templates and admin-get-template-detail zambdas use the same wiring). So if the
// product's exam/ROS field config changes (a field renamed/removed in examConfig or collectKnownRosFields)
// and nobody refreshes the seed, a template's fields stop matching and this test fails — exactly the
// "seed silently went stale" case we want to catch.
//
// Templates known to be authored in the legacy ROS format (a free-text ROS Condition instead of structured
// ros-observation-field Observations). The product still applies these fine but flags them as not-current.
// They are exempted from the strict isCurrentVersion check below until they are re-exported from an
// up-to-date environment. The test still asserts they have NO field drift, and self-cleans: if one is fixed
// (becomes current) the test fails so this entry gets removed.
const KNOWN_LEGACY_ROS_TEMPLATES = new Set(['Pharyngitis', 'Headache', 'Bac sinusitis']);

// Mirror list-templates/index.ts exactly so this test tracks the same notion of "current" the EHR uses.
const knownExamFields = collectKnownExamFields(examConfig.default.components);
const knownRosFields = collectKnownRosFields();
const examTagSystem = chartDataTagSystem('exam-observation-field');
const rosTagSystem = chartDataTagSystem('ros-observation-field');
const legacyRosTagSystem = chartDataTagSystem('ros');

const templates = seed.templates as List[];

const analyze = (template: List): ReturnType<typeof analyzeTemplateVersionData> =>
  analyzeTemplateVersionData({
    contained: (template.contained ?? []) as Resource[],
    examTagSystem,
    rosTagSystem,
    legacyRosTagSystem,
    knownExamFields,
    knownRosFields,
  });

describe('global-templates seed', () => {
  test('seed is non-empty and every entry is an in-person global template', () => {
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      const isInPerson = template.code?.coding?.some((c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM);
      expect(isInPerson, `Template "${template.title}" is missing the in-person global template code system`).toBe(
        true
      );
    }
  });

  test('every known-legacy template still exists in the seed (otherwise prune the allow-list)', () => {
    const titles = new Set(templates.map((t) => t.title));
    for (const legacyTitle of KNOWN_LEGACY_ROS_TEMPLATES) {
      expect(
        titles.has(legacyTitle),
        `"${legacyTitle}" is allow-listed as legacy ROS but no longer in the seed — remove it from KNOWN_LEGACY_ROS_TEMPLATES`
      ).toBe(true);
    }
  });

  test.each(templates.map((t, i) => [t.title ?? `(untitled #${i})`, t] as const))(
    'template "%s" has no exam/ROS field drift against the current product config',
    (_title, template) => {
      const { unmatchedExamFields, unmatchedRosFields } = analyze(template);
      // Field drift is never acceptable — not even for legacy-ROS templates. This is the core
      // "product changed, seed forgotten" signal.
      expect(
        unmatchedExamFields,
        `Template "${template.title}" references exam fields not in the product config. Re-export the seed from an up-to-date environment.`
      ).toEqual([]);
      expect(
        unmatchedRosFields,
        `Template "${template.title}" references ROS fields not in the product config. Re-export the seed from an up-to-date environment.`
      ).toEqual([]);
    }
  );

  test.each(templates.map((t, i) => [t.title ?? `(untitled #${i})`, t] as const))(
    'template "%s" version status matches expectation',
    (_title, template) => {
      const { isCurrentVersion, rosNote } = analyze(template);
      if (KNOWN_LEGACY_ROS_TEMPLATES.has(template.title ?? '')) {
        // Self-cleaning: an allow-listed template must actually be legacy. If it has been re-exported and
        // is now current, this fails so the entry is removed from KNOWN_LEGACY_ROS_TEMPLATES.
        expect(
          isCurrentVersion,
          `Template "${template.title}" is allow-listed as legacy ROS but is now current — remove it from KNOWN_LEGACY_ROS_TEMPLATES`
        ).toBe(false);
        expect(rosNote, `Expected "${template.title}" to contain a legacy ROS note`).not.toBeNull();
      } else {
        expect(
          isCurrentVersion,
          `Template "${template.title}" is not current per analyzeTemplateVersionData. Re-export the seed from an up-to-date environment (or, if it is a legacy ROS template, add it to KNOWN_LEGACY_ROS_TEMPLATES).`
        ).toBe(true);
      }
    }
  );
});
