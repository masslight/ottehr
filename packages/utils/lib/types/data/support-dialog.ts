import { z } from 'zod';

export type GetSupportDialogInput = Record<string, never>;

export interface GetSupportDialogOutput {
  bodyHtml: string;
}

export const AdminUpdateSupportDialogInputSchema = z.object({
  bodyHtml: z.string(),
});
export type AdminUpdateSupportDialogInput = z.infer<typeof AdminUpdateSupportDialogInputSchema>;

export interface LocationSupportPhoneEntry {
  locationId: string;
  locationName: string;
  phoneNumber: string;
}

export interface GetLocationSupportPhonesOutput {
  locations: LocationSupportPhoneEntry[];
}
