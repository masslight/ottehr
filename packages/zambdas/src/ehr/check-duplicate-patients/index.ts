import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getFirstName, getLastName, getMiddleName, getPatientWithPhoneResolution } from 'utils/lib/fhir/patient';
import {
  CheckDuplicatePatientsResponse,
  DuplicatePatientCandidate,
} from 'utils/lib/types/api/check-duplicate-patients.types';
import { isFullFhirDateString } from 'utils/lib/utils/date';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { filterDuplicatePatients } from './helpers';

const ZAMBDA_NAME = 'check-duplicate-patients';
let m2mToken = '';

export const CheckDuplicatePatientsInputSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dateOfBirth: z.string().refine(isFullFhirDateString, 'must be a full date (YYYY-MM-DD)'),
  includeAccountPhone: z.boolean().optional(),
});

export type CheckDuplicatePatientsInputValidated = ValidatedZambdaInput<typeof CheckDuplicatePatientsInputSchema>;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const parameters = validateWithSchema(CheckDuplicatePatientsInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, parameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, parameters.secrets);
  const output = await performEffect(parameters, oystehr);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function performEffect(
  input: CheckDuplicatePatientsInputValidated,
  oystehr: Oystehr
): Promise<CheckDuplicatePatientsResponse> {
  const { firstName, lastName, dateOfBirth, includeAccountPhone } = input;

  const sameBirthDatePatients = await getAllFhirSearchPages<Patient>(
    {
      resourceType: 'Patient',
      params: [
        { name: 'given', value: firstName },
        { name: 'family', value: lastName },
        { name: 'birthdate', value: dateOfBirth },
      ],
    },
    oystehr
  );
  const matches = filterDuplicatePatients(sameBirthDatePatients, firstName, lastName).filter(
    (patient): patient is Patient & { id: string } => !!patient.id
  );

  const candidates = await Promise.all(
    matches.map(async (patient): Promise<DuplicatePatientCandidate> => {
      const candidate: DuplicatePatientCandidate = {
        patientId: patient.id,
        firstName: getFirstName(patient),
        middleName: getMiddleName(patient),
        lastName: getLastName(patient),
        dateOfBirth: patient.birthDate,
        sex: patient.gender,
      };
      if (!includeAccountPhone) return candidate;
      try {
        const { phoneResolution } = await getPatientWithPhoneResolution(patient.id, oystehr);
        return { ...candidate, phone: phoneResolution };
      } catch (error) {
        console.error(`Failed to resolve the account of Patient/${patient.id}:`, error);
        return { ...candidate, phone: { status: 'error' } };
      }
    })
  );
  return { candidates };
}
