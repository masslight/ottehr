// Serialization helpers for procedure fields that support a free-text "Other" option.
//
// Multi-select fields (supplies, post-procedure instructions) are persisted on the procedure
// as a single comma-joined string and re-parsed on load; quick picks instead keep the real
// options in an array plus a separate free-text field. These helpers keep both round-trips
// lossless — most importantly, an "Other" entry must always serialize LAST, because
// parseWithOther treats everything after "Other:" as the free-text value.

export const OTHER = 'Other';

export type ParseResult = {
  values: string[];
  other?: string;
};

/** Parse a stored comma-joined value back into selected options + the free-text "Other" value. */
export const parseWithOther = (rawValue: string | undefined, validOptions: string[] | undefined): ParseResult => {
  const result: ParseResult = { values: [], other: undefined };

  if (!rawValue) return result;

  const [generalPart, otherPart] = rawValue.split(`${OTHER}:`, 2);

  result.values = generalPart
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => validOptions?.includes(item));

  if (otherPart !== undefined) {
    const trimmedOther = otherPart.trim();
    if (trimmedOther) result.other = trimmedOther;
    result.values.push(OTHER);
  }

  return result;
};

/** Serialize selected options + free-text "Other" value into a comma-joined string for storage. */
export const combineMultipleValuesForSave = (
  values: string[] | undefined,
  otherValue: string | undefined
): string | undefined => {
  if (!values?.length && !otherValue) return undefined;

  const hasOther = values?.includes(OTHER);
  const hasOtherDetail = Boolean(otherValue?.trim());

  // "Other: <text>" must come last: parseWithOther treats everything after "Other:" as free text.
  const result = (values ?? []).filter((value) => value !== OTHER);

  // consolidate other and other detail
  if (hasOther && hasOtherDetail) {
    result.push(`${OTHER}: ${otherValue?.trim()}`);
  }

  // we do not want to lose Other if no detail is provided
  // still want to move other to the end of the values
  if (hasOther && !hasOtherDetail) {
    result.push(OTHER);
  }

  return result.join(', ');
};

/** Split a multi-select state value into quick-pick storage: real options only + free-text "Other". */
export const splitOtherForQuickPick = (
  values: string[] | undefined,
  otherText: string | undefined
): { values: string[] | undefined; other: string | undefined } => {
  const otherDetailsProvided = Boolean(otherText?.trim());
  const valuesToReturn = otherDetailsProvided ? values?.filter((value) => value !== OTHER) : values;

  return { values: valuesToReturn, other: values?.includes(OTHER) ? otherText?.trim() : undefined };
};

/** Rebuild a multi-select state array from quick-pick storage, re-adding the "Other" chip. */
export const mergeOtherFromQuickPick = (
  values: (string | undefined)[] | undefined,
  otherText: string | undefined
): string[] => {
  const realOptions = (values?.filter((value) => value && value !== OTHER) as string[]) ?? [];
  return otherText ? [...realOptions, OTHER] : realOptions;
};

/** Single-select: map a stored raw value to the dropdown value ("Other" when not a predefined option). */
export const getPredefinedValueOrOther = (
  value: string | undefined,
  predefinedValues: string[] | undefined
): string | undefined => {
  if (value != null && predefinedValues?.includes(value)) {
    return value;
  }
  return value != null ? OTHER : undefined;
};

/** Single-select: map a stored raw value to the free-text "Other" value (when not predefined). */
export const getPredefinedValueIfOther = (
  value: string | undefined,
  predefinedValues: string[] | undefined
): string | undefined => {
  if (value != null && !predefinedValues?.includes(value)) {
    return value;
  }
  return undefined;
};
