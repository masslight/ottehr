import { z } from 'zod';

export interface RecentPatientsReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
  locationId?: string;
}

// The Zod schema is the single source of truth for this endpoint's response: it derives the TS
// types below and validates the zambda's output before it ships, so a mapper drift fails loud at
// the source instead of surfacing as a client-side parse error.
export const RecentPatientRecordSchema = z.object({
  patientId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phoneNumber: z.string(),
  email: z.string(),
  mostRecentVisit: z.object({
    appointmentId: z.string(),
    date: z.string(), // ISO date string
    serviceCategory: z.string(), // e.g., "General Care", "Urgent Care", etc.
    location: z.string().optional(), // Clinic / location name of the most recent visit
    attendingProvider: z.string().optional(), // Attending provider name on the most recent visit
  }),
  patientStatus: z.enum(['new', 'existing']), // New or existing patient based on visit history
  pointOfDiscovery: z.string().optional(), // "How did you hear about us?" value
});

export const RecentPatientsReportZambdaOutputSchema = z.object({
  message: z.string(),
  totalPatients: z.number(),
  patients: z.array(RecentPatientRecordSchema),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  locationId: z.string().optional(),
});

export type RecentPatientRecord = z.infer<typeof RecentPatientRecordSchema>;
export type RecentPatientsReportZambdaOutput = z.infer<typeof RecentPatientsReportZambdaOutputSchema>;
