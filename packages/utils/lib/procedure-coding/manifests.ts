// Per-family field manifests: how each declared fact renders on the procedure
// form (and how stored facts are displayed on read-only surfaces). The field
// data itself is declarative and lives in ./manifests.json (labels, options,
// visibility rules — field `name`s match the family facts declarations
// exactly); this module holds the manifest types and the facts-normalization
// helpers. Facts that are engine-derived (route_profile etc.) or supplied by
// dispatch callers (payer_type / venous_payer_type) are deliberately absent
// from manifests.

import { LacerationRepairDepth } from './facts.types';
import manifestsJson from './manifests.json';
import { ProcedureCodingFamilyId } from './model.types';

export interface FieldOption {
  value: string;
  label: string;
}

export type SimpleFieldKind = 'select' | 'multiselect' | 'checkbox' | 'number' | 'text' | 'time';

/** Show the field only when a sibling fact (same facts object / group item) has one of these values. */
export interface FieldVisibility {
  fact: string;
  anyOf: (string | boolean)[];
}

export interface SimpleFieldManifest {
  name: string;
  kind: SimpleFieldKind;
  label: string;
  /** For select/multiselect. */
  options?: FieldOption[];
  /** number fields: stored value = displayed value × scale (e.g. TBSA % stored in tenths). */
  scale?: number;
  visibleWhen?: FieldVisibility;
  /**
   * Fact value the field carries while visibleWhen hides it (e.g. splint_mobility 'na'
   * for strapping). Facts without one are simply undetermined while hidden.
   */
  valueWhenHidden?: string;
}

export interface RepeatableGroupManifest {
  name: string;
  kind: 'repeatable-group';
  label: string;
  addLabel: string;
  itemFields: SimpleFieldManifest[];
}

/** The laceration wounds map: sided-site multi-select with per-site wound rows. */
export interface WoundMapManifest {
  name: 'wounds';
  kind: 'wound-map';
  label: string;
  pairedSites: FieldOption[];
  unsidedSites: FieldOption[];
  otherOption: FieldOption;
  lengthLabel: string;
  depthLabel: string;
  depthOptions: FieldOption[];
  /** Depth values for which the per-wound "Wound details" disclosure is offered. */
  detailsDepths: LacerationRepairDepth[];
  complexElementOptions: FieldOption[];
  contaminatedLabel: string;
  /** '{site}' placeholder is replaced with the site label by the form. */
  addWoundLabel: string;
}

export type ManifestField = SimpleFieldManifest | RepeatableGroupManifest | WoundMapManifest;

export interface FamilyManifest {
  family: ProcedureCodingFamilyId;
  fields: ManifestField[];
}

// JSON imports widen literal unions (kind, detailsDepths) to string, hence the
// cast; the external validation harness checks the data against the facts
// declarations instead of the compiler.
export const PROCEDURE_FAMILY_MANIFESTS = manifestsJson as unknown as Record<ProcedureCodingFamilyId, FamilyManifest>;

/** Whether a manifest field is shown for the current facts record (form and normalization share this). */
export const isFieldVisible = (visibleWhen: FieldVisibility | undefined, record: Record<string, unknown>): boolean =>
  visibleWhen == null || visibleWhen.anyOf.includes(record[visibleWhen.fact] as string | boolean);

const normalizeRecord = (fields: SimpleFieldManifest[], record: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...record };
  for (const field of fields) {
    if (!isFieldVisible(field.visibleWhen, record)) {
      // Hidden fields carry their declared not-applicable value (checkboxes are
      // false facts, enums their valueWhenHidden); stale values never linger.
      if (field.kind === 'checkbox') next[field.name] = false;
      else if (field.valueWhenHidden !== undefined) next[field.name] = field.valueWhenHidden;
      else delete next[field.name];
    } else if (field.kind === 'checkbox' && next[field.name] === undefined) {
      next[field.name] = false;
    }
  }
  return next;
};

/**
 * Normalizes a facts record for evaluation: untouched checkboxes become explicit
 * `false` facts (the form's unchecked state IS a determination) and fields hidden
 * by visibleWhen are reset to their not-applicable value, so compliance-gate rows
 * keyed on `false` match and hidden stale values can't steer the tables. Facts a
 * legacy import left undetermined (enums, counts) stay undetermined — the
 * evaluator refuses on those (missing:<fact>) rather than guessing.
 */
export function normalizeFactsForFamily(
  family: ProcedureCodingFamilyId,
  facts: Record<string, unknown>
): Record<string, unknown> {
  const manifest = PROCEDURE_FAMILY_MANIFESTS[family];
  const simpleFields = manifest.fields.filter(
    (field): field is SimpleFieldManifest => field.kind !== 'repeatable-group' && field.kind !== 'wound-map'
  );
  const next = normalizeRecord(simpleFields, facts);
  for (const group of manifest.fields) {
    if (group.kind !== 'repeatable-group') continue;
    const items = next[group.name];
    if (Array.isArray(items)) {
      next[group.name] = items.map((item) =>
        item != null && typeof item === 'object'
          ? normalizeRecord(group.itemFields, item as Record<string, unknown>)
          : item
      );
    }
  }
  return next;
}
