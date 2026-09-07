// Flatten the exam config into a list of SELECTABLE LEAVES: every checkbox a provider can tick,
// with the label they read and the body-system card it sits under.
//
// This is a shared config helper rather than Easy Chart's own, because it is the exam config's own
// shape being described — a quick-add search, a keyboard palette or a config audit all want the same
// list. `buildExamFieldToSectionMap` already walks this tree for section grouping; this walks it for
// the labels, which is what anything matching free text against the exam needs.

import type {
  ExamCardComponent,
  ExamCardNonTextComponent,
  ExamItemConfig,
  ExamModalWithColumnsSection,
} from 'config-types';
import { isDropdownComponent, isMultiSelectComponent } from '../ottehr-config/examination/examination.schema';

export interface ExamLeaf {
  /**
   * The SAVEABLE chart-data field. For a modal option this is the PARENT checkbox's field, not the
   * option's own key: `getAllExamFieldsMetadata` only registers the parent, and save-chart-data rejects
   * anything else with "Exam observation with field … not found".
   */
  field: string;
  /** What the provider reads, fully qualified ("Right: Appearance: Swelling"). */
  label: string;
  /** Just the leaf's own words, without the path. What free text is actually matched against. */
  leafLabel: string;
  /** Body-system card, e.g. "Ears". An exam finding must not be filed under a different one. */
  sectionKey: string;
  sectionLabel: string;
  /** Which side of the card it sits on. A normal is not an abnormal finding and vice versa. */
  polarity: 'normal' | 'abnormal';
  /** The path from the card down to the leaf, for disambiguating in a picker. */
  path: string[];
  /**
   * Set when this leaf is an option inside a checkbox-with-modal. Such an option is NOT its own
   * observation — it is stored as a component of `field`, so the write has to build the component
   * rather than a second row.
   */
  component?: { code: string; label: string; groupLabel: string; columnLabel?: string; abnormal?: boolean };
}

/**
 * Every selectable leaf in an exam config, in config order.
 *
 * NOTE: several leaves can share one `field` — a checkbox-with-modal's options all save into the
 * parent observation, distinguished by their `component`. Do not key a map on `field` alone.
 */
export function buildExamLeafCatalogue(examConfig: ExamItemConfig): ExamLeaf[] {
  const leaves: ExamLeaf[] = [];

  const push = (
    field: string,
    leafLabel: string,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal',
    component?: ExamLeaf['component']
  ): void => {
    if (!leafLabel?.trim()) return;
    leaves.push({
      field,
      leafLabel,
      label: [...path, leafLabel].filter(Boolean).join(': '),
      sectionKey,
      sectionLabel,
      polarity,
      path,
      ...(component ? { component } : {}),
    });
  };

  const walkModal = (
    modal: Record<string, ExamModalWithColumnsSection>,
    parentField: string,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal'
  ): void => {
    for (const section of Object.values(modal)) {
      for (const column of Object.values(section.columns)) {
        // The column header is the laterality ("Left"/"Right") and is load-bearing: an abnormal on
        // one side must not match the normal on the other.
        const columnPath = [...path, section.label, column.header ?? ''].filter(Boolean);
        for (const group of Object.values(column.groups)) {
          for (const [optionKey, option] of Object.entries(group.options)) {
            push(
              // The PARENT's field, not `optionKey`. An option key is not a saveable observation —
              // saving one returns "Exam observation with field … not found".
              parentField,
              option.label,
              [...columnPath, group.label],
              sectionKey,
              sectionLabel,
              // A modal option declares its own polarity, which is more reliable than the side of
              // the card the modal's checkbox happens to live on.
              option.abnormal === false ? 'normal' : option.abnormal === true ? 'abnormal' : polarity,
              {
                code: optionKey,
                label: option.label,
                groupLabel: group.label,
                ...(column.header ? { columnLabel: column.header } : {}),
                ...(option.abnormal != null ? { abnormal: option.abnormal } : {}),
              }
            );
          }
        }
      }
    }
  };

  const walk = (
    components: Record<string, ExamCardComponent>,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal'
  ): void => {
    for (const [field, component] of Object.entries(components)) {
      switch (component.type) {
        // Comment boxes are free text, not selectable findings.
        case 'text':
          break;
        case 'checkbox':
          // A legacy field is only rendered when it already holds data, so it must never be a
          // match target for something new.
          if (!component.legacy) push(field, component.label, path, sectionKey, sectionLabel, polarity);
          break;
        case 'checkbox-with-modal':
          push(field, component.label, path, sectionKey, sectionLabel, polarity);
          walkModal(component.modal, field, [...path, component.label], sectionKey, sectionLabel, polarity);
          break;
        case 'dropdown':
          if (isDropdownComponent(component)) {
            for (const [optionField, option] of Object.entries(component.components)) {
              push(optionField, option.label, [...path, component.label], sectionKey, sectionLabel, polarity);
            }
          }
          break;
        case 'multi-select':
          if (isMultiSelectComponent(component)) {
            for (const [optionField, option] of Object.entries(component.options)) {
              push(optionField, option.label, [...path, component.label], sectionKey, sectionLabel, polarity);
            }
          }
          break;
        case 'column':
          walk(component.components, [...path, component.label].filter(Boolean), sectionKey, sectionLabel, polarity);
          break;
        case 'form':
          for (const field2 of Object.keys(component.components)) {
            push(field2, humanizeFieldName(field2), [...path, component.label], sectionKey, sectionLabel, polarity);
          }
          break;
      }
    }
  };

  for (const [sectionKey, card] of Object.entries(examConfig)) {
    walk(card.components.normal as Record<string, ExamCardNonTextComponent>, [], sectionKey, card.label, 'normal');
    walk(card.components.abnormal as Record<string, ExamCardNonTextComponent>, [], sectionKey, card.label, 'abnormal');
  }

  return leaves;
}

