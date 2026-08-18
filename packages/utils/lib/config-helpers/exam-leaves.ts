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
  /** The chart-data field name this leaf writes. */
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
}

/** Every selectable leaf in an exam config, in config order. */
export function buildExamLeafCatalogue(examConfig: ExamItemConfig): ExamLeaf[] {
  const leaves: ExamLeaf[] = [];

  const push = (
    field: string,
    leafLabel: string,
    path: string[],
    sectionKey: string,
    sectionLabel: string,
    polarity: 'normal' | 'abnormal'
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
    });
  };

  const walkModal = (
    modal: Record<string, ExamModalWithColumnsSection>,
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
          for (const [field, option] of Object.entries(group.options)) {
            push(
              field,
              option.label,
              [...columnPath, group.label],
              sectionKey,
              sectionLabel,
              // A modal option declares its own polarity, which is more reliable than the side of
              // the card the modal's checkbox happens to live on.
              option.abnormal === false ? 'normal' : option.abnormal === true ? 'abnormal' : polarity
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
          walkModal(component.modal, [...path, component.label], sectionKey, sectionLabel, polarity);
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
