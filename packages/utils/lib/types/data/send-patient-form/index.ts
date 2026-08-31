import z from 'zod';

export const sendPatientFormInputSchema = z.object({
  appointmentId: z.string().uuid(),
  questionnaireId: z.string().uuid(),
});

export type SendPatientFormInput = z.infer<typeof sendPatientFormInputSchema>;

export const SendPatientFormOutputSchema = z.object({
  questionnaireResponseId: z.string().uuid(),
});

export type SendPatientFormOutput = z.infer<typeof SendPatientFormOutputSchema>;
