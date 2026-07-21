// Exam / ROS leaf catalogs: flattened indexes of every checkable finding in examConfig and
// the ROS config, used by the intent matchers and the note renderer.
import type { ExamItemConfig } from 'config-types';
import { examConfig, InPersonRosConfig } from 'utils';

// Walk examConfig once to map every leaf exam field name to its most-specific section label
// (e.g. "Right ear" inside the "Ears" card) so we can group abnormal findings by body section.
export function buildFieldToSectionLabel(config: ExamItemConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [, section] of Object.entries(config)) {
    const walk = (components: Record<string, unknown>, currentLabel: string): void => {
      for (const [key, comp] of Object.entries(components)) {
        const c = comp as { type?: string; label?: string; components?: Record<string, unknown> };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          walk(c.components, c.label ?? currentLabel);
        } else {
          map[key] = currentLabel;
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>, section.label);
    walk(section.components.abnormal as Record<string, unknown>, section.label);
    walk(section.components.comment as Record<string, unknown>, section.label);
  }
  return map;
}

export const FIELD_TO_SECTION_LABEL = buildFieldToSectionLabel(examConfig.default.components);

// Section label → its free-text comment field. The exam tab is mostly checkboxes plus one
// free-text area per section; findings the matcher can't confidently map to a checkbox get
// APPENDED here so they land in the physical-exam section of the note (not lost in HPI prose).
export const SECTION_TO_COMMENT_FIELD: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [, section] of Object.entries(examConfig.default.components)) {
    const commentKeys = Object.keys((section.components.comment as Record<string, unknown>) ?? {});
    if (commentKeys.length > 0) map[section.label] = commentKeys[0];
  }
  return map;
})();

// Most-specific section label → its top-level exam CARD label ("Right eye" → "Eyes",
// "Rectal" → "Rectal"). The leaf index stores the most-specific label, but the anatomy-section
// guard in intent-logic compares at the card level, so it needs this rollup. Card labels are
// seeded first so they always map to themselves; nested labels are first-wins.
export const SECTION_LABEL_TO_CARD: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [, section] of Object.entries(examConfig.default.components)) map[section.label] = section.label;
  for (const [, section] of Object.entries(examConfig.default.components)) {
    const walk = (components: Record<string, unknown>): void => {
      for (const [, comp] of Object.entries(components)) {
        const c = comp as { type?: string; label?: string; components?: Record<string, unknown> };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          if (c.label && !(c.label in map)) map[c.label] = section.label;
          walk(c.components);
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>);
    walk(section.components.abnormal as Record<string, unknown>);
    walk(section.components.comment as Record<string, unknown>);
  }
  return map;
})();

