import { z } from 'zod';

export const GetPatientAndResponsiblePartyInfoEndpointOutputSchema = z.object({
  patient: z.object({
    fullName: z.string(),
    dob: z.string(),
    gender: z.string(),
    phoneNumber: z.string(),
  }),
  responsibleParty: z.object({
    fullName: z.string(), // todo, check different variants of responsible party, self, spose ...
    phoneNumber: z.string(), // todo and what data and where will be stored
    email: z.string().optional(),
  }),
});

export type GetPatientAndResponsiblePartyInfoEndpointOutput = z.infer<
  typeof GetPatientAndResponsiblePartyInfoEndpointOutputSchema
>;
