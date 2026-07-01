import { VitalsDotVisionScreening, VitalsVisionOption } from '../../types';

export const DOT_VISION_SCREENING_LABELS = {
  horizontalFieldLeft: 'Horizontal Field of Vision – Left',
  horizontalFieldRight: 'Horizontal Field of Vision – Right',
  canRecognizeColors: 'Applicant can recognize red, green, and amber colors',
  monocularVision: 'Monocular vision',
  referredToSpecialist: 'Referred to ophthalmologist or optometrist?',
  receivedDocumentation: 'Received documentation from ophthalmologist or optometrist?',
} as const;

const yesNo = (value: boolean): string => (value ? 'Yes' : 'No');

/**
 * Formats DOT (MCSA-5875) vision screening data into display lines mirroring the form layout:
 * horizontal field of vision per eye (with "degrees" units), then the four Yes/No qualifiers.
 */
export const getDotVisionScreeningLines = (dot?: VitalsDotVisionScreening): string[] => {
  if (!dot) return [];
  const lines: string[] = [];
  if (dot.horizontalFieldLeftDegrees != null) {
    lines.push(`${DOT_VISION_SCREENING_LABELS.horizontalFieldLeft}: ${dot.horizontalFieldLeftDegrees} degrees`);
  }
  if (dot.horizontalFieldRightDegrees != null) {
    lines.push(`${DOT_VISION_SCREENING_LABELS.horizontalFieldRight}: ${dot.horizontalFieldRightDegrees} degrees`);
  }
  if (dot.canRecognizeColors != null) {
    lines.push(`${DOT_VISION_SCREENING_LABELS.canRecognizeColors}: ${yesNo(dot.canRecognizeColors)}`);
  }
  if (dot.hasMonocularVision != null) {
    lines.push(`${DOT_VISION_SCREENING_LABELS.monocularVision}: ${yesNo(dot.hasMonocularVision)}`);
  }
  if (dot.referredToSpecialist != null) {
    lines.push(`${DOT_VISION_SCREENING_LABELS.referredToSpecialist}: ${yesNo(dot.referredToSpecialist)}`);
  }
  if (dot.receivedDocumentation != null) {
    lines.push(`${DOT_VISION_SCREENING_LABELS.receivedDocumentation}: ${yesNo(dot.receivedDocumentation)}`);
  }
  return lines;
};

export const isDotVisionScreeningEntry = (dot?: VitalsDotVisionScreening): boolean =>
  getDotVisionScreeningLines(dot).length > 0;

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
