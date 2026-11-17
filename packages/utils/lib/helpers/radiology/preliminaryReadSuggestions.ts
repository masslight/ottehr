import type { LateralityValue } from '../../fhir/radiology';
import { parseTemplate, SentenceBlank } from '../suggested-sentences';
import { PRELIMINARY_READ_TEMPLATES } from './preliminaryReadTemplates';
import type { PreliminaryReadChoiceList, PreliminaryReadRegion } from './preliminaryReadTypes';

export interface PreliminaryReadBlank extends SentenceBlank {
  emptyWhen?: string[];
}

/** A template split into literal text and the blanks the provider can change */
export type PreliminaryReadSegment = string | PreliminaryReadBlank;

export interface PreliminaryReadSuggestion {
  name: string;
  segments: PreliminaryReadSegment[];
}

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

  return region.templates.map((template) => ({
    name: template.name,
    segments: parseTemplate<PreliminaryReadBlank>(template.text, (name) => {
      if (name === PRELIMINARY_READ_SIDE_BLANK && side) return side;
      const list = name === PRELIMINARY_READ_SIDE_BLANK ? SIDE_CHOICES : PRELIMINARY_READ_TEMPLATES.choices[name];
      if (!list) throw new Error(`Preliminary read template "${template.name}" uses an unknown blank {${name}}`);
      if (list.childOnly && !input.isChild) return undefined;
      const options = input.isChild ? list.options : list.options.filter((o) => !list.childOnlyOptions?.includes(o));
      return {
        title: list.title,
        options,
        initial: list.mustPick ? undefined : (input.isChild && list.childDefault) || options[0],
        ...(list.emptyWhen && { emptyWhen: list.emptyWhen }),
      };
    }),
  }));
};

const CONFLICTS = new Map<string, Set<string>>();
for (const [a, b] of PRELIMINARY_READ_TEMPLATES.conflicts) {
  CONFLICTS.set(a, (CONFLICTS.get(a) ?? new Set()).add(b));
  CONFLICTS.set(b, (CONFLICTS.get(b) ?? new Set()).add(a));
}

export const findConflictingValue = (
  values: (string | undefined)[],
  index: number,
  option: string
): string | undefined => {
  const conflicts = CONFLICTS.get(option);
  if (!conflicts) return undefined;
  return values.find((value, i) => i !== index && value !== undefined && conflicts.has(value));
};

export const resolvePreliminaryReadValues = (
  segments: PreliminaryReadSegment[],
  values: (string | undefined)[]
): (string | undefined)[] => {
  const resolved = segments.map((segment, i) => (typeof segment === 'string' ? undefined : values[i]));

  segments.forEach((segment, i) => {
    if (typeof segment === 'string' || values[i] !== undefined || segment.initial === undefined) return;
    const fits = (option: string): boolean => !findConflictingValue(resolved, i, option);
    resolved[i] = fits(segment.initial) ? segment.initial : segment.options.find(fits) ?? segment.initial;
  });

  segments.forEach((segment, i) => {
    if (typeof segment === 'string' || values[i] !== undefined || !segment.emptyWhen) return;
    const waitsOn = segment.emptyWhen;
    if (resolved.some((value, j) => j !== i && value !== undefined && waitsOn.includes(value))) resolved[i] = '';
  });
  return resolved;
};

export const assemblePreliminaryRead = (segments: PreliminaryReadSegment[], values: (string | undefined)[]): string => {
  const resolved = resolvePreliminaryReadValues(segments, values);
  const text = segments
    .map((segment, i) => (typeof segment === 'string' ? segment : resolved[i] ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/ \./g, '.')
    .trim();

  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const appendToPreliminaryRead = (existing: string | undefined, sentence: string): string => {
  if (!existing?.trim()) return sentence;
  return existing.endsWith('\n') ? `${existing}${sentence}` : `${existing}\n${sentence}`;
};
