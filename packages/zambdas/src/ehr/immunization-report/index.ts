import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Coding,
  Encounter,
  Extension,
  Location,
  MedicationAdministration,
  Patient,
  Practitioner,
} from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_NDC,
  CVX_CODE_SYSTEM_URL,
  getAttendingPractitionerId,
  getCoding,
  getInPersonVisitStatus,
  getMedicationName,
  getMiddleName,
  getPatientAddress,
  getPatientContactEmail,
  getPatientFirstName,
  getPatientLastName,
  getPhoneNumberForIndividual,
  getSecret,
  ImmunizationReportItem,
  ImmunizationReportZambdaInput,
  ImmunizationReportZambdaOutput,
  mapFhirToOrderStatus,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
  MEDICATION_APPLIANCE_LOCATION_SYSTEM,
  MVX_CODE_SYSTEM_URL,
  OTTEHR_MODULE,
  PATIENT_ETHNICITY_URL,
  PATIENT_RACE_URL,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  Secrets,
  SecretsKeys,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
  VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getContainedMedication } from '../immunization/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'immunization-report';

// Encounter statuses that represent completed visits
const COMPLETED_ENCOUNTER_STATUSES = ['completed', 'discharged', 'awaiting supervisor approval'];

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters: ImmunizationReportZambdaInput & { secrets: Secrets };
  try {
    console.group('validateRequestParameters');
    validatedParameters = validateRequestParameters(input);
    const { dateRange, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log('Searching for appointments in date range:', dateRange);

    // Step 1: Search for appointments within the date range with proper pagination
    let allResources: (Appointment | Encounter | Patient | Location | Practitioner)[] = [];
    let offset = 0;
    const pageSize = 1000;

    const baseSearchParams = [
      {
        name: 'date',
        value: `ge${dateRange.start}`,
      },
      {
        name: 'date',
        value: `le${dateRange.end}`,
      },
      {
        name: 'status',
        value: 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist',
      },
      {
        name: '_tag',
        value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}`,
      },
      {
        name: '_include',
        value: 'Appointment:patient',
      },
      {
        name: '_include',
        value: 'Appointment:location',
      },
      {
        name: '_revinclude',
        value: 'Encounter:appointment',
      },
      {
        name: '_include:iterate',
        value: 'Encounter:participant:Practitioner',
      },
      {
        name: '_sort',
        value: 'date',
      },
      {
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    let searchBundle = await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of appointments...`);

    let pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);

    // Follow pagination links to get all pages
    while (searchBundle.link?.find((link) => link.relation === 'next')) {
      offset += pageSize;
      pageCount++;
      console.log(`Fetching page ${pageCount} of appointments...`);

      searchBundle = await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner>({
        resourceType: 'Appointment',
        params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
      });

      pageResources = searchBundle.unbundle();
      allResources = allResources.concat(pageResources);

      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }
    }

    console.log(`Found ${allResources.length} total resources across ${pageCount} pages`);

    // Separate resources by type
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const patients = allResources.filter((resource): resource is Patient => resource.resourceType === 'Patient');
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');
    const practitioners = allResources.filter(
      (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
    );

    // Create lookup maps
    const appointmentMap = new Map<string, Appointment>();
    appointments.forEach((apt) => {
      if (apt.id) {
        appointmentMap.set(`Appointment/${apt.id}`, apt);
      }
    });

    const patientMap = new Map<string, Patient>();
    patients.forEach((patient) => {
      if (patient.id) {
        patientMap.set(`Patient/${patient.id}`, patient);
      }
    });

    const locationMap = new Map<string, Location>();
    locations.forEach((location) => {
      if (location.id) {
        locationMap.set(`Location/${location.id}`, location);
      }
    });

    const practitionerMap = new Map<string, Practitioner>();
    practitioners.forEach((practitioner) => {
      if (practitioner.id) {
        practitionerMap.set(practitioner.id, practitioner);
      }
    });

    // Step 2: Filter to completed encounters
    const completeEncounters = encounters.filter((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;

      if (!appointment) {
        return false;
      }

      const visitStatus = getInPersonVisitStatus(appointment, encounter, true);
      return COMPLETED_ENCOUNTER_STATUSES.includes(visitStatus);
    });

    console.log(`Found ${completeEncounters.length} completed encounters`);

    if (completeEncounters.length === 0) {
      const response: ImmunizationReportZambdaOutput = {
        message: 'No completed encounters found in date range',
        totalImmunizations: 0,
        immunizations: [],
        dateRange,
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    // Build encounter-to-appointment/patient/location maps
    const encounterContextMap = new Map<
      string,
      { encounter: Encounter; appointment: Appointment; patient: Patient; locationName: string }
    >();

    completeEncounters.forEach((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;
      const patientRef = encounter.subject?.reference;
      const patient = patientRef ? patientMap.get(patientRef) : undefined;
      const locationRef = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference;
      const location = locationRef ? locationMap.get(locationRef) : undefined;

      if (encounter.id && appointment && patient) {
        encounterContextMap.set(`Encounter/${encounter.id}`, {
          encounter,
          appointment,
          patient,
          locationName: location?.name || 'Unknown',
        });
      }
    });

    // Step 3: Batch-fetch MedicationAdministration resources tagged 'immunization' for completed encounters
    const encounterIds = completeEncounters.map((e) => e.id).filter(Boolean) as string[];
    const allMedicationAdministrations: MedicationAdministration[] = [];

    // Fetch in batches of 50 encounter IDs to avoid URL length limits
    const batchSize = 50;
    for (let i = 0; i < encounterIds.length; i += batchSize) {
      const batchIds = encounterIds.slice(i, i + batchSize);
      const contextValue = batchIds.map((id) => `Encounter/${id}`).join(',');

      const maBundle = await oystehr.fhir.search<MedicationAdministration>({
        resourceType: 'MedicationAdministration',
        params: [
          { name: '_tag', value: 'immunization' },
          { name: 'context', value: contextValue },
          { name: '_count', value: '1000' },
        ],
      });

      allMedicationAdministrations.push(...maBundle.unbundle());
    }

    console.log(`Found ${allMedicationAdministrations.length} immunization MedicationAdministrations`);

    // Step 4: Map each MedicationAdministration to an ImmunizationReportItem
    const immunizations: ImmunizationReportItem[] = allMedicationAdministrations
      .map((ma) => {
        const encounterRef = ma.context?.reference;
        const context = encounterRef ? encounterContextMap.get(encounterRef) : undefined;

        if (!context) {
          return null;
        }

        const { encounter, appointment, patient, locationName } = context;
        const medication = getContainedMedication(ma);
        // Codes are stored as extensions on the contained Medication resource
        const administrationCodesExtensions = (medication?.extension ?? []).filter(
          (extension) => extension.url === VACCINE_ADMINISTRATION_CODES_EXTENSION_URL
        );

        // Extract patient demographics
        const patientAddress = getPatientAddress(patient.address);
        const addressParts = [patientAddress.addressLine, patientAddress.addressLine2, patientAddress.cityStateZIP]
          .filter(Boolean)
          .join(', ');

        const raceExtension = patient.extension?.find((e) => e.url === PATIENT_RACE_URL);
        const ethnicityExtension = patient.extension?.find((e) => e.url === PATIENT_ETHNICITY_URL);
        const raceOrEthnicity = [
          raceExtension?.valueString || raceExtension?.valueCodeableConcept?.coding?.[0]?.display,
          ethnicityExtension?.valueString || ethnicityExtension?.valueCodeableConcept?.coding?.[0]?.display,
        ]
          .filter(Boolean)
          .join(', ');

        // Extract immunization details
        const dosage = ma.dosage;
        const routeCoding = getCoding(dosage?.route, MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM);
        const siteCoding = getCoding(dosage?.site, MEDICATION_APPLIANCE_LOCATION_SYSTEM);

        // Get provider helper
        const resolveProviderName = (performerCode: string): string => {
          const performer = ma.performer?.find(
            (p) => getCoding(p.function, MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM)?.code === performerCode
          );
          const ref = performer?.actor?.reference;
          const id = ref?.split('/')[1];
          const practitioner = id ? practitionerMap.get(id) : undefined;
          return (
            performer?.actor?.display ||
            (practitioner
              ? `${practitioner.name?.[0]?.given?.[0] || ''} ${practitioner.name?.[0]?.family || ''}`.trim()
              : '')
          );
        };

        // Administering provider: from MA performer, fall back to encounter's attending practitioner
        let administeringProviderName = resolveProviderName(PRACTITIONER_ADMINISTERED_MEDICATION_CODE);
        if (!administeringProviderName) {
          const attendingPractitionerId = getAttendingPractitionerId(encounter);
          const attendingPractitioner = attendingPractitionerId
            ? practitionerMap.get(attendingPractitionerId)
            : undefined;
          if (attendingPractitioner) {
            administeringProviderName = `${attendingPractitioner.name?.[0]?.given?.[0] || ''} ${
              attendingPractitioner.name?.[0]?.family || ''
            }`.trim();
          }
        }

        // Ordered-by provider
        const orderedByProviderName = resolveProviderName(PRACTITIONER_ORDERED_BY_MEDICATION_CODE);

        // VIS given (yes/no based on whether visGivenDate exists on contained Medication)
        const visGivenDate = medication?.extension?.find((e) => e.url === VACCINE_ADMINISTRATION_VIS_DATE_EXTENSION_URL)
          ?.valueDate;
        const visGiven = visGivenDate != null ? 'Yes' : 'No';

        const visitStatus = getInPersonVisitStatus(appointment, encounter, true);

        const item: ImmunizationReportItem = {
          patientId: patient.id || '',
          firstName: getPatientFirstName(patient) || '',
          middleName: getMiddleName(patient) || '',
          lastName: getPatientLastName(patient) || '',
          dateOfBirth: patient.birthDate || '',
          sex: patient.gender || '',
          raceOrEthnicity,
          address: addressParts,
          phoneNumber: getPhoneNumberForIndividual(patient) || '',
          email: getPatientContactEmail(patient) || '',
          medicationAdministrationId: ma.id || '',
          vaccineName: getMedicationName(medication) || '',
          dose: ma.dosage?.dose?.value?.toString() || '',
          units: ma.dosage?.dose?.unit || '',
          orderedByProvider: orderedByProviderName,
          instructions: ma.dosage?.text || '',
          orderStatus: mapFhirToOrderStatus(ma) || '',
          dateAdministered: ma.effectiveDateTime || '',
          cptCode: findCoding(administrationCodesExtensions, CODE_SYSTEM_CPT)?.code || '',
          cvxCode: findCoding(administrationCodesExtensions, CVX_CODE_SYSTEM_URL)?.code || '',
          mvxCode: findCoding(administrationCodesExtensions, MVX_CODE_SYSTEM_URL)?.code || '',
          ndcCode: findCoding(administrationCodesExtensions, CODE_SYSTEM_NDC)?.code || '',
          lotNumber: medication?.batch?.lotNumber || '',
          expirationDate: medication?.batch?.expirationDate || '',
          anatomicalSite: siteCoding?.display || siteCoding?.code || '',
          route: routeCoding?.display || routeCoding?.code || '',
          administeringProvider: administeringProviderName,
          visGiven,
          encounterId: encounter.id || '',
          appointmentId: appointment.id || '',
          encounterDate: appointment.start || '',
          location: locationName,
          status: visitStatus,
        };
        return item;
      })
      .filter((item): item is ImmunizationReportItem => item !== null);

    const response: ImmunizationReportZambdaOutput = {
      message: `Found ${immunizations.length} immunizations across ${completeEncounters.length} completed encounters`,
      totalImmunizations: immunizations.length,
      immunizations,
      dateRange,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function findCoding(extensions: Extension[], system: string): Coding | undefined {
  for (const extension of extensions) {
    const coding = getCoding(extension.valueCodeableConcept, system);
    if (coding) {
      return coding;
    }
  }
  return undefined;
}
