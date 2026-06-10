import { DateTime } from 'luxon';
import { PersonSex, RequiredProps, Secrets, UpdateAppointmentRequestParams } from 'utils';
import { z } from 'zod';
import { phoneRegex, safeValidate, ZambdaInput } from '../../../shared';

const PatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  email: z.string().min(1),
  emailUser: z.enum(['Patient', 'Parent/Guardian']),
  id: z.string().optional(),
  sex: z.enum(Object.values(PersonSex) as [string, ...string[]]).optional(),
  phoneNumber: z.string().optional(),
  chosenName: z.string().optional(),
  middleName: z.string().optional(),
  newPatient: z.boolean().optional(),
  weight: z.number().optional(),
  weightLastUpdated: z.string().optional(),
  reasonForVisit: z.string().optional(),
  reasonAdditional: z.string().optional(),
  pointOfDiscovery: z.boolean().optional(),
  authorizedNonLegalGuardians: z.string().optional(),
  telecom: z.array(z.object({ system: z.string(), value: z.string() })).optional(),
  ssn: z.string().optional(),
  address: z.array(z.unknown()).optional(),
  tags: z.array(z.unknown()).optional(),
  patientBeenSeenBefore: z.boolean().optional(),
});

const TelemedUpdateAppointmentBodySchema = z.object({
  appointmentId: z.string().uuid(),
  patient: PatientSchema,
  locationState: z.string().optional(),
});

export function validateUpdateAppointmentParams(
  input: ZambdaInput
): RequiredProps<UpdateAppointmentRequestParams, 'patient'> & { secrets: Secrets | null } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { appointmentId, patient, locationState } = safeValidate(
    TelemedUpdateAppointmentBodySchema,
    JSON.parse(input.body)
  );

  const isInvalidPatientDate = !DateTime.fromISO(patient.dateOfBirth).isValid;
  if (isInvalidPatientDate) {
    throw new Error('"patient.dateOfBirth" was not read as a valid date');
  }

  if (patient?.phoneNumber && !phoneRegex.test(patient.phoneNumber)) {
    throw new Error('patient phone number is not valid');
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentId,
    patient: patient as RequiredProps<UpdateAppointmentRequestParams, 'patient'>['patient'],
    secrets: input.secrets,
    locationState,
  };
}
