// Shared codec for the structured procedure facts: procedure-type → family
// detection, (de)serialization for the single FHIR extension the facts persist
// in, the legacy bodySite/bodySide → sided-site shim, and the manifest-driven
// display formatter used by the review tab, visit-note PDF, quick-pick detail
// page, and template detail rendering.

import { LACERATION_PAIRED_SITES, LACERATION_UNSIDED_SITES, LacerationWound } from './facts.types';
import {
  FieldOption,
  ManifestField,
  PROCEDURE_FAMILY_MANIFESTS,
  RepeatableGroupManifest,
  SimpleFieldManifest,
  WoundMapManifest,
} from './manifests';
import { PROCEDURE_CODING_FAMILY_IDS, ProcedureCodingFamilyId, StructuredProcedureFacts } from './model.types';

/**
 * Maps procedure-type ValueSet codes (config/oystehr/procedure-type.json) to
 * coding families. Types absent here (x-ray, wound-care, tick-removal,
 * staple-removal, oral-rehydration, nasal-lavage) are uncovered by design.
 */
export const PROCEDURE_TYPE_TO_CODING_FAMILY: Record<string, ProcedureCodingFamilyId> = {
  'laceration-repair': 'laceration',
  'ear-lavage': 'cerumen',
  'abscess-drainage': 'incision-drainage',
  'splint-application': 'splinting',
  'foreign-body-removal': 'foreign-body',
  'eye-irrigation': 'foreign-body',
  'nasal-packing': 'nasal-packing',
  'burn-treatment': 'burn-treatment',
  ekg: 'ekg',
  'urinary-catheterization': 'urinary-catheterization',
  'wart-treatment': 'lesion-destruction',
  'im-medication-injection': 'injection-infusion',
  'iv-fluid-administration': 'injection-infusion',
  'nail-trephination': 'nail-trephination',
  'elbow-reduction': 'nursemaid-elbow',
  'iv-catheter-placement': 'iv-catheter-placement',
  'nebulizer-treatment': 'nebulizer',
};

export const detectProcedureCodingFamily = (
  procedureTypeCode: string | undefined
): ProcedureCodingFamilyId | undefined =>
  procedureTypeCode != null ? PROCEDURE_TYPE_TO_CODING_FAMILY[procedureTypeCode] : undefined;

/** Drops never-filled wound rows (the form seeds a blank row per selected site) and
 * sites left with no rows, so empty `{}` wounds don't persist. */
const cleanWoundMap = (wounds: unknown): Record<string, LacerationWound[]> | undefined => {
  if (wounds == null || typeof wounds !== 'object') {
    return undefined;
  }
  const cleaned = Object.entries(wounds as Record<string, LacerationWound[]>).flatMap(
    ([siteKey, list]): [string, LacerationWound[]][] => {
      if (!Array.isArray(list)) {
        return [];
      }
      const nonEmpty = list.filter(
        (wound) => wound != null && Object.values(wound).some((value) => value !== undefined)
      );
      return nonEmpty.length > 0 ? [[siteKey, nonEmpty]] : [];
    }
  );
  return cleaned.length > 0 ? Object.fromEntries(cleaned) : undefined;
};

export const serializeStructuredFacts = (facts: StructuredProcedureFacts | undefined): string | undefined => {
  if (facts == null) {
    return undefined;
  }
  if (facts.family === 'laceration') {
    return JSON.stringify({ ...facts, wounds: cleanWoundMap(facts.wounds) });
  }
  return JSON.stringify(facts);
};

export const parseStructuredFacts = (value: string | undefined): StructuredProcedureFacts | undefined => {
  if (value == null) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      PROCEDURE_CODING_FAMILY_IDS.includes((parsed as { family?: string }).family as ProcedureCodingFamilyId)
    ) {
      return parsed as StructuredProcedureFacts;
    }
    return undefined;
  } catch {
    // Malformed persisted facts render as absent rather than breaking the chart read.
    return undefined;
  }
};

