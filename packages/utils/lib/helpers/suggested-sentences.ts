export interface SentenceBlank {
  title: string;
  options: string[];
  initial: string | undefined;
}

export interface SentenceNumber {
  number: string;
}

export type SentenceSegment = string | SentenceBlank | SentenceNumber;

export const NONE_OPTION_LABEL = '(none)';

export const isSentenceBlank = (segment: SentenceSegment): segment is SentenceBlank =>
  typeof segment !== 'string' && 'options' in segment;

export const findUnpickedBlank = <S extends SentenceSegment>(
  segments: readonly S[],
  values: (string | undefined)[]
): Extract<S, SentenceBlank> | undefined =>
  segments.find(
    (segment, i): segment is Extract<S, SentenceBlank> =>
      isSentenceBlank(segment) && segment.initial === undefined && values[i] === undefined
  );

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

export const parseTemplate = <S extends SentenceSegment = SentenceSegment>(
  text: string,
  resolve: (name: string) => S | string | undefined
): (S | string)[] => {
  const segments: (S | string)[] = [];
  const push = (segment: S | string): void => {
    const last = segments[segments.length - 1];
    if (typeof segment === 'string' && typeof last === 'string') segments[segments.length - 1] = last + segment;
    else segments.push(segment);
  };
  let cursor = 0;
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const [token, name] = match;
    push(text.slice(cursor, match.index));
    cursor = (match.index ?? 0) + token.length;
    const segment = resolve(name);
    if (segment !== undefined) push(segment);
  }
  push(text.slice(cursor));
  return segments
    .map((segment, i) => {
      if (typeof segment !== 'string') return segment;
      const literal = segment.replace(/\s+/g, ' ');
      return i === 0 ? literal.trimStart() : i === segments.length - 1 ? literal.trimEnd() : literal;
    })
    .filter((segment) => segment !== '');
};
