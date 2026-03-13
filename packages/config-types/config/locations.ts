import z from 'zod';

/**
 * LocationItem - A single location entry
 */
export const LocationItemSchema = z.object({
  name: z.string().min(1, { message: 'Location name cannot be empty' }),
});

export type LocationItem = z.infer<typeof LocationItemSchema>;

/**
 * SupportScheduleGroup - Hours and locations for support scheduling
 */
export const SupportScheduleGroupSchema = z.object({
  hours: z.string().min(1),
  locations: z.array(z.string().min(1)),
});

export type SupportScheduleGroup = z.infer<typeof SupportScheduleGroupSchema>;

export const SupportDialogRowSchema = z.object({
  label: z.string().min(1).optional(),
  value: z.string().min(1),
  emphasized: z.boolean().optional(),
});

export type SupportDialogRow = z.infer<typeof SupportDialogRowSchema>;

export const SupportDialogSectionSchema = z.object({
  rows: z.array(SupportDialogRowSchema).min(1),
});

export type SupportDialogSection = z.infer<typeof SupportDialogSectionSchema>;

export const SupportDialogSchema = z.object({
  title: z.string().min(1).optional(),
  sections: z.array(SupportDialogSectionSchema).min(1),
  emergencyNotice: z.string().min(1).optional(),
});

export type SupportDialog = z.infer<typeof SupportDialogSchema>;

// Legacy single-contact dialog format retained for backward compatibility.
export const SupportDisplaySchema = z.object({
  phoneLabel: z.string().min(1).optional(),
  hours: z.array(z.string().min(1)),
});

export type SupportDisplay = z.infer<typeof SupportDisplaySchema>;

/**
 * LocationConfig - Configuration for clinic locations
 * Defines in-person and telemed locations, support phone numbers, and support dialog settings
 */
export const LocationConfigSchema = z.object({
  inPersonLocations: z.array(LocationItemSchema),
  telemedLocations: z.array(LocationItemSchema),
  supportPhoneNumber: z.string().optional(),
  locationSupportPhoneNumberMap: z.record(z.string().min(1), z.string().min(1)).optional(),
  supportScheduleGroups: z.array(SupportScheduleGroupSchema).optional(),
  // Canonical support dialog configuration. Legacy display/group fields are still supported.
  supportDialog: SupportDialogSchema.optional(),
  supportDisplay: SupportDisplaySchema.optional(),
});

export type LocationConfig = z.infer<typeof LocationConfigSchema>;
