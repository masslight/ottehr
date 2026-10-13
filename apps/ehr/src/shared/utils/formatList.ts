export const formatList = (values: readonly string[], conjunction: 'and' | '&' = 'and'): string =>
  values.length <= 1
    ? values[0] ?? ''
    : `${values.slice(0, -1).join(', ')} ${conjunction} ${values[values.length - 1]}`;
