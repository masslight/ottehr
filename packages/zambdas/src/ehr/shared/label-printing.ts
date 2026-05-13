import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Encounter,
  Location,
  Organization,
  Patient,
  Schedule,
  ServiceRequest,
  Slot,
  Specimen,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DYMO_30334_LABEL_CONFIG,
  ExternalLabsLabelConfig,
  getMiddleName,
  getOrderNumber,
  getPatientFirstName,
  getPatientLastName,
  getTimezone,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LABEL_PRINTING_ERROR,
  makeExternalLabLabelConfig,
} from 'utils';
import { VisitLabelConfig } from '../../shared/pdf/visit-label-pdf';

export const getVisitLabelConfig = async (oystehr: Oystehr, encounterId: string): Promise<VisitLabelConfig> => {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Appointment | Slot | Schedule>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:slot',
        },
        {
          name: '_include:iterate',
          value: 'Slot:schedule',
        },
      ],
    })
  ).unbundle();

  const { patients, appointments, schedules } = resources.reduce(
    (acc, res) => {
      if (res.resourceType === 'Patient') acc.patients.push(res);
      if (res.resourceType === 'Appointment') acc.appointments.push(res);
      if (res.resourceType === 'Schedule') acc.schedules.push(res);
      return acc;
    },
    { patients: [], appointments: [], schedules: [] } as {
      patients: Patient[];
      appointments: Appointment[];
      schedules: Schedule[];
    }
  );

  if (patients.length !== 1 || appointments.length !== 1) {
    throw LABEL_PRINTING_ERROR(`Error fetching patient, encounter, or appointment for Encounter/${encounterId}`);
  }

  const patient = patients[0];

  const labelConfig: VisitLabelConfig = {
    labelConfig: DYMO_30334_LABEL_CONFIG, // future todo: this is a bit of a vestige at this point, should clean up at some point
    content: {
      patientId: patient.id!,
      patientFirstName: getPatientFirstName(patient) ?? '',
      patientMiddleName: getMiddleName(patient),
      patientLastName: getPatientLastName(patient) ?? '',
      patientDateOfBirth: patient.birthDate ? DateTime.fromISO(patient.birthDate) : undefined,
      patientGender: patient.gender ?? '',
      visitDate: appointments[0].start ? DateTime.fromISO(appointments[0].start) : undefined,
      visitTimeZone: schedules[0] ? getTimezone(schedules[0]) : undefined,
    },
    type: 'visit',
  };

  return labelConfig;
};

export const getExternalLabLabelConfig = async (
  oystehr: Oystehr,
  serviceRequestId: string,
  userTimezone: string
): Promise<ExternalLabsLabelConfig> => {
  // this is a slight optimization to grab all the Locations in parallel and then filter rather than make consecutive calls
  const [resources, locations] = await Promise.all([
    (
      await oystehr.fhir.search<ServiceRequest | Patient | Organization | Specimen>({
        resourceType: 'ServiceRequest',
        params: [
          {
            name: '_id',
            value: serviceRequestId,
          },
          {
            name: '_include',
            value: 'ServiceRequest:patient',
          },
          {
            name: '_include',
            value: 'ServiceRequest:performer',
          },
          {
            name: '_include',
            value: 'ServiceRequest:specimen',
          },
        ],
      })
    ).unbundle(),
    (
      await oystehr.fhir.search<Location>({
        resourceType: 'Location',
        params: [
          {
            name: 'identifier',
            value: `${LAB_ACCOUNT_NUMBER_SYSTEM}|`, // this will grab any account number identifiers regardless of the account number value
          },
        ],
      })
    ).unbundle(),
  ]);

  const patient = resources.find((res): res is Patient => res.resourceType === 'Patient');
  if (!patient)
    throw LABEL_PRINTING_ERROR(
      `Unable to make external label config. ServiceRequest/${serviceRequestId} missing patient`
    );

  const labOrganization = resources.find((res): res is Organization => res.resourceType === 'Organization');
  if (!labOrganization)
    throw LABEL_PRINTING_ERROR(
      `Unable to make external label config. ServiceRequest/${serviceRequestId} missing performing organization`
    );

  const specimens = resources.filter((res): res is Specimen => res.resourceType === 'Specimen');

  // for the given test, grab the latest specimen collection date
  const specimenColelctionDateTimes = specimens
    .map((sp) => (sp.collection?.collectedDateTime ? DateTime.fromISO(sp.collection.collectedDateTime) : undefined))
    .filter((res) => res !== undefined);
  const specimenCollectionDateTime = specimenColelctionDateTimes.length
    ? DateTime.max(...specimenColelctionDateTimes)
    : undefined;

  const serviceRequest = resources.find((res): res is ServiceRequest => res.resourceType === 'ServiceRequest');
  if (!serviceRequest)
    throw LABEL_PRINTING_ERROR(`Unable to make external label config. ServiceRequest/${serviceRequestId} not found`);

  const allLocationsByRefMap = new Map<string, Location>(locations.map((loc) => [`Location/${loc.id}`, loc]));
  const matchingSRLocationRef = serviceRequest.locationReference?.find((locRef) =>
    allLocationsByRefMap.has(locRef.reference ?? '')
  )?.reference;
  const location =
    matchingSRLocationRef && allLocationsByRefMap.has(matchingSRLocationRef)
      ? allLocationsByRefMap.get(matchingSRLocationRef)!
      : undefined;

  if (!location) {
    console.error(
      `Unable to make external label config. ServiceRequest/${serviceRequestId} does not have a Location with an account number. These were the possible Locations: `,
      JSON.stringify(
        locations.map((loc) => ({
          ref: `Location/${loc.id}`,
          identifiers: loc.identifier,
        }))
      )
    );
    throw LABEL_PRINTING_ERROR(
      `Unable to make external label config. ServiceRequest/${serviceRequestId} does not have a Location with an account number`
    );
  }

  const orderNumber = getOrderNumber(serviceRequest);
  if (!orderNumber) throw LABEL_PRINTING_ERROR('Unable to print label, missing orderNumber');

  // this helper handles matching the location and lab org via getAccountNumberFromLocationAndOrganization
  return makeExternalLabLabelConfig({
    patient,
    orderNumber,
    location,
    labOrganization,
    specimenCollectionDateTime,
    userTimezone,
  });
};