// Normalization guidance from the laceration site vocabulary: legacy free-form
// sites collapse onto the CPT site vocabulary before siding.
const LEGACY_SITE_NORMALIZATION: Record<string, string> = {
  torso: 'trunk',
  genital: 'genitalia',
  chest: 'trunk',
  back: 'trunk',
  abdomen: 'trunk',
  flank: 'trunk',
  buttock: 'trunk',
  shoulder: 'arm',
  elbow: 'arm',
  forearm: 'arm',
  wrist: 'arm',
  hip: 'leg',
  thigh: 'leg',
  knee: 'leg',
  shin: 'leg',
  calf: 'leg',
  ankle: 'leg',
  finger: 'hand',
  palm: 'hand',
  toe: 'foot',
  heel: 'foot',
  sole: 'foot',
};

/**
 * Legacy bodySite/bodySide → sided-site shim, shared by the quick-pick and
 * template prefill paths and by the form's laceration wound seeding. Returns a
 * wound-map key: '<site>-left'/'<site>-right' for paired sites with a known
 * side, '<site>-unsided' for paired sites without one (legacy-import
 * convention), the bare site for unsided sites, or undefined for anything
 * outside the laceration site vocabulary.
 */
export const sidedSiteFromLegacyBodySite = (
  bodySite: string | undefined,
  bodySide: string | undefined
): string | undefined => {
  if (bodySite == null) {
    return undefined;
  }
  // Collapse punctuation/whitespace so both plain sites ("Arm") and the sided
  // vocabulary entries ("Arm - Left") normalize to hyphenated keys.
  const normalizedInput = bodySite
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const sidedMatch = normalizedInput.match(/^(.*)-(left|right)$/);
  if (sidedMatch != null) {
    const base = LEGACY_SITE_NORMALIZATION[sidedMatch[1]] ?? sidedMatch[1];
    if ((LACERATION_PAIRED_SITES as readonly string[]).includes(base)) {
      return `${base}-${sidedMatch[2]}`;
    }
    if ((LACERATION_UNSIDED_SITES as readonly string[]).includes(base)) {
      return base;
    }
  }
  const site = LEGACY_SITE_NORMALIZATION[normalizedInput] ?? normalizedInput;
  if ((LACERATION_UNSIDED_SITES as readonly string[]).includes(site)) {
    return site;
  }
  if ((LACERATION_PAIRED_SITES as readonly string[]).includes(site)) {
    const side = bodySide?.trim().toLowerCase();
    if (side === 'left' || side === 'right') {
      return `${site}-${side}`;
    }
    return `${site}-unsided`;
  }
  return undefined;
};

export interface StructuredFactsDisplayField {
  label: string;
  value: string;
}

const optionLabel = (options: FieldOption[] | undefined, value: string): string =>
  options?.find((option) => option.value === value)?.label ?? value;

const formatSimpleField = (field: SimpleFieldManifest, rawValue: unknown): string | undefined => {
  if (rawValue == null || rawValue === '') {
    return undefined;
  }
  switch (field.kind) {
    case 'checkbox':
      return rawValue === true ? 'Yes' : undefined;
    case 'select':
      return optionLabel(field.options, String(rawValue));
    case 'multiselect':
      return Array.isArray(rawValue) && rawValue.length > 0
        ? rawValue.map((value) => optionLabel(field.options, String(value))).join(', ')
        : undefined;
    case 'number':
      return typeof rawValue === 'number' ? String(field.scale != null ? rawValue / field.scale : rawValue) : undefined;
    default:
      return String(rawValue);
  }
};

const formatRepeatableGroup = (
  field: RepeatableGroupManifest,
  rawValue: unknown
): StructuredFactsDisplayField | undefined => {
  if (!Array.isArray(rawValue) || rawValue.length === 0) {
    return undefined;
  }
  const rows = rawValue
    .map((item) =>
      field.itemFields
        .map((itemField) => formatSimpleField(itemField, (item as Record<string, unknown>)[itemField.name]))
        .filter((value): value is string => value != null)
        .join(', ')
    )
    .filter((row) => row.length > 0);
  return rows.length > 0 ? { label: field.label, value: rows.join('; ') } : undefined;
};

