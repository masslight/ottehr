import { LabelTypeMetadata, MANUFACTURER_TO_LABEL_MAPPING, SupportedPrinterManufacturer } from '../types';

export function getLabelTypeMetadata(
  manufacturer: SupportedPrinterManufacturer | undefined,
  labelType: string | undefined
): LabelTypeMetadata | undefined {
  if (!manufacturer || !labelType) return undefined;
  const labelTypes = MANUFACTURER_TO_LABEL_MAPPING[manufacturer].labelTypes as Record<string, LabelTypeMetadata>;
  return labelTypes[labelType];
}
