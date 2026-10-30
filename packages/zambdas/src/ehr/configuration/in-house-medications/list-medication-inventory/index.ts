import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Medication, MedicationAdministration, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  getMedicationInventoryConfig,
  INVENTORY_LOT_CLINIC_TAG_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_VALUE,
  parseInventoryLot,
  parseInventoryStockEntry,
} from 'utils/lib/fhir/medication-inventory';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import {
  InventoryLot,
  InventoryStockEntry,
  ListMedicationInventoryInput,
  ListMedicationInventoryResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_MEDICATION_TYPE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { callerHasRole, checkOrCreateM2MClientToken } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { getInventoryLotEntries } from '../../../../shared/medication-inventory';
import {
  buildAllClinicsRows,
  buildClinicRows,
  buildHistory,
  HistoryNames,
  TrackedDrug,
} from '../../../../shared/medication-inventory-screen';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { performEffect as listActiveLocations } from '../../../locations/list-active-locations';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

/** The inventory screen (requirement 7): every tracked drug for one clinic or all clinics, or one lot's history. */
export const index = wrapHandler(
  'admin-list-medication-inventory',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, ...params } = validateRequestParameters(input);

    if (!(await callerHasRole(input.headers?.Authorization, secrets, INVENTORY_STAFF_ROLES))) {
      throw { code: APIErrorCode.NOT_AUTHORIZED, message: 'You are not permitted to view medication inventory.' };
    }

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const response = await performEffect(oystehr, params);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  params: ListMedicationInventoryInput,
  today: DateTime = DateTime.now()
): Promise<ListMedicationInventoryResponse> => {
  if (params.view === 'lot-history') {
    const entries = (await getInventoryLotEntries(oystehr, params.lotId)).flatMap((observation) => {
      const entry = parseInventoryStockEntry(observation);
      return entry ? [entry] : [];
    });
    return { drugs: [], entries: buildHistory(entries, await resolveHistoryNames(oystehr, entries)) };
  }

  const [drugs, lots] = await Promise.all([getTrackedDrugs(oystehr), getLots(oystehr, params)]);
  if (params.view === 'clinic') {
    return { drugs: buildClinicRows(drugs, lots, params.locationId, today), entries: [] };
  }
  const { locations } = await listActiveLocations(oystehr, { inPersonOnly: true });
  return { drugs: buildAllClinicsRows(drugs, lots, locations, today), entries: [] };
};

/** Every catalog drug with an inventory setup. */
const getTrackedDrugs = async (oystehr: Oystehr): Promise<TrackedDrug[]> => {
  const catalog = await getAllFhirSearchPages<Medication>(
    { resourceType: 'Medication', params: [{ name: 'identifier', value: INVENTORY_MEDICATION_TYPE_CODE }] },
    oystehr
  );
  return catalog.flatMap((medication) => {
    const inventory = getMedicationInventoryConfig(medication);
    return medication.id && inventory
      ? [{ medicationId: medication.id, name: getMedicationName(medication) ?? '', inventory }]
      : [];
  });
};

/**
 * Lots at one clinic (empty ones too, so they can still be counted and adjusted), or with stock on hand
 * everywhere (status is derived from the cached on hand).
 */
const getLots = async (
  oystehr: Oystehr,
  params: Extract<ListMedicationInventoryInput, { view: 'clinic' | 'all-clinics' }>
): Promise<InventoryLot[]> => {
  const lots = await getAllFhirSearchPages<Medication>(
    {
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_IDENTIFIER_SYSTEM}|${INVENTORY_LOT_IDENTIFIER_VALUE}` },
        ...(params.view === 'clinic'
          ? [{ name: '_tag', value: `${INVENTORY_LOT_CLINIC_TAG_SYSTEM}|${params.locationId}` }]
          : [{ name: 'status', value: 'active' }]),
      ],
    },
    oystehr
  );
  return lots.flatMap((lot) => {
    const parsed = parseInventoryLot(lot);
    return parsed ? [parsed] : [];
  });
};

/** Who made each entry and, for administrations, which visit it came from. */
const resolveHistoryNames = async (oystehr: Oystehr, entries: InventoryStockEntry[]): Promise<HistoryNames> => {
  const practitionerIds = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.performerReference?.startsWith('Practitioner/')
          ? [entry.performerReference.replace('Practitioner/', '')]
          : []
      )
    ),
  ];
  const administrationIds = [
    ...new Set(
      entries.flatMap((entry) => (entry.medicationAdministrationId ? [entry.medicationAdministrationId] : []))
    ),
  ];

  const [practitioners, visitResources] = await Promise.all([
    practitionerIds.length
      ? getAllFhirSearchPages<Practitioner>(
          { resourceType: 'Practitioner', params: [{ name: '_id', value: practitionerIds.join(',') }] },
          oystehr
        )
      : [],
    administrationIds.length
      ? getAllFhirSearchPages<MedicationAdministration | Patient | Encounter>(
          {
            resourceType: 'MedicationAdministration',
            params: [
              { name: '_id', value: administrationIds.join(',') },
              { name: '_include', value: 'MedicationAdministration:subject' },
              { name: '_include', value: 'MedicationAdministration:context' },
            ],
          },
          oystehr
        )
      : [],
  ]);

  const performers = new Map(
    practitioners.flatMap((practitioner) => {
      const name = getFullestAvailableName(practitioner);
      return practitioner.id && name ? [[`Practitioner/${practitioner.id}`, name] as const] : [];
    })
  );
  const patients = new Map(
    visitResources.flatMap((resource) =>
      resource.resourceType === 'Patient' && resource.id ? [[resource.id, resource] as const] : []
    )
  );
  const encounters = new Map(
    visitResources.flatMap((resource) =>
      resource.resourceType === 'Encounter' && resource.id ? [[resource.id, resource] as const] : []
    )
  );
  const visits: HistoryNames['visits'] = new Map(
    visitResources.flatMap((resource) => {
      if (resource.resourceType !== 'MedicationAdministration' || !resource.id) return [];
      const patient = patients.get(resource.subject?.reference?.replace('Patient/', '') ?? '');
      const encounter = encounters.get(resource.context?.reference?.replace('Encounter/', '') ?? '');
      const appointmentId = encounter?.appointment?.[0]?.reference?.replace('Appointment/', '');
      const patientName = patient ? getFullestAvailableName(patient) : undefined;
      const date = encounter?.period?.start;
      return [
        [
          resource.id,
          {
            ...(appointmentId ? { appointmentId } : {}),
            ...(patientName ? { patientName } : {}),
            ...(date ? { date } : {}),
          },
        ] as const,
      ];
    })
  );
  return { performers, visits };
};
