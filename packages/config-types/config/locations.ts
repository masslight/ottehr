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

export const SupportDisplaySchema = z.object({
  phoneLabel: z.string().min(1).optional(),
  hours: z.array(z.string().min(1)),
});

export type SupportDisplay = z.infer<typeof SupportDisplaySchema>;

/**
 * LocationConfig - Configuration for clinic locations
 * Defines in-person and telemed locations, support phone numbers, and schedule groups
 */
export const LocationConfigSchema = z.object({
  inPersonLocations: z.array(LocationItemSchema),
  telemedLocations: z.array(LocationItemSchema),
  supportPhoneNumber: z.string().optional(),
  locationSupportPhoneNumberMap: z.record(z.string().min(1), z.string().min(1)).optional(),
  supportScheduleGroups: z.array(SupportScheduleGroupSchema).optional(),
  supportDisplay: SupportDisplaySchema.optional(),
});

export type LocationConfig = z.infer<typeof LocationConfigSchema>;
