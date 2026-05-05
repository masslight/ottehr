import { LabelTypeMetadata, MANUFACTURER_TO_LABEL_MAPPING, SupportedPrinterManufacturer } from '../types';

export function getLabelTypeMetadata(
  manufacturer: SupportedPrinterManufacturer | undefined,
  labelType: string | undefined
): LabelTypeMetadata | undefined {
  if (!manufacturer || !labelType) return undefined;
  const labelTypes = MANUFACTURER_TO_LABEL_MAPPING[manufacturer].labelTypes as Record<string, LabelTypeMetadata>;
  return labelTypes[labelType];
}

export const PRINTING_CONFIG_DEVICE_TAG = {
  system: 'printing-device',
  code: 'printing-config',
};

export const PRINTING_DEVICE_PROPERTIES_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/print-config-properties';

export type PrintingProperty = 'printing-mode' | 'label-type' | 'label-orientation';
export const PRINTING_DEVICE_PROPERTIES_VALUE_SYSTEM_MAP: Record<PrintingProperty, string> = {
  'printing-mode': 'https://fhir.ottehr.com/CodeSystem/printing-mode',
  'label-type': 'https://fhir.ottehr.com/CodeSystem/label-type',
  'label-orientation': 'https://fhir.ottehr.com/CodeSystem/label-orientation',
};

export const PRINTIN_CONFIG_SHOULD_OPEN_ON_PRINT_EXT_SYSTEM = 'https://fhir.ottehr.com/Extension/open-pdf-on-print';
