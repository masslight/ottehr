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
export const SupportScheduleGroupSchema = z
  .object({
    locations: z.array(z.string().min(1)),
    hours: z.string().min(1).optional(),
    hoursLines: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((group) => Boolean(group.hours) !== Boolean(group.hoursLines?.length), {
    message: 'Each support schedule group must define exactly one of hours or hoursLines.',
  });

export type SupportScheduleGroup = z.infer<typeof SupportScheduleGroupSchema>;

const SupportDialogSupportPhoneRowSchema = z.object({
  type: z.literal('supportPhone'),
  label: z.string().min(1).optional(),
  suffixText: z.string().min(1).optional(),
});

const SupportDialogLocationPhoneRowSchema = z.object({
  type: z.literal('locationPhone'),
  location: z.string().min(1),
  suffixText: z.string().min(1).optional(),
});

const SupportDialogScheduleGroupHoursRowSchema = z.object({
  type: z.literal('scheduleGroupHours'),
  groupIndex: z.number().int().nonnegative(),
});

const SupportDialogLocationPhonesForGroupRowSchema = z.object({
  type: z.literal('locationPhonesForGroup'),
  groupIndex: z.number().int().nonnegative(),
});

export const SupportDialogRowSchema = z.discriminatedUnion('type', [
  SupportDialogSupportPhoneRowSchema,
  SupportDialogLocationPhoneRowSchema,
  SupportDialogScheduleGroupHoursRowSchema,
  SupportDialogLocationPhonesForGroupRowSchema,
]);

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

/**
 * LocationConfig - Configuration for clinic locations
 * Defines in-person and telemed locations, support phone numbers, schedule groups,
 * and support dialog presentation settings.
 */
export const LocationConfigSchema = z.object({
  inPersonLocations: z.array(LocationItemSchema),
  telemedLocations: z.array(LocationItemSchema),
  supportPhoneNumber: z.string().optional(),
  locationSupportPhoneNumberMap: z.record(z.string().min(1), z.string().min(1)).optional(),
  supportScheduleGroups: z.array(SupportScheduleGroupSchema).optional(),
  supportDialog: SupportDialogSchema.optional(),
});

export type LocationConfig = z.infer<typeof LocationConfigSchema>;
