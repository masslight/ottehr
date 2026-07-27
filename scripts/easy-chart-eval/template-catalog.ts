/**
 * template-catalog.ts — offline template catalog for the headless sim, parsed from the
 * global-templates seed JSON (packages/zambdas/src/scripts/data/global-templates-seed.json —
 * the same data the synth envs the planner ran against were seeded from).
 *
 * Resolution mirrors the client's apply-template dispatch exactly: useChartAssistant runs
 * findTemplateMatches over the live template titles and auto-applies matches[0] ("no stopping").
 * Diagnosis extraction mirrors the apply-template zambda's makeCreateRequests: a contained
 * Condition carrying the chart-data `diagnosis` meta tag is a Dx; its rank comes from the
 * template's contained Encounter.diagnosis (rank 1 = primary in DTO-land).
 */
import { Condition, Encounter, List } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { chartDataTagSystem, CODE_SYSTEM_ICD_10 } from 'utils';
import { findTemplateMatches } from '../../apps/ehr/src/features/easy-charting/intent-logic';

// Legacy ICD-10 system used by the seed data; the apply-template zambda accepts both (it also
// declares this locally to avoid importing the DEPRECATED constant from utils).
const LEGACY_ICD_10_CODE_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';

export interface TemplateCatalogDx {
  code: string;
  display: string;
  /** Rank from the template's contained Encounter.diagnosis; 1 = primary (chart-data mapping). */
  rank?: number;
}

export interface TemplateCatalogEntry {
  title: string;
  diagnoses: TemplateCatalogDx[];
}

const isDiagnosisCondition = (r: { resourceType?: string; meta?: Condition['meta'] }): boolean =>
  r.resourceType === 'Condition' && !!r.meta?.tag?.some((tag) => tag.system === chartDataTagSystem('diagnosis'));

const icdCoding = (c: Condition): { code?: string; display?: string } | undefined =>
  c.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_ICD_10 || coding.system === LEGACY_ICD_10_CODE_SYSTEM);

let cachedCatalog: TemplateCatalogEntry[] | undefined;

export function loadTemplateCatalog(): TemplateCatalogEntry[] {
  if (cachedCatalog) return cachedCatalog;
  const seedUrl = new URL('../../packages/zambdas/src/scripts/data/global-templates-seed.json', import.meta.url);
  const seed = JSON.parse(readFileSync(seedUrl, 'utf8')) as { templates: List[] };
  cachedCatalog = seed.templates.map((templateList) => {
    const contained = templateList.contained ?? [];
    const templateEncounter = contained.find((r): r is Encounter => r.resourceType === 'Encounter');
    const diagnoses: TemplateCatalogDx[] = [];
    // Walk entry order like the zambda's create loop so multi-dx templates keep their order.
    for (const entry of templateList.entry ?? []) {
      const containedResource = contained.find((r) => r.id === entry.item?.reference?.replace('#', ''));
      if (!containedResource || !isDiagnosisCondition(containedResource)) continue;
      const condition = containedResource as Condition;
      const coding = icdCoding(condition);
      if (!coding?.code) continue;
      const encounterDx = (templateEncounter?.diagnosis ?? []).find(
        (d) => d.condition.reference?.split('/')[1] === condition.id
      );
      diagnoses.push({
        code: coding.code,
        display: coding.display ?? condition.code?.text ?? '',
        ...(encounterDx?.rank !== undefined ? { rank: encounterDx.rank } : {}),
      });
    }
    return { title: templateList.title ?? '', diagnoses };
  });
  return cachedCatalog;
}

/**
 * Resolve a planner apply-template display against the catalog the way the client does:
 * findTemplateMatches (exact title outscores everything), best match wins. Returns undefined
 * when nothing matches — the client shows no-match-template and applies nothing.
 */
export function resolveTemplateByDisplay(display: string): TemplateCatalogEntry | undefined {
  const catalog = loadTemplateCatalog();
  const matches = findTemplateMatches(
    { kind: 'apply-template', display: display.trim(), searchTerms: [] },
    catalog.map((t, i) => ({ id: String(i), title: t.title }))
  );
  if (matches.length === 0) return undefined;
  return catalog[Number(matches[0].id)];
}
