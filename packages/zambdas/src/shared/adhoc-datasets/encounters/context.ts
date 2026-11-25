import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Condition,
  DocumentReference,
  Encounter,
  FhirResource,
  Location,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Patient,
  Practitioner,
  Procedure,
  QuestionnaireResponse,
  ServiceRequest,
} from 'fhir/r4b';
import { isIntakePaperworkQuestionnaireResponse } from 'utils/lib/fhir/questionnaires';
import { AdHocEncounterRow, EncounterLayerId } from 'utils/lib/types/adhoc/datasets/encounters';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';
import { fetchScopedResources } from '../../adhoc-report';
import { EncounterOrderRecords, fetchEncounterOrders } from '../encounter-orders';
import { ByIdLoader, byIdLoader, once } from '../memo';
import { indexByEncounter, stripEnc } from './helpers';

export interface EncounterRoot {
  resources: (Appointment | Encounter)[];
  participants?: Promise<{ patients: Patient[]; locations: Location[] }>;
  appointmentMap: Map<string, Appointment>;
  patientMap: Map<string, Patient>;
  locationMap: Map<string, Location>;
  encounterById: Map<string, Encounter>;
}

export interface MedicationAdministrationBundle {
  byEncounter: Map<string, MedicationAdministration[]>;
  resources: (MedicationAdministration | MedicationStatement | MedicationRequest | Practitioner)[];
}

export interface EncounterReportContext {
  oystehr: Oystehr;
  dateRange: { start: string; end: string };
  environment: string;
  requested: ReadonlySet<EncounterLayerId>;
  root: EncounterRoot;
  rootLookups(): Promise<void>;
  encRefs: string[];
  practitioners: ByIdLoader<Practitioner>;
  conditions: ByIdLoader<Condition>;
  shared: {
    diagnoses(): Promise<void>;
    procedures(): Promise<Map<string, Procedure[]>>;
    docRefs(): Promise<Map<string, DocumentReference[]>>;
    serviceRequests(): Promise<Map<string, ServiceRequest[]>>;
    medicationAdministrations(): Promise<MedicationAdministrationBundle>;
    observations(): Promise<Map<string, Observation[]>>;
    encounterConditions(): Promise<Map<string, Condition[]>>;
    paperwork(): Promise<Map<string, QuestionnaireResponse>>;
    encounterOrders(): Promise<Map<string, EncounterOrderRecords>>;
  };
}

export interface EncounterRowInput {
  encounter: Encounter;
  appointment: Appointment;
  patient: Patient | undefined;
  /** The visit's location (its timezone gives the visit day). */
  location: Location | undefined;
  attendingPractitioner: Practitioner | undefined;
  isFollowUpRow: boolean;
  visitStatus: string;
  statusHistory: ReturnType<typeof getVisitStatusHistory>;
}

export interface EncounterLayerModule<Out> {
  id: EncounterLayerId;
  fetch(ctx: EncounterReportContext): Promise<Out>;
  map(row: EncounterRowInput, out: Out, ctx: EncounterReportContext): Partial<AdHocEncounterRow>;
}

export type AnyEncounterLayerModule = EncounterLayerModule<unknown>;

export const defineEncounterLayer = <Out>(module: EncounterLayerModule<Out>): AnyEncounterLayerModule =>
  module as unknown as AnyEncounterLayerModule;