// Flat index of every CHECKBOX leaf in the exam template, keyed by the field code so the
// refine-bar "add exam finding" handler can fuzzy-match the provider's phrasing against
// labels and present the closest candidates.
export interface ExamLeaf {
  field: string;
  label: string;
  section: string;
  normalAbnormal: 'normal' | 'abnormal';
  // For modal-option leaves: `field` is the PARENT checkbox code (that's where the
  // ServiceRequest/Observation lives); the picker writes this option as a `components`
  // entry on that parent observation rather than as a separate field.
  modalOption?: {
    optionCode: string;
    optionLabel: string;
    groupLabel: string;
    columnLabel?: string;
    abnormal: boolean;
    parentLabel: string;
  };
}
// Stable, unique key for a leaf. Modal-option leaves share a parent `field`, so the option
// code must be part of the key (otherwise two options under one checkbox collide in the
// multi-select picker and in React list keys).
export function leafKey(leaf: ExamLeaf): string {
  return leaf.modalOption ? `${leaf.field}::${leaf.modalOption.optionCode}` : leaf.field;
}
export function buildExamLeafIndex(config: ExamItemConfig): ExamLeaf[] {
  const out: ExamLeaf[] = [];
  // Walk arbitrary nested objects looking for modal "options" leaves (each is { label }).
  // Picks any { options: { code: { label } } } leaf and emits a virtual leaf per option.
  // Carries the path of intermediate `label`s (e.g. group/column labels like "Frontal" or
  // "Maxillary") into the leaf's display so distinct-but-similarly-named options (e.g.
  // sinus-frontal-l vs sinus-maxillary-l both have option label "Left") don't render as
  // duplicates in the picker.
  const walkModalOptions = (
    node: unknown,
    parentCheckboxKey: string,
    parentCheckboxLabel: string,
    labelPath: string[],
    columnLabel: string | undefined,
    groupLabel: string | undefined,
    section: string,
    normalAbnormal: 'normal' | 'abnormal'
  ): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj.options && typeof obj.options === 'object') {
      for (const [optKey, optVal] of Object.entries(obj.options as Record<string, unknown>)) {
        const opt = optVal as { label?: unknown; abnormal?: unknown } | undefined;
        const optLabel = opt?.label;
        if (typeof optLabel === 'string') {
          out.push({
            field: parentCheckboxKey,
            label: [...labelPath, optLabel].filter(Boolean).join(' — '),
            section,
            normalAbnormal,
            modalOption: {
              optionCode: optKey,
              optionLabel: optLabel,
              groupLabel: groupLabel ?? '',
              columnLabel,
              abnormal: typeof opt?.abnormal === 'boolean' ? opt.abnormal : normalAbnormal === 'abnormal',
              parentLabel: parentCheckboxLabel,
            },
          });
        }
      }
    }
    for (const containerKey of ['columns', 'groups', 'components']) {
      const container = obj[containerKey];
      if (container && typeof container === 'object') {
        for (const child of Object.values(container as Record<string, unknown>)) {
          const childObj = child as { label?: unknown; header?: unknown } | undefined;
          const childLabel = typeof childObj?.label === 'string' ? childObj.label : undefined;
          const childHeader = typeof childObj?.header === 'string' ? childObj.header : undefined;
          // 'columns' nodes typically expose laterality via `header` (e.g. "Left"/"Right");
          // 'groups' and 'components' use `label`. Prefer the right field per container
          // scope so the display path always includes laterality.
          const pathEntry = containerKey === 'columns' ? childHeader ?? childLabel : childLabel ?? childHeader;
          const useful = !!pathEntry && !/^single[-_]?column$/i.test(pathEntry);
          // Avoid consecutive duplicates in the path (e.g. modal section "Status" containing
          // a group also called "Status").
          const nextPath =
            useful && pathEntry !== labelPath[labelPath.length - 1] ? [...labelPath, pathEntry!] : labelPath;
          const nextColumn = containerKey === 'columns' ? childHeader ?? childLabel ?? columnLabel : columnLabel;
          const nextGroup = containerKey === 'groups' ? childLabel ?? groupLabel : groupLabel;
          walkModalOptions(
            child,
            parentCheckboxKey,
            parentCheckboxLabel,
            nextPath,
            nextColumn,
            nextGroup,
            section,
            normalAbnormal
          );
        }
      }
    }
  };

  for (const [, section] of Object.entries(config)) {
    const walk = (
      components: Record<string, unknown>,
      currentSectionLabel: string,
      normalAbnormal: 'normal' | 'abnormal'
    ): void => {
      for (const [key, comp] of Object.entries(components)) {
        const c = comp as {
          type?: string;
          label?: string;
          components?: Record<string, unknown>;
          modal?: Record<string, unknown>;
        };
        if ((c?.type === 'column' || c?.type === 'dropdown') && c.components) {
          walk(c.components, c.label ?? currentSectionLabel, normalAbnormal);
        } else if (c?.type === 'checkbox' && c.label) {
          out.push({ field: key, label: c.label, section: currentSectionLabel, normalAbnormal });
        } else if (c?.type === 'checkbox-with-modal' && c.label && c.modal) {
          // Surface the parent checkbox itself…
          out.push({ field: key, label: c.label, section: currentSectionLabel, normalAbnormal });
          // …plus every nested modal option as its own pickable item.
          for (const modalNode of Object.values(c.modal)) {
            walkModalOptions(
              modalNode,
              key,
              c.label,
              [c.label],
              undefined,
              undefined,
              currentSectionLabel,
              normalAbnormal
            );
          }
        }
      }
    };
    walk(section.components.normal as Record<string, unknown>, section.label, 'normal');
    walk(section.components.abnormal as Record<string, unknown>, section.label, 'abnormal');
  }
  return out;
}
export const EXAM_LEAVES = buildExamLeafIndex(examConfig.default.components);

// ROS catalog — one leaf per Review-of-Systems item (baseKey + label + system), built from the
// practice's ROS config. The denies/reports state is applied at save time via the field suffix.
export interface RosLeaf {
  baseKey: string;
  label: string;
  system: string;
}
export function buildRosLeafIndex(): RosLeaf[] {
  const out: RosLeaf[] = [];
  for (const card of Object.values(InPersonRosConfig)) {
    for (const [baseKey, item] of Object.entries(card.items)) {
      out.push({ baseKey, label: item.label, system: card.label });
    }
  }
  return out;
}
export const ROS_LEAVES = buildRosLeafIndex();
