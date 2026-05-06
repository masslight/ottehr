import { DocumentReference } from 'fhir/r4b';
import { z } from 'zod';

export enum LabelType {
  label = 'label',
  xmlLabel = 'xml-label',
}

// this is a general type not specific to labs
export interface LabelPdf {
  type: 'label';
  documentReference: DocumentReference;
  presignedURL: string;
}

export interface LabelXml extends Omit<LabelPdf, 'type'> {
  type: 'xml-label';
}

// ---------- enums (schema + inferred type, together) ----------
//  exported for reuse for dropdown options, etc.)
export const LabelOrientationSchema = z.enum(['landscape', 'portrait']);
export type LabelOrientation = z.infer<typeof LabelOrientationSchema>;

export const SupportedPrinterManufacturerSchema = z.enum(['DYMO']);
export type SupportedPrinterManufacturer = z.infer<typeof SupportedPrinterManufacturerSchema>;

export const SupportedDymoLabelTypeSchema = z.enum(['30334']);

export const PrintModeSchema = z.enum(['manual', 'integrated']);
export type PrintMode = z.infer<typeof PrintModeSchema>;

// ---------- per-manufacturer metadata for the form ----------
// should add new manufacturers and specific label orientation defaults here
export type LabelTypeMetadata = { defaultOrientation: LabelOrientation };

export const MANUFACTURER_TO_LABEL_MAPPING = {
  DYMO: {
    labelTypeSchema: SupportedDymoLabelTypeSchema,
    labelTypes: {
      '30334': { defaultOrientation: 'portrait' },
    },
  },
  // future: Brother: { labelTypeSchema: ..., labelTypes: { ... } },
} as const satisfies Record<
  SupportedPrinterManufacturer,
  {
    labelTypeSchema: z.ZodEnum<[string, ...string[]]>;
    labelTypes: Record<string, LabelTypeMetadata>;
  }
>;

// ---------- printer + label discriminated union ----------
const PrinterAndLabelConfigSchema = z.discriminatedUnion('printerManufacturer', [
  z.object({
    printerManufacturer: z.literal('DYMO'),
    labelType: SupportedDymoLabelTypeSchema,
    orientation: LabelOrientationSchema,
  }),
  // future: z.object({ printerManufacturer: z.literal('Brother'), ... }),
]);

// ---------- top-level config ----------
export const PrintingConfigSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('manual') }),
  z.object({
    mode: z.literal('integrated'),
    openPdfOnPrint: z.boolean(),
    printerAndLabelConfig: PrinterAndLabelConfigSchema,
  }),
]);
export type PrintingConfig = z.infer<typeof PrintingConfigSchema>;

export interface GetPrintingConfigInput {
  deviceId?: string;
}

export interface GetPrintingConfigOutput {
  deviceId?: string;
  config: PrintingConfig;
}

export interface AdminUpdatePrintingConfigInput {
  deviceId?: string; // will be defined unless it is the very first update
  config: PrintingConfig;
}