/**
 * Form elements are keyed rather than labelled, so the key IS the label a provider sees. Mirrors the
 * formatting `extractObservationsFromExamComponents` already applies to the same keys.
 */
function humanizeFieldName(fieldName: string): string {
  return fieldName
    .split('-')
    .map((word) =>
      word
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
        .trim()
    )
    .join(' ');
}

/**
 * Each exam card's free-text COMMENT field, keyed by both section key and section label.
 *
 * The exam tab is mostly checkboxes plus one free-text area per card. That area is where a dictated
 * observation goes when the checkbox catalogue cannot represent it: "positive Homan's sign" is a real
 * finding with no leaf to tick, and the alternative to writing it here is losing the provider's words
 * entirely. Keyed by both because a caller may hold either — the leaf catalogue carries `sectionKey`,
 * while a section label is what a human-readable inference produces.
 */
export function buildExamCommentFields(examConfig: ExamItemConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [sectionKey, card] of Object.entries(examConfig)) {
    const field = Object.keys(card.components.comment ?? {})[0];
    if (!field) continue;
    map[sectionKey] = field;
    if (card.label) map[card.label] = field;
  }
  return map;
}

/**
 * The exam card a free-text finding belongs to, or undefined when it cannot be told confidently.
 *
 * HIGH PRECISION OVER COVERAGE, deliberately: only a word from the CARD'S OWN NAME counts, and only
 * when exactly one card matches. A finding filed under the wrong body system is worse than one filed
 * under the general card — "Photophobia" appearing under Genitourinary is actively misleading in a
 * signed note, and that is what a scoring heuristic over leaf labels produced (it also sent "left ear
 * canal" to Lungs, on the strength of "tenderness" appearing in several chest-wall leaves).
 *
 * So this answers only the easy cases — "ear canal", "lung field", "abdomen soft" — and returns
 * undefined for everything else, which the caller files under the general card. Widening it means
 * adding an anatomy vocabulary curated to the same standard: a term that names exactly one card, and
 * nothing for a term that does not ("discharge" is any orifice; "vestibule" is nasal or vaginal).
 */
export function inferExamSectionKey(text: string, leaves: ExamLeaf[]): string | undefined {
  const words = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
  if (words.size === 0) return undefined;

  const hits = new Set<string>();
  // Terms that name exactly ONE card but share no word with its name. Curated to the same standard as
  // the card-name match: a term that could belong to two cards is deliberately absent, so it falls
  // through to the general card rather than guessing.
  for (const word of words) {
    const section = UNAMBIGUOUS_ANATOMY[word];
    if (section) hits.add(section);
  }
  const seen = new Set<string>();
  for (const leaf of leaves) {
    if (seen.has(leaf.sectionKey)) continue;
    seen.add(leaf.sectionKey);
    const name = `${leaf.sectionKey} ${leaf.sectionLabel}`.toLowerCase().split(/[^a-z0-9]+/);
    for (const word of words) {
      // Whole word against whole word, tolerating only a plural 's' — substring matching makes "ear"
      // hit "smear" and "back" hit "backache" in another card's name, while a strict equality misses
      // the singular/plural split every card name has ("ear canal" vs the card "Ears").
      if (name.some((part) => part === word || part === `${word}s` || `${part}s` === word)) {
        hits.add(leaf.sectionKey);
      }
    }
  }
  return hits.size === 1 ? [...hits][0] : undefined;
}

/**
 * Anatomy that names exactly one exam card without sharing a word with its label. Kept short on
 * purpose: every entry is a term a clinician would only ever use about that one card. Anything
 * ambiguous ("discharge" is any orifice, "vestibule" is nasal or vaginal) belongs nowhere near here.
 */
const UNAMBIGUOUS_ANATOMY: Record<string, string> = {
  tympanic: 'ears',
  auricle: 'ears',
  tragus: 'ears',
  otoscopy: 'ears',
  cerumen: 'ears',
  photophobia: 'eyes',
  conjunctiva: 'eyes',
  conjunctival: 'eyes',
  sclera: 'eyes',
  pupil: 'eyes',
  pupils: 'eyes',
  nasal: 'nose',
  nares: 'nose',
  pharynx: 'oral',
  pharyngeal: 'oral',
  oropharynx: 'oral',
  tonsils: 'oral',
  tonsillar: 'oral',
  wrist: 'extremities',
  ankle: 'extremities',
  knee: 'extremities',
  elbow: 'extremities',
  shoulder: 'extremities',
  wheeze: 'lungs',
  wheezing: 'lungs',
  crackles: 'lungs',
  rales: 'lungs',
  cervical: 'neck',
  lymphadenopathy: 'lymph',
  murmur: 'heart',
};

/** Words too generic to point at a body system. */
const STOP_WORDS = new Set([
  'with',
  'without',
  'positive',
  'negative',
  'mild',
  'moderate',
  'severe',
  'noted',
  'sign',
  // Laterality and vague position words identify no card.
  'left',
  'right',
  'bilateral',
  'over',
  'the',
  'and',
  'area',
  'region',
]);
