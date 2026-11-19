import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, FhirResource, Medication, MedicationAdministration, Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  getMedicationInventoryConfig,
  INVENTORY_LOT_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_IDENTIFIER_VALUE,
  INVENTORY_LOT_LOCATION_TAG_SYSTEM,
  parseInventoryLot,
  parseInventoryStockEntry,
} from 'utils/lib/fhir/medication-inventory';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import {
  InventoryLot,
  ListMedicationInventoryInput,
  ListMedicationInventoryInputSchema,
  ListMedicationInventoryResponse,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_MEDICATION_TYPE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import { INVENTORY_STAFF_ROLES } from 'utils/lib/types/api/user.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../../shared/auth';
import { createClinicalOystehrClient } from '../../../../shared/helpers';
import { getInventoryLotHistoryResources } from '../../../../shared/medication-inventory';
import {
  buildAllLocationsRows,
  buildHistory,
  buildLocationRows,
  HistoryNames,
  TrackedDrug,
} from '../../../../shared/medication-inventory-screen';
import { wrapHandler } from '../../../../shared/sentry';
import { ZambdaInput } from '../../../../shared/types/common';
import { validateWithSchema } from '../../../../shared/validation';
import { performEffect as listActiveLocations } from '../../../locations/list-active-locations';

let m2mToken: string;

export const index = wrapHandler(
  'admin-list-medication-inventory',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { secrets, ...params } = validateWithSchema(ListMedicationInventoryInputSchema, input);

    await requireUserWithRole(getUserToken(input), secrets, INVENTORY_STAFF_ROLES);

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
  params: ListMedicationInventoryInput
): Promise<ListMedicationInventoryResponse> => {
  if (params.view === 'lot-history') {
    const resources = await getInventoryLotHistoryResources(oystehr, params.lotId);
    const entries = resources.flatMap((resource) =>
      resource.resourceType === 'Observation' ? parseInventoryStockEntry(resource) ?? [] : []
    );
    return { drugs: [], entries: buildHistory(entries, resolveHistoryNames(resources)) };
  }

  const today = params.today ?? DateTime.now().toISODate();
  const [drugs, lots] = await Promise.all([getTrackedDrugs(oystehr), getLots(oystehr, params)]);
  if (params.view === 'location') {
    return { drugs: buildLocationRows(drugs, lots, params.locationId, today), entries: [] };
  }
  const { locations } = await listActiveLocations(oystehr, { inPersonOnly: true });
  return { drugs: buildAllLocationsRows(drugs, lots, locations, today), entries: [] };
};

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

const getLots = async (
  oystehr: Oystehr,
  params: Extract<ListMedicationInventoryInput, { view: 'location' | 'all-locations' }>
): Promise<InventoryLot[]> => {
  const lots = await getAllFhirSearchPages<Medication>(
    {
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_IDENTIFIER_SYSTEM}|${INVENTORY_LOT_IDENTIFIER_VALUE}` },
        ...(params.view === 'location'
          ? [{ name: '_tag', value: `${INVENTORY_LOT_LOCATION_TAG_SYSTEM}|${params.locationId}` }]
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

const resolveHistoryNames = (resources: FhirResource[]): HistoryNames => {
  const byRef = new Map<string, FhirResource>();
  for (const resource of resources) if (resource.id) byRef.set(`${resource.resourceType}/${resource.id}`, resource);

  const performers = new Map<string, string>();
  const visits: HistoryNames['visits'] = new Map();
  for (const resource of resources) {
    if (resource.resourceType === 'Practitioner' && resource.id) {
      const name = getFullestAvailableName(resource as Practitioner);
      if (name) performers.set(`Practitioner/${resource.id}`, name);
    }
    if (resource.resourceType === 'MedicationAdministration' && resource.id) {
      const administration = resource as MedicationAdministration;
      const patient = byRef.get(administration.subject?.reference ?? '') as Patient | undefined;
      const encounter = byRef.get(administration.context?.reference ?? '') as Encounter | undefined;
      const appointmentId = encounter?.appointment?.[0]?.reference?.replace('Appointment/', '');
      const patientName = patient ? getFullestAvailableName(patient) : undefined;
      const date = encounter?.period?.start;
      visits.set(resource.id, {
        ...(appointmentId ? { appointmentId } : {}),
        ...(patientName ? { patientName } : {}),
        ...(date ? { date } : {}),
      });
    }
  }
  return { performers, visits };
};
