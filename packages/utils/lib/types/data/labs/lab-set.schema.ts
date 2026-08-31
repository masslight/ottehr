import z from 'zod';
import { LabType } from './labs.types';

const nonEmptyString = (message?: string): z.ZodString => z.string().trim().nonempty(message);

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
  listName: nonEmptyString('Lab set name is required'),
  listStatus: z.nativeEnum(LabSetStatus),
});

export const ExternalLabSetSchema = BaseLabSetSchema.extend({
  listType: z.literal(LabType.external),
  labs: z.array(ExternalLabListItemSchema).min(1, { message: 'Please select at least one lab' }),
});

export const InHouseLabSetSchema = BaseLabSetSchema.extend({
  listType: z.literal(LabType.inHouse),
  labs: z.array(InHouseLabListItemSchema).min(1, { message: 'Please select at least one lab' }),
});

export const LabSetDTOSchema = z.discriminatedUnion('listType', [ExternalLabSetSchema, InHouseLabSetSchema], {
  errorMap: (issue, ctx) => {
    // this schema is used to validate RHF when creating a lab set in the admin portal
    // when the form first loads, no list type is selected, if the user clicks submit on the empty form a invalid_union_discriminator error is thrown
    // this allows the front end to get a human readable error instead
    if (issue.code === 'invalid_union_discriminator') {
      return { message: `Lab type is required` };
    }
    return { message: ctx.defaultError };
  },
});

// LAB SET DTO types
export type ExternalLabSetDTO = z.infer<typeof ExternalLabSetSchema>;
export type InHouseLabSetDTO = z.infer<typeof InHouseLabSetSchema>;
export type LabSetDTO = z.infer<typeof LabSetDTOSchema>;
