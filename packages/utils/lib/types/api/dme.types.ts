import { z } from 'zod';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from '../../fhir/systemUrls';
import { isValidUUID } from '../../validation/helper';
import { CPTCodeDTO } from './chart-data/chart-data.types';

export const DME_MENU_ITEM_TAG_SYSTEM = ottehrCodeSystemUrl('dme-menu-item');
export const DME_MENU_ITEM_TAG_CODE = 'dme-menu-item';
export const DME_ORDER_TAG_SYSTEM = ottehrCodeSystemUrl('dme-order');
export const DME_ORDER_TAG_CODE = 'dme-order';
export const DME_ITEM_CODE_SYSTEM = ottehrCodeSystemUrl('dme-item');
export const DME_ORDER_PARAMETER_SYSTEM = ottehrCodeSystemUrl('dme-order-parameter');
export const DME_FULFILLMENT_EXTENSION_URL = ottehrExtensionUrl('dme-fulfillment');
export const DME_BILLING_CODE_EXTENSION_URL = ottehrExtensionUrl('dme-billing-code');
export const DME_DISPENSED_EXTENSION_URL = ottehrExtensionUrl('dme-dispensed');
export const DME_THIRD_PARTY_CONTAINED_ID = 'dme-third-party';
export const DME_THIRD_PARTY_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('dme-third-party');

export const DME_TASK = {
  category: 'dme',
  system: ottehrCodeSystemUrl('dme-task'),
  code: {
    dispense: 'dispense-dme',
  },
  input: {
    patientName: 'patient-name',
    appointmentId: 'appointment-id',
    itemName: 'item-name',
    orderDate: 'order-date',
    providerName: 'provider-name',
  },
} as const;

export const DME_LATERALITY_OPTIONS = ['LT', 'RT', 'BI', 'NA'] as const;
export type DmeLaterality = (typeof DME_LATERALITY_OPTIONS)[number];
export const DME_LATERALITY_LABELS: Record<DmeLaterality, string> = {
  LT: 'LT (Left)',
  RT: 'RT (Right)',
  BI: 'BI (Bilateral)',
  NA: 'N/A',
};

export const DME_MODIFIER_OPTIONS = ['NU', 'RR', 'UE'] as const;
export type DmeModifier = (typeof DME_MODIFIER_OPTIONS)[number];
export const DME_MODIFIER_LABELS: Record<DmeModifier, string> = {
  NU: 'NU (New Purchase)',
  RR: 'RR (Rental)',
  UE: 'UE (Used Equipment)',
};

export const DME_DURATION_UNITS = ['days', 'weeks'] as const;
export type DmeDurationUnit = (typeof DME_DURATION_UNITS)[number];

export type DmeFulfillment = 'in-house' | 'external';

export enum DmeOrderStatus {
  pending = 'pending',
  dispensed = 'dispensed',
  ordered = 'ordered',
}

export const DME_ORDER_STATUS_LABELS: Record<DmeOrderStatus, string> = {
  [DmeOrderStatus.pending]: 'Pending',
  [DmeOrderStatus.dispensed]: 'Dispensed',
  [DmeOrderStatus.ordered]: 'Print only',
};

const uuid = (field: string): z.ZodEffects<z.ZodString> =>
  z.string({ required_error: `${field} is required` }).refine((v) => isValidUUID(v), `${field} must be a uuid`);

const MAX_NAME_LENGTH = 200;
const MAX_ADDRESS_LENGTH = 500;
const MAX_INSTRUCTIONS_LENGTH = 2000;
const MAX_DISPLAY_LENGTH = 1000;
const MAX_CODES = 50;
const MAX_QUANTITY = 999;
const MAX_DURATION = 999;

const text = (max: number): z.ZodString => z.string().trim().max(max);

const BillingCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5}$/, 'Expected a 5-character CPT/HCPCS code'),
  display: text(MAX_DISPLAY_LENGTH),
});

const DiagnosisCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]\d[A-Z0-9](\.?[A-Z0-9]{1,4})?$/, 'Expected an ICD-10 code'),
  display: text(MAX_DISPLAY_LENGTH),
});

const phone = text(30).regex(/^[\d\s()+.-]*$/, 'Expected a phone number');

// ---- DME menu (admin catalog) ----

export interface DmeMenuItem {
  id: string;
  name: string;
  hcpcsCodes: CPTCodeDTO[];
}

export const GetDmeMenuItemsInputSchema = z.object({});

export const DmeMenuItemInputSchema = z.object({
  name: text(MAX_NAME_LENGTH).min(1, 'name is required'),
  hcpcsCodes: z.array(BillingCodeSchema).max(MAX_CODES).default([]),
});
export type DmeMenuItemInput = z.input<typeof DmeMenuItemInputSchema>;

export const UpdateDmeMenuItemInputSchema = DmeMenuItemInputSchema.extend({ menuItemId: uuid('menuItemId') });
export type UpdateDmeMenuItemInput = z.input<typeof UpdateDmeMenuItemInputSchema>;

export const DeleteDmeMenuItemInputSchema = z.object({ menuItemId: uuid('menuItemId') });
export type DeleteDmeMenuItemInput = z.infer<typeof DeleteDmeMenuItemInputSchema>;

