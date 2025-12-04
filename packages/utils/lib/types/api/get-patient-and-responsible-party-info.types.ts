import { z } from 'zod';

export const GetPatientAndResponsiblePartyInfoEndpointInputSchema = z.object({
  patientId: z.string().uuid(),
});

export type GetPatientAndResponsiblePartyInfoEndpointInput = z.infer<
  typeof GetPatientAndResponsiblePartyInfoEndpointInputSchema
>;

export const GetPatientAndResponsiblePartyInfoEndpointOutputSchema = z.object({
  patient: z.object({
    fullName: z.string(),
    dob: z.string(),
    gender: z.string(),
    phoneNumber: z.string(),
  }),
  responsibleParty: z.object({
    fullName: z.string(), // todo, check different variants of responsible party, self, spose ...
    phoneNumber: z.string().optional(), // todo and what data and where will be stored
    email: z.string(),
  }),
});

export type GetPatientAndResponsiblePartyInfoEndpointOutput = z.infer<
  typeof GetPatientAndResponsiblePartyInfoEndpointOutputSchema
>;
