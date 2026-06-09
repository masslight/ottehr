import { z } from 'zod';
import { isPhoneNumberValid } from '../../helpers/helpers';

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

export const LocationSupportPhoneUpdateSchema = z.object({
  locationId: z.string().min(1),
  phoneNumber: z
    .string()
    .refine((v) => v.trim() === '' || isPhoneNumberValid(v.trim()), { message: 'Invalid phone number format' }),
});
export type LocationSupportPhoneUpdate = z.infer<typeof LocationSupportPhoneUpdateSchema>;

export const AdminUpdateLocationSupportPhonesInputSchema = z.object({
  updates: z.array(LocationSupportPhoneUpdateSchema).min(1),
});
export type AdminUpdateLocationSupportPhonesInput = z.infer<typeof AdminUpdateLocationSupportPhonesInputSchema>;