/** Display label for a wound-map site key ('arm-left' → 'Arm (left)'; legacy
 * '-unsided' keys drop the suffix). Shared by display surfaces and the form. */
export const woundSiteLabel = (manifest: WoundMapManifest, siteKey: string): string => {
  const sideMatch = siteKey.match(/^(.*)-(left|right|unsided)$/);
  const baseKey = sideMatch ? sideMatch[1] : siteKey;
  const base =
    [...manifest.pairedSites, ...manifest.unsidedSites, manifest.otherOption].find((option) => option.value === baseKey)
      ?.label ?? baseKey;
  return sideMatch && sideMatch[2] !== 'unsided' ? `${base} (${sideMatch[2]})` : base;
};

const formatWoundMap = (manifest: WoundMapManifest, rawValue: unknown): StructuredFactsDisplayField[] => {
  if (rawValue == null || typeof rawValue !== 'object') {
    return [];
  }
  return Object.entries(rawValue as Record<string, LacerationWound[]>).flatMap(([siteKey, wounds]) => {
    if (!Array.isArray(wounds) || wounds.length === 0) {
      return [];
    }
    const value = wounds
      .map((wound) => {
        const parts: string[] = [];
        if (wound.lengthCm != null) parts.push(`${wound.lengthCm} cm`);
        if (wound.depth != null) parts.push(optionLabel(manifest.depthOptions, wound.depth));
        if (wound.complexElements?.length)
          parts.push(
            wound.complexElements.map((element) => optionLabel(manifest.complexElementOptions, element)).join(', ')
          );
        if (wound.contaminated === true) parts.push('contaminated, extensive cleaning');
        return parts.join(', ');
      })
      .filter((part) => part.length > 0)
      .join(' | ');
    return value.length > 0
      ? [{ label: `Wound — ${woundSiteLabel(manifest, siteKey)}`, value }]
      : [{ label: `Wound — ${woundSiteLabel(manifest, siteKey)}`, value: 'documented' }];
  });
};

const isSimpleField = (field: ManifestField): field is SimpleFieldManifest =>
  field.kind !== 'repeatable-group' && field.kind !== 'wound-map';

/**
 * Label for a stored CPT code on display surfaces: code with attached modifiers
 * ("29105-LT", matching the template-detail convention), a "× units" suffix when
 * more than one unit is billed, then the descriptor. Engine-suggested codes
 * persist the bare code as `display` (the FHIR mapping requires a non-empty
 * display), so skip the descriptor when it would just repeat the code.
 */
export const formatCptCodeForDisplay = (
  cpt: { code: string; display: string; modifier?: { code: string }[]; billableUnits?: number },
  separator = ' '
): string => {
  let label = cpt.modifier?.length ? `${cpt.code}-${cpt.modifier.map((m) => m.code).join(',-')}` : cpt.code;
  if (cpt.billableUnits != null && cpt.billableUnits > 1) {
    label += ` × ${cpt.billableUnits}`;
  }
  return cpt.display && cpt.display !== cpt.code ? `${label}${separator}${cpt.display}` : label;
};

/**
 * Renders stored structured facts as label/value pairs in manifest order.
 * Display surfaces show every populated fact regardless of the form's
 * conditional visibility, so stored data never disappears.
 */
export const formatStructuredFactsForDisplay = (
  facts: StructuredProcedureFacts | undefined
): StructuredFactsDisplayField[] => {
  if (facts == null) {
    return [];
  }
  const manifest = PROCEDURE_FAMILY_MANIFESTS[facts.family];
  if (manifest == null) {
    return [];
  }
  const record = facts as unknown as Record<string, unknown>;
  return manifest.fields.flatMap((field): StructuredFactsDisplayField[] => {
    if (field.kind === 'wound-map') {
      return formatWoundMap(field, record[field.name]);
    }
    if (field.kind === 'repeatable-group') {
      const formatted = formatRepeatableGroup(field, record[field.name]);
      return formatted != null ? [formatted] : [];
    }
    if (isSimpleField(field)) {
      const value = formatSimpleField(field, record[field.name]);
      return value != null ? [{ label: field.label, value }] : [];
    }
    return [];
  });
};