export interface GetDmeMenuItemsResponse {
  items: DmeMenuItem[];
}

export interface SaveDmeMenuItemResponse {
  item: DmeMenuItem;
}

// ---- DME orders ----

export const DmeThirdPartySchema = z.object({
  name: text(MAX_NAME_LENGTH).optional(),
  address: text(MAX_ADDRESS_LENGTH).optional(),
  phone: phone.optional(),
  fax: phone.optional(),
});
export type DmeThirdParty = z.infer<typeof DmeThirdPartySchema>;

export const DmeOrderFieldsSchema = z.object({
  /** set when the item was picked from the DME menu; omitted for a free-text "Other" item */
  menuItemId: z
    .string()
    .regex(/^[A-Za-z0-9\-.]{1,64}$/, 'menuItemId must be a FHIR resource id')
    .optional(),
  itemName: text(MAX_NAME_LENGTH).min(1, 'DME item is required'),
  diagnoses: z.array(DiagnosisCodeSchema).max(MAX_CODES).default([]),
  quantity: z
    .number()
    .int('Quantity dispensed must be a whole number')
    .positive('Quantity dispensed must be a positive number')
    .max(MAX_QUANTITY, `Quantity dispensed must be at most ${MAX_QUANTITY}`),
  billingCodes: z.array(BillingCodeSchema).max(MAX_CODES).default([]),
  laterality: z.enum(DME_LATERALITY_OPTIONS).optional(),
  modifier: z.enum(DME_MODIFIER_OPTIONS).optional(),
  duration: z
    .object({
      value: z
        .number()
        .positive('Duration must be a positive number')
        .max(MAX_DURATION, `Duration must be at most ${MAX_DURATION}`),
      unit: z.enum(DME_DURATION_UNITS),
    })
    .optional(),
  orderedByPractitionerId: uuid('orderedByPractitionerId'),
  instructions: text(MAX_INSTRUCTIONS_LENGTH).optional(),
  external: z.boolean().default(false),
  thirdParty: DmeThirdPartySchema.optional(),
});
export type DmeOrderFields = z.input<typeof DmeOrderFieldsSchema>;
export type ParsedDmeOrderFields = z.output<typeof DmeOrderFieldsSchema>;

export const CreateDmeOrderInputSchema = DmeOrderFieldsSchema.extend({ encounterId: uuid('encounterId') });
export type CreateDmeOrderInput = z.input<typeof CreateDmeOrderInputSchema>;

export interface CreateDmeOrderResponse {
  deviceRequestId: string;
  /** billing codes written to the encounter (in-house orders only) */
  cptCodesSaved: CPTCodeDTO[];
}

export const GetDmeOrdersInputSchema = z
  .object({
    encounterId: uuid('encounterId').optional(),
    deviceRequestId: uuid('deviceRequestId').optional(),
  })
  .refine((v) => !!v.encounterId !== !!v.deviceRequestId, 'Exactly one of encounterId, deviceRequestId is required');
export type GetDmeOrdersInput = z.infer<typeof GetDmeOrdersInputSchema>;

export const UpdateDmeOrderInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update'), deviceRequestId: uuid('deviceRequestId'), fields: DmeOrderFieldsSchema }),
  z.object({ action: z.literal('dispense'), deviceRequestId: uuid('deviceRequestId') }),
  z.object({ action: z.literal('delete'), deviceRequestId: uuid('deviceRequestId') }),
]);
export type UpdateDmeOrderInput = z.input<typeof UpdateDmeOrderInputSchema>;

export interface UpdateDmeOrderResponse {
  /** the encounter's billing codes after the change, so the chart can refresh its CPT list */
  cptCodes: CPTCodeDTO[];
}

export const GetDmeOrderPdfInputSchema = z.object({ deviceRequestId: uuid('deviceRequestId') });
export type GetDmeOrderPdfInput = z.infer<typeof GetDmeOrderPdfInputSchema>;

export interface GetDmeOrderPdfResponse {
  presignedURL: string;
}

export interface DmeOrderDTO {
  id: string;
  encounterId: string;
  menuItemId?: string;
  itemName: string;
  diagnoses: { code: string; display: string }[];
  quantity: number;
  billingCodes: CPTCodeDTO[];
  laterality?: DmeLaterality;
  modifier?: DmeModifier;
  duration?: { value: number; unit: DmeDurationUnit };
  instructions?: string;
  external: boolean;
  thirdParty?: DmeThirdParty;
  status: DmeOrderStatus;
  orderedBy: { practitionerId: string; name: string };
  orderedAt: string;
  dispensed?: { practitionerId?: string; name?: string; at: string };
}

export interface GetDmeOrdersResponse {
  orders: DmeOrderDTO[];
}

export const formatDmeBillingCode = (code: { code: string; display?: string }): string =>
  code.display ? `${code.code} - ${code.display}` : code.code;

export const formatDmeDuration = (duration: DmeOrderDTO['duration']): string | undefined =>
  duration ? `${duration.value} ${duration.value === 1 ? duration.unit.replace(/s$/, '') : duration.unit}` : undefined;
