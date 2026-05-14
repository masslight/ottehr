import { DocumentReference } from 'fhir/r4b';
import { z } from 'zod';

// this is a general type not specific to labs
export interface LabelPdf {
  type: 'label';
  documentReference: DocumentReference;
  presignedURL: string;
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
export const LabelPrintingConfigSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('manual') }),
  z.object({
    mode: z.literal('integrated'),
    openPdfOnPrint: z.boolean(),
    printerAndLabelConfig: PrinterAndLabelConfigSchema,
  }),
]);
export type LabelPrintingConfig = z.infer<typeof LabelPrintingConfigSchema>;

export interface GetLabelPrintingConfigInput {
  deviceId?: string;
}

export interface GetLabelPrintingConfigOutput {
  deviceId?: string;
  config: LabelPrintingConfig;
}

export interface AdminUpdatePrintingConfigInput {
  deviceId?: string; // will be defined unless it is the very first update
  config: LabelPrintingConfig;
}

// --------- on demand label xml types --------
export const OnDemandVisitLabelXmlRequestSchema = z.object({
  type: z.literal('visit'),
  encounterId: z.string(),
  // future todo: include deviceId or locationId to find printing configs specific to a location
});
export type OnDemandVisitLabelXmlRequestInput = z.infer<typeof OnDemandVisitLabelXmlRequestSchema>;

export const OnDemandExternalLabLabelXmlRequestSchema = z.object({
  type: z.literal('external-lab'),
  serviceRequestId: z.string(),
  userTimezone: z.string(),
  // future todo: include deviceId or locationId to find printing configs specific to a location
});
export type OnDemandExternalLabLabelXmlRequestInput = z.infer<typeof OnDemandExternalLabLabelXmlRequestSchema>;

export const OnDemandLabelXmlRequestSchema = z.discriminatedUnion('type', [
  OnDemandVisitLabelXmlRequestSchema,
  OnDemandExternalLabLabelXmlRequestSchema,
]);
export type OnDemandLabelXmlRequestInput = z.infer<typeof OnDemandLabelXmlRequestSchema>;
export type OnDemandLabelXmlRequestOutput = {
  printingConfig: LabelPrintingConfig;
  labelXmlString: string;
};