export function createEncounterContext(params: {
  oystehr: Oystehr;
  dateRange: { start: string; end: string };
  environment: string;
  requested: ReadonlySet<EncounterLayerId>;
  root: EncounterRoot;
  loadRootLookups: () => Promise<Practitioner[]>;
  timings?: Map<string, number>;
}): EncounterReportContext {
  const { oystehr, root, requested, environment } = params;
  const encRefs = Array.from(root.encounterById.keys()).map((id) => `Encounter/${id}`);

  const loader = byIdLoader<Practitioner>((ids) =>
    fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids, [{ name: '_elements', value: 'id,name' }])
  );
  const rootLookups = once(async () => {
    loader.add(await params.loadRootLookups());
  });
  const practitioners: ByIdLoader<Practitioner> = {
    map: loader.map,
    add: loader.add,
    load: async (ids) => {
      await rootLookups();
      await loader.load(ids);
    },
  };

  const conditions = byIdLoader<Condition>((ids) => fetchScopedResources<Condition>(oystehr, 'Condition', '_id', ids));

  const scoped = <T extends FhirResource>(
    resourceType: T['resourceType'],
    paramName: string,
    values: string[],
    extraParams: { name: string; value: string }[] = []
  ): Promise<T[]> => fetchScopedResources<T>(oystehr, resourceType, paramName, values, extraParams);

  const shared: EncounterReportContext['shared'] = {
    diagnoses: once(() =>
      conditions.load(
        Array.from(root.encounterById.values()).flatMap((e) =>
          (e.diagnosis ?? []).map((d) => d.condition?.reference?.replace('Condition/', ''))
        )
      )
    ),

    procedures: once(async () =>
      indexByEncounter(await scoped<Procedure>('Procedure', 'encounter', encRefs), (p) =>
        stripEnc(p.encounter?.reference)
      )
    ),

    docRefs: once(async () =>
      indexByEncounter(
        await scoped<DocumentReference>('DocumentReference', 'encounter', encRefs, [
          { name: '_elements', value: 'type,description,meta,context,status' },
        ]),
        (d) => stripEnc(d.context?.encounter?.[0]?.reference)
      )
    ),

    serviceRequests: once(async () =>
      indexByEncounter(await scoped<ServiceRequest>('ServiceRequest', 'encounter', encRefs), (s) =>
        stripEnc(s.encounter?.reference)
      )
    ),

    medicationAdministrations: once(async () => {
      const resources = await scoped<MedicationAdministration | MedicationStatement | MedicationRequest | Practitioner>(
        'MedicationAdministration',
        'context',
        encRefs,
        requested.has('medications')
          ? [
              { name: '_revinclude', value: 'MedicationStatement:part-of' },
              { name: '_include', value: 'MedicationAdministration:performer' },
              { name: '_include', value: 'MedicationAdministration:request' },
            ]
          : []
      );

      await rootLookups();
      practitioners.add(
        resources.filter((r): r is Practitioner => r.resourceType === 'Practitioner'),
        { overwrite: true }
      );

      return {
        resources,
        byEncounter: indexByEncounter(
          resources.filter((r): r is MedicationAdministration => r.resourceType === 'MedicationAdministration'),
          (m) => stripEnc(m.context?.reference)
        ),
      };
    }),

    observations: once(async () =>
      indexByEncounter(await scoped<Observation>('Observation', 'encounter', encRefs), (o) =>
        stripEnc(o.encounter?.reference)
      )
    ),

    encounterConditions: once(async () =>
      indexByEncounter(await scoped<Condition>('Condition', 'encounter', encRefs), (c) =>
        stripEnc(c.encounter?.reference)
      )
    ),

    paperwork: once(async () => {
      const byEncounter = new Map<string, QuestionnaireResponse>();
      for (const qr of await scoped<QuestionnaireResponse>('QuestionnaireResponse', 'encounter', encRefs)) {
        const encId = stripEnc(qr.encounter?.reference);
        if (encId && isIntakePaperworkQuestionnaireResponse(qr)) byEncounter.set(encId, qr);
      }
      return byEncounter;
    }),

    encounterOrders: once(async () => {
      await rootLookups();
      return fetchEncounterOrders(oystehr, {
        encounters: Array.from(root.encounterById.values()),
        practitioners: Array.from(practitioners.map.values()),
        environment,
        includeLabs: requested.has('labs'),
        includeNursing: requested.has('nursing'),
      });
    }),
  };

  for (const name of Object.keys(shared) as (keyof typeof shared)[]) {
    const run = shared[name] as () => Promise<unknown>;
    let timed: Promise<unknown> | undefined;
    (shared as Record<string, () => Promise<unknown>>)[name] = () => {
      if (!timed) {
        const startedAt = Date.now();
        timed = run();
        timed.then(
          () => params.timings?.set(`shared.${name}`, Date.now() - startedAt),
          () => undefined
        );
      }
      return timed;
    };
  }

  return {
    oystehr,
    dateRange: params.dateRange,
    environment,
    requested,
    root,
    rootLookups,
    encRefs,
    practitioners,
    conditions,
    shared,
  };
}
