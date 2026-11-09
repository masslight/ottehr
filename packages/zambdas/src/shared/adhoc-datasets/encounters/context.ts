// The report context of the encounters dataset: root resources, memoized shared searches and by-id
// loaders. Layer modules read only from here; no layer calls FHIR except through the fetch helpers.
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
  /** Keyed `Appointment/{id}`. */
  appointmentMap: Map<string, Appointment>;
  /** Keyed `Patient/{id}`. */
  patientMap: Map<string, Patient>;
  /** Keyed `Location/{id}`. */
  locationMap: Map<string, Location>;
  /** Keyed by id. */
  encounterById: Map<string, Encounter>;
}

export interface MedicationAdministrationBundle {
  byEncounter: Map<string, MedicationAdministration[]>;
  /** The MAs with what rides along: administration statements, performers, requests. */
  resources: (MedicationAdministration | MedicationStatement | MedicationRequest | Practitioner)[];
}

export interface EncounterReportContext {
  oystehr: Oystehr;
  dateRange: { start: string; end: string };
  environment: string;
  requested: ReadonlySet<EncounterLayerId>;
  root: EncounterRoot;
  /** `Encounter/{id}` of every encounter of the report. */
  encRefs: string[];
  /** Keyed by id. Seeded with the attending / intake practitioners of the root. */
  practitioners: ByIdLoader<Practitioner>;
  /** Keyed by id: diagnoses and the conditions drugs were given for. */
  conditions: ByIdLoader<Condition>;
  shared: {
    /** Loads the visits' diagnosis Conditions into `conditions`. */
    diagnoses(): Promise<void>;
    procedures(): Promise<Map<string, Procedure[]>>;
    docRefs(): Promise<Map<string, DocumentReference[]>>;
    serviceRequests(): Promise<Map<string, ServiceRequest[]>>;
    medicationAdministrations(): Promise<MedicationAdministrationBundle>;
    /** Every Observation of the visits (exam, ROS, screening, vitals…), for the layers that read several kinds. */
    observations(): Promise<Map<string, Observation[]>>;
    encounterConditions(): Promise<Map<string, Condition[]>>;
    paperwork(): Promise<Map<string, QuestionnaireResponse>>;
    encounterOrders(): Promise<Map<string, EncounterOrderRecords>>;
  };
}

/** What a layer's `map` gets for one row. */
export interface EncounterRowInput {
  encounter: Encounter;
  appointment: Appointment;
  patient: Patient | undefined;
  attendingPractitioner: Practitioner | undefined;
  isFollowUpRow: boolean;
  visitStatus: string;
  statusHistory: ReturnType<typeof getVisitStatusHistory>;
}

/** One layer: what it fetches for the whole report, and the columns it adds to one row. */
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
  practitioners: Practitioner[];
}): EncounterReportContext {
  const { oystehr, root, requested, environment } = params;
  const encRefs = Array.from(root.encounterById.keys()).map((id) => `Encounter/${id}`);

  const practitioners = byIdLoader<Practitioner>((ids) =>
    fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids, [{ name: '_elements', value: 'id,name' }])
  );
  practitioners.add(params.practitioners);

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

    // The in-house administration MedicationStatement has no encounter context — only partOf → MA — so it
    // rides along the MA search as a revinclude (the same way get-medication-orders reads it). As
    // get-medication-orders searches: the order's performers and its MedicationRequest ride along.
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

    // The visit's intake paperwork (QuestionnaireResponse).
    paperwork: once(async () => {
      const byEncounter = new Map<string, QuestionnaireResponse>();
      for (const qr of await scoped<QuestionnaireResponse>('QuestionnaireResponse', 'encounter', encRefs)) {
        const encId = stripEnc(qr.encounter?.reference);
        if (encId && isIntakePaperworkQuestionnaireResponse(qr)) byEncounter.set(encId, qr);
      }
      return byEncounter;
    }),

    encounterOrders: once(() =>
      fetchEncounterOrders(oystehr, {
        encounters: Array.from(root.encounterById.values()),
        practitioners: Array.from(practitioners.map.values()),
        environment,
        includeLabs: requested.has('labs'),
        includeNursing: requested.has('nursing'),
      })
    ),
  };

  return {
    oystehr,
    dateRange: params.dateRange,
    environment,
    requested,
    root,
    encRefs,
    practitioners,
    conditions,
    shared,
  };
}
