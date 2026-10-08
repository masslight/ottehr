import type { PreliminaryReadChoiceList, PreliminaryReadRegion } from 'config-types/config/radiology';
import type { LateralityValue } from '../../fhir/radiology';
import { parseTemplate, SentenceSegment } from '../suggested-sentences';
import { PRELIMINARY_READ_TEMPLATES } from './preliminaryReadTemplates';

/** A template split into literal text and the blanks the provider can change */
export interface PreliminaryReadSuggestion {
  name: string;
  segments: SentenceSegment[];
}

const PRELIMINARY_READ_SIDE_BLANK = 'side';
const SIDE_CHOICES: PreliminaryReadChoiceList = { title: 'Side', options: ['left', 'right', 'bilateral'] };
const SIDE_BY_LATERALITY: Partial<Record<LateralityValue, string>> = { LT: 'left', RT: 'right' };

export const findPreliminaryReadRegion = (cptCode: string | undefined): PreliminaryReadRegion | undefined => {
  const baseCode = cptCode?.split('-')[0];
  return baseCode ? PRELIMINARY_READ_TEMPLATES.regions.find((region) => region.cptCodes.includes(baseCode)) : undefined;
};

/**
 * The region's templates for one order, with `{side}` resolved from the laterality, child-only blanks dropped
 * for adults and every blank on its default. When the order doesn't fix a side (no modifier, or bilateral)
 * `{side}` becomes a left/right/bilateral blank with no default: the wrong side is the one mistake a template
 * must not make for the provider.
 */
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
    segments: parseTemplate(template.text, (name) => {
      if (name === PRELIMINARY_READ_SIDE_BLANK && side) return side;
      const list = name === PRELIMINARY_READ_SIDE_BLANK ? SIDE_CHOICES : PRELIMINARY_READ_TEMPLATES.choices[name];
      if (!list) throw new Error(`Preliminary read template "${template.name}" uses an unknown blank {${name}}`);
      if (list.childOnly && !input.isChild) return undefined;
      const options = input.isChild ? list.options : list.options.filter((o) => !list.childOnlyOptions?.includes(o));
      return {
        title: list.title,
        options,
        initial: list === SIDE_CHOICES ? undefined : (input.isChild && list.childDefault) || options[0],
      };
    }),
  }));
};
