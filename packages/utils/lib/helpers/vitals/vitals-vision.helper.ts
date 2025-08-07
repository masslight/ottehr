import { VitalsVisionOption } from '../../types';

export const getVisionExtraOptionsFormattedString = (options?: VitalsVisionOption[]): string | undefined => {
  if (!options) return;
  if (options.length === 0) return;
  return options
    .map((option) => {
      switch (option) {
        case 'child_too_young':
          return 'Child too young';
        case 'with_glasses':
          return 'With glasses';
        case 'without_glasses':
          return 'Without glasses';
        default:
          return undefined;
      }
    })
    .filter((optionText) => !!optionText)
    .reduce((resStr, optionStr) => `${resStr} ${optionStr};`, '')
    .slice(0, -1);
};
