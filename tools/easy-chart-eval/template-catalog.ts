// The practice's templates, offline — parsed from the global-templates seed.
//
// WHY THE HARNESS NEEDS ITS OWN. In the app `catalogue.templates` lists the practice's live templates and
// resolves a dictated name against their real titles. The harness has no project to list, so it stubbed the
// catalogue to echo the query back: EVERY title resolved, including one the model invented. Two things were
// invisible as a result — how often the model names a template that does not exist, and what applying one
// actually put on the chart.
//
// The seed at packages/zambdas/src/scripts/data/global-templates-seed.json is the same data the synth
// environments were seeded from, so it is the right offline stand-in. Resolution goes through the app's own
// `matchByTitle`, not a copy: an invented name has to be refused here exactly as it is in production.
//
// SCOPE, STATED PLAINLY. Only the template's DIAGNOSES are read. A template also carries default exam
// findings, MDM and patient instructions — those are contained Observations and Communications, and
// simulating them is a separate piece of work nobody has done on either branch. So after this the chart
// state knows about a template's diagnoses and still knows nothing about its exam, which is why the
// exam section stays blind to template contributions.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Condition, Encounter, List } from 'fhir/r4b';
import { chartDataTagSystem } from 'utils/lib/fhir/constants';
import { CODE_SYSTEM_ICD_10 } from 'utils/lib/helpers/rcm/constants';
import { matchByTitle } from '../../apps/ehr/src/features/easy-chart/executor/static-options';

/**
 * The seed data predates the -cm suffix. The apply-template zambda accepts both, so this must too —
 * matching only the current system silently found zero diagnoses in every template.
 */
const LEGACY_ICD_10_CODE_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';

export interface TemplateCatalogDx {
  code: string;
  display: string;
  /** From the template's contained Encounter.diagnosis. Rank 1 is the primary in DTO terms. */
  rank?: number;
}

export interface TemplateCatalogEntry {
  title: string;
  diagnoses: TemplateCatalogDx[];
}

/** A contained Condition counts as a diagnosis only when it carries the chart-data `diagnosis` tag. */
const isDiagnosisCondition = (resource: { resourceType?: string; meta?: Condition['meta'] }): boolean =>
  resource.resourceType === 'Condition' &&
  Boolean(resource.meta?.tag?.some((tag) => tag.system === chartDataTagSystem('diagnosis')));

const icdCoding = (condition: Condition): { code?: string; display?: string } | undefined =>
  condition.code?.coding?.find(
    (coding) => coding.system === CODE_SYSTEM_ICD_10 || coding.system === LEGACY_ICD_10_CODE_SYSTEM
  );

let cached: TemplateCatalogEntry[] | undefined;

export function loadTemplateCatalog(): TemplateCatalogEntry[] {
  if (cached) return cached;
  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = join(here, '../../packages/zambdas/src/scripts/data/global-templates-seed.json');
  const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as { templates: List[] };

  cached = seed.templates.map((templateList) => {
    const contained = templateList.contained ?? [];
    const templateEncounter = contained.find((r): r is Encounter => r.resourceType === 'Encounter');
    const diagnoses: TemplateCatalogDx[] = [];

    // Walked in ENTRY order, mirroring the zambda's create loop, so a multi-diagnosis template keeps
    // the order it declares — which is what decides the primary when no rank is given.
    for (const entry of templateList.entry ?? []) {
      const referenced = contained.find((r) => r.id === entry.item?.reference?.replace('#', ''));
      if (!referenced || !isDiagnosisCondition(referenced)) continue;
      const condition = referenced as Condition;
      const coding = icdCoding(condition);
      if (!coding?.code) continue;
      const encounterDx = (templateEncounter?.diagnosis ?? []).find(
        (dx) => dx.condition.reference?.split('/')[1] === condition.id
      );
      diagnoses.push({
        code: coding.code,
        display: coding.display ?? condition.code?.text ?? '',
        ...(encounterDx?.rank !== undefined ? { rank: encounterDx.rank } : {}),
      });
    }
    return { title: templateList.title ?? '', diagnoses };
  });
  return cached;
}

/** Every title, for the harness catalogue to resolve against. */
export function templateTitles(): { id: string; title: string }[] {
  return loadTemplateCatalog().map((entry, index) => ({ id: String(index), title: entry.title }));
}

/**
 * Resolve an apply-template display the way the app does — `matchByTitle`, best score wins.
 *
 * `undefined` means nothing matched, which is the honest answer and NOT the same as a template with no
 * diagnoses: the first is a name the practice does not have, the second is a template that charts none.
 */
export function resolveTemplateByDisplay(display: string): TemplateCatalogEntry | undefined {
  const catalog = loadTemplateCatalog();
  const matches = matchByTitle(templateTitles(), { display: display.trim(), searchTerms: [] });
  if (matches.length === 0) return undefined;
  return catalog[Number(matches[0].id)];
}
