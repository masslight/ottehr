export const formatLabelValue = (
  value: string | undefined,
  placeholder = '',
  keepPlaceholderIfValueFulfilled = false,
  emptyValuePlaceholder = 'N/A'
): string => {
  const prefix = !value || (keepPlaceholderIfValueFulfilled && value) ? `${placeholder}: ` : '';
  return prefix + (value || emptyValuePlaceholder);
};
