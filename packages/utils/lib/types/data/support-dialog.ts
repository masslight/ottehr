import { z } from 'zod';

export const SupportDialogBodySchema = z.object({
  bodyHtml: z.string(),
});
export type SupportDialogBody = z.infer<typeof SupportDialogBodySchema>;

export type GetSupportDialogInput = Record<string, never>;

export interface GetSupportDialogOutput {
  bodyHtml: string;
}

export interface AdminUpdateSupportDialogInput {
  bodyHtml: string;
}

export interface LocationSupportPhoneEntry {
  locationId: string;
  locationName: string;
  phoneNumber: string;
}

export interface GetLocationSupportPhonesOutput {
  defaultSupportPhoneNumber?: string;
  locations: LocationSupportPhoneEntry[];
}

export interface LocationSupportPhoneUpdate {
  locationId: string;
  phoneNumber: string;
}

export interface AdminUpdateLocationSupportPhonesInput {
  updates: LocationSupportPhoneUpdate[];
}
