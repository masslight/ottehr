import type { LateralityValue } from '../../fhir/radiology';
import { PRELIMINARY_READ_TEMPLATES } from './preliminaryReadTemplates';
import type { PreliminaryReadChoiceList, PreliminaryReadRegion } from './preliminaryReadTypes';

export interface PreliminaryReadBlank {
  title: string;
  options: string[];
  /** The value the blank starts on; `undefined` means it must be picked before the sentence can be added */
  initial: string | undefined;
}

/** A template split into literal text and the blanks the provider can change */
export type PreliminaryReadSegment = string | PreliminaryReadBlank;

export interface PreliminaryReadSuggestion {
  name: string;
  segments: PreliminaryReadSegment[];
}

export const PRELIMINARY_READ_NONE_LABEL = '(none)';
const PRELIMINARY_READ_SIDE_BLANK = 'side';
const SIDE_CHOICES: PreliminaryReadChoiceList = { title: 'Side', options: ['left', 'right'], mustPick: true };
const SIDE_BY_LATERALITY: Partial<Record<LateralityValue, string>> = { LT: 'left', RT: 'right' };

export const findPreliminaryReadRegion = (cptCode: string | undefined): PreliminaryReadRegion | undefined => {
  const baseCode = cptCode?.split('-')[0];
  return baseCode ? PRELIMINARY_READ_TEMPLATES.regions.find((region) => region.cptCodes.includes(baseCode)) : undefined;
};

export const buildPreliminaryReadSuggestions = (input: {
  cptCode?: string;
  laterality?: LateralityValue;
  isChild: boolean;
}): PreliminaryReadSuggestion[] => {
  const region = findPreliminaryReadRegion(input.cptCode);
  if (!region) return [];
  const side = input.laterality && SIDE_BY_LATERALITY[input.laterality];

  return region.templates.map((template) => {
    const segments: PreliminaryReadSegment[] = [];
    const tokens = /\{(\w+)\}/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = tokens.exec(template.text))) {
      const [token, name] = match;
      segments.push(template.text.slice(cursor, match.index));
      cursor = match.index + token.length;
      if (name === PRELIMINARY_READ_SIDE_BLANK && side) {
        segments.push(side);
        continue;
      }
      const list = name === PRELIMINARY_READ_SIDE_BLANK ? SIDE_CHOICES : PRELIMINARY_READ_TEMPLATES.choices[name];
      if (!list) throw new Error(`Preliminary read template "${template.name}" uses an unknown blank {${name}}`);
      if (list.childOnly && !input.isChild) continue;
      const options = input.isChild ? list.options : list.options.filter((o) => !list.childOnlyOptions?.includes(o));
      segments.push({
        title: list.title,
        options,
        initial: list.mustPick ? undefined : (input.isChild && list.childDefault) || options[0],
      });
    }
    segments.push(template.text.slice(cursor));
    return { name: template.name, segments: tidySegments(segments) };
  });
};

/**
 * Adjacent literals (left by a fixed side or a dropped child-only blank) merged, runs of whitespace collapsed
 * and the ends trimmed, so the segments read the same on screen as the assembled sentence does.
 */
const tidySegments = (segments: PreliminaryReadSegment[]): PreliminaryReadSegment[] => {
  const merged: PreliminaryReadSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (typeof segment === 'string' && typeof last === 'string') merged[merged.length - 1] = last + segment;
    else merged.push(segment);
  }
  return merged
    .map((segment, i) => {
      if (typeof segment !== 'string') return segment;
      const text = segment.replace(/\s+/g, ' ');
      return i === 0 ? text.trimStart() : i === merged.length - 1 ? text.trimEnd() : text;
    })
    .filter((segment) => segment !== '');
};

export const findUnpickedBlank = (
  segments: PreliminaryReadSegment[],
  values: (string | undefined)[]
): PreliminaryReadBlank | undefined =>
  segments.find(
    (segment, i): segment is PreliminaryReadBlank =>
      typeof segment !== 'string' && segment.initial === undefined && values[i] === undefined
  );

const CONFLICTS = new Map<string, Set<string>>();
for (const [a, b] of PRELIMINARY_READ_TEMPLATES.conflicts) {
  CONFLICTS.set(a, (CONFLICTS.get(a) ?? new Set()).add(b));
  CONFLICTS.set(b, (CONFLICTS.get(b) ?? new Set()).add(a));
}

export const findConflictingValue = (
  segments: PreliminaryReadSegment[],
  values: (string | undefined)[],
  index: number,
  option: string
): string | undefined => {
  const conflicts = CONFLICTS.get(option);
  if (!conflicts) return undefined;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (i === index || typeof segment === 'string') continue;
    const current = values[i] ?? segment.initial;
    if (current !== undefined && conflicts.has(current)) return current;
  }
  return undefined;
};

export const assemblePreliminaryRead = (segments: PreliminaryReadSegment[], values: (string | undefined)[]): string =>
  segments
    .map((segment, i) => (typeof segment === 'string' ? segment : values[i] ?? segment.initial ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/ \./g, '.')
    .trim();
