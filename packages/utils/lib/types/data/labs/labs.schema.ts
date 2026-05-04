import z from 'zod';
import { LabType } from './labs.types';

export const ExternalLabListItemSchema = z.object({
  display: z.string(),
  itemCode: z.string(),
  labGuid: z.string(),
});

export const InHouseLabListItemSchema = z.object({
  display: z.string(),
  activityDefinitionId: z.string(),
});

export const ExternalLabSetSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  listType: z.literal(LabType.external),
  labs: z.array(ExternalLabListItemSchema),
});

export const InHouseLabSetSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  listType: z.literal(LabType.inHouse),
  labs: z.array(InHouseLabListItemSchema),
});

export const LabSetSchema = z.discriminatedUnion('listType', [ExternalLabSetSchema, InHouseLabSetSchema]);

// for creating a lab set, no id yet
const ExternalLabSetNoIdSchema = ExternalLabSetSchema.omit({
  listId: true,
});
const InHouseLabSetNoItSchema = InHouseLabSetSchema.omit({
  listId: true,
});
export const LabSetNoIsSchema = z.discriminatedUnion('listType', [ExternalLabSetNoIdSchema, InHouseLabSetNoItSchema]);

// for the admin lab set form
export const AdminLabSetSchema = z
  .object({
    listId: z.string().optional(),

    listName: z.string().trim().min(1, 'Set name is required'),

    listType: z.enum([LabType.external, LabType.inHouse], {
      errorMap: () => ({ message: 'Lab type is required' }),
    }),

    labs: z.array(z.union([InHouseLabListItemSchema, ExternalLabListItemSchema])).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.listType) return;

    if (!data.labs || data.labs.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['labs'],
        message:
          data.listType === LabType.inHouse ? 'Select at least one in-house lab' : 'Select at least one external lab',
      });
    }
  });

// ADMIN LAB SET API SCHEMAS
export const AdminGetLabSetListOutputSchema = z.object({
  labSetDTO: z.array(LabSetSchema),
});

export const AdminGetLabSetDetailInputSchema = z.object({
  labSetId: z.string(),
});

export const AdminGetLabSetDetailOutputSchema = z.object({
  labSetDTO: LabSetSchema,
});

export const AdminAddLabSetInputSchema = z.object({
  labSet: AdminLabSetSchema,
});

export const AdminAddLabSetOutputSchema = z.object({
  labSetId: z.string(),
});

// LAB SET DTO types
export type ExternalLabSetDTO = z.infer<typeof ExternalLabSetSchema>;
export type InHouseLabSetDTO = z.infer<typeof InHouseLabSetSchema>;
export type LabSetDTO = z.infer<typeof LabSetSchema>;

// ADMIN LAB SET API TYPES
export type AdminGetLabSetListOutput = z.infer<typeof AdminGetLabSetListOutputSchema>;

export type AdminGetLabSetDetailInput = z.infer<typeof AdminGetLabSetDetailInputSchema>;
export type AdminGetLabSetDetailOutput = z.infer<typeof AdminGetLabSetDetailOutputSchema>;

export type AdminAddLabSetInput = z.infer<typeof AdminAddLabSetInputSchema>;
export type AdminAddLabSetOutput = z.infer<typeof AdminAddLabSetOutputSchema>;
export type LabSetNoIdDTO = z.infer<typeof LabSetNoIsSchema>;

export type AdminLabSet = z.infer<typeof AdminLabSetSchema>;
