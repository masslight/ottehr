/**
 * Template sentences offered above a free-text or structured field: literal text with blanks the provider
 * can change from a list, and numbers copied from what they entered. Radiology's suggested reads and the
 * EKG's suggested interpretations are both built on this model; nothing here reads a chart or an image.
 */

export interface SentenceBlank {
  title: string;
  options: string[];
  /** The value the blank starts on; `undefined` means it must be picked before the sentence can be added */
  initial: string | undefined;
}

/** A number the provider entered, shown in the sentence as it was typed. */
export interface SentenceNumber {
  number: string;
}

export type SentenceSegment = string | SentenceBlank | SentenceNumber;

/** Shown for the empty option (`''`), which contributes nothing to the sentence. */
export const NONE_OPTION_LABEL = '(none)';

export const isSentenceBlank = (segment: SentenceSegment): segment is SentenceBlank =>
  typeof segment !== 'string' && 'options' in segment;

/** The first blank with neither a default nor a picked value — the sentence can't be added until it has one. */
export const findUnpickedBlank = (
  segments: SentenceSegment[],
  values: (string | undefined)[]
): SentenceBlank | undefined =>
  segments.find(
    (segment, i): segment is SentenceBlank =>
      isSentenceBlank(segment) && segment.initial === undefined && values[i] === undefined
  );

/** The finished sentence; `values[i]` overrides the blank at segment `i`, and '' (none) contributes nothing. */
export const assembleSentence = (segments: SentenceSegment[], values: (string | undefined)[]): string =>
  segments
    .map((segment, i) =>
      typeof segment === 'string'
        ? segment
        : isSentenceBlank(segment)
        ? values[i] ?? segment.initial ?? ''
        : segment.number
    )
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/ \./g, '.')
    .trim();
