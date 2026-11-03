import z from 'zod';

export const sendPatientFormInputSchema = z.object({
  appointmentId: z.string().uuid(),
  questionnaireId: z.string().uuid(),
  /** False creates (or reuses) the visit's response without texting the patient, for staff to fill out. */
  notifyPatient: z.boolean().optional(),
  /** The encounter the user is looking at (a follow-up note has its own); the visit's main encounter when omitted. */
  encounterId: z.string().uuid().optional(),
});

export type SendPatientFormInput = z.infer<typeof sendPatientFormInputSchema>;

export const SendPatientFormOutputSchema = z.object({
  questionnaireResponseId: z.string().uuid(),
});

export type SendPatientFormOutput = z.infer<typeof SendPatientFormOutputSchema>;
