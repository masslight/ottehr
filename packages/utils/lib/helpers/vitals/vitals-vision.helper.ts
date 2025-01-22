import { VitalsVisionOption } from '../../types';

export enum VitalVisionUnit {
  Unit_220 = 220,
  Unit_210 = 210,
  Unit_215 = 215,
  Unit_230 = 230,
  Unit_2100 = 2100,
  Unit_2200 = 2200,
}

export enum VitalVisionExtraOption {
  ChildTooYoung = 'child_too_young',
  WithGlasses = 'with_glasses',
  WithoutGlasses = 'without_glasses',
}

export const parseVisionValue = (eyeVisionValue?: number): VitalVisionUnit | undefined => {
  if (!eyeVisionValue) return;
  return (Object.values(VitalVisionUnit) as number[]).includes(eyeVisionValue)
    ? (eyeVisionValue as VitalVisionUnit)
    : undefined;
};

export const getVisionExtraOptionsFormattedString = (options?: VitalVisionExtraOption[]): string | undefined => {
  if (!options) return;
  if (options.length === 0) return;
  return options
    .map((option) => {
      switch (option) {
        case VitalVisionExtraOption.ChildTooYoung:
          return 'Child too young';
        case VitalVisionExtraOption.WithGlasses:
          return 'With glasses';
        case VitalVisionExtraOption.WithoutGlasses:
          return 'Without glasses';
        default:
          return undefined;
      }
    })
    .filter((optionText) => !!optionText)
    .reduce((resStr, optionStr) => `${resStr} ${optionStr};`, '')
    .slice(0, -1);
};

export const parseVisionExtraOptions = (extraOptions?: VitalsVisionOption[]): VitalVisionExtraOption[] | undefined => {
  if (!extraOptions) return;
  if (extraOptions.length === 0) return;

  return extraOptions
    .map((option) => {
      switch (option) {
        case 'child_too_young':
          return VitalVisionExtraOption.ChildTooYoung;
        case 'with_glasses':
          return VitalVisionExtraOption.WithGlasses;
        case 'without_glasses':
          return VitalVisionExtraOption.WithoutGlasses;
        default:
          return undefined;
      }
    })
    .filter((parsedOption) => !!parsedOption)
    .map((option) => option as VitalVisionExtraOption);
};
