import z from 'zod';
import { LabType } from './labs.types';

export const ExternalLabListItemSchema = z.object({
  display: z.string(),
  itemCode: z.string(),
  labGuid: z.string(),
});

export const InHouseLabListItemSchema = z.object({
  display: z.string(),
  adUrl: z.string(),
});

export enum LabSetStatus {
  active = 'Active',
  inactive = 'Inactive',
}

export const BaseLabSetSchema = z.object({
  listId: z.string(),
  listName: z.string(),
  listStatus: z.nativeEnum(LabSetStatus),
});

export const ExternalLabSetSchema = BaseLabSetSchema.extend({
  listType: z.literal(LabType.external),
  labs: z.array(ExternalLabListItemSchema),
});

export const InHouseLabSetSchema = BaseLabSetSchema.extend({
  listType: z.literal(LabType.inHouse),
  labs: z.array(InHouseLabListItemSchema),
});

export const LabSetSchema = z.discriminatedUnion('listType', [ExternalLabSetSchema, InHouseLabSetSchema]);

// for creating a lab set, no id yet
const ExternalLabSetNoIdSchema = ExternalLabSetSchema.omit({
  listId: true,
});
const InHouseLabSetNoIdSchema = InHouseLabSetSchema.omit({
  listId: true,
});
export const LabSetNoIdSchema = z.discriminatedUnion('listType', [ExternalLabSetNoIdSchema, InHouseLabSetNoIdSchema]);

// for the admin lab set form
export const AdminLabSetFormInputSchema = z
  .object({
    listId: z.string().optional(),

    listName: z.string().trim().min(1, 'Set name is required'),

    listStatus: z.nativeEnum(LabSetStatus),

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

// LAB SET DTO types
export type ExternalLabSetDTO = z.infer<typeof ExternalLabSetSchema>;
export type InHouseLabSetDTO = z.infer<typeof InHouseLabSetSchema>;
export type LabSetDTO = z.infer<typeof LabSetSchema>;
export type LabSetNoIdDTO = z.infer<typeof LabSetNoIdSchema>;

export type AdminLabSetFormInput = z.infer<typeof AdminLabSetFormInputSchema>;
