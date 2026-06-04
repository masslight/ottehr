import { Encounter, Extension, List, ServiceRequest } from 'fhir/r4b';
import { chartDataTagSystem, FHIR_EXTENSION, PROCEDURE_TYPE_SYSTEM } from 'utils';
import { describe, expect, test } from 'vitest';
import { buildLiveProcedureRequest, findProcedurePlans } from '../../src/ehr/apply-template/apply-procedures';

const PROCEDURE_PLAN_TAG = chartDataTagSystem('procedure-template-plan');
const PROCEDURE_META_TAG = chartDataTagSystem('procedure');

const buildEncounter = (): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-live',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/pat-live' },
});

const buildPlan = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: 'plan-1',
  status: 'active',
  intent: 'plan',
  subject: { reference: '#stub-patient' },
  category: [{ coding: [{ system: PROCEDURE_TYPE_SYSTEM, code: 'splint-application' }] }],
  performerType: { coding: [{ code: 'provider' }] },
  bodySite: [{ coding: [{ code: 'wrist' }] }],
  extension: [
    { url: FHIR_EXTENSION.ServiceRequest.bodySide.url, valueString: 'Left' },
    { url: FHIR_EXTENSION.ServiceRequest.technique.url, valueString: 'Closed reduction' },
    { url: FHIR_EXTENSION.ServiceRequest.consentObtained.url, valueBoolean: true },
  ],
  reasonReference: [{ reference: 'Condition/dx-stub-1' }],
  supportingInfo: [{ reference: 'Procedure/cpt-stub-1' }],
  meta: { tag: [{ system: PROCEDURE_PLAN_TAG, code: 'procedure-template-plan' }] },
  ...overrides,
});

const buildContainerMap = (entries: Record<string, string>): Map<string, string> => new Map(Object.entries(entries));

describe('findProcedurePlans', () => {
  test('returns only ServiceRequests with intent=plan AND the procedure-template-plan meta tag', () => {
    const planSr = buildPlan();
    const otherSr: ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: 'sr-other',
      status: 'active',
      intent: 'plan',
      subject: { reference: '#x' },
      // Different tag system - this is an in-house lab plan, not a procedure plan.
      meta: { tag: [{ system: chartDataTagSystem('in-house-lab-template-plan'), code: 'in-house-lab-template-plan' }] },
    };
    const nonPlanSr: ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: 'sr-order',
      status: 'completed',
      intent: 'original-order', // not 'plan'
      subject: { reference: '#x' },
      meta: { tag: [{ system: PROCEDURE_PLAN_TAG, code: 'procedure-template-plan' }] },
    };
    const list: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      contained: [planSr, otherSr, nonPlanSr],
    };
    expect(findProcedurePlans(list)).toEqual([planSr]);
  });

  test('returns [] when the template has no contained array', () => {
    const list: List = { resourceType: 'List', status: 'current', mode: 'working' };
    expect(findProcedurePlans(list)).toEqual([]);
  });
});

describe('buildLiveProcedureRequest', () => {
  test('rewrites reasonReference and supportingInfo through the contained-id -> fullUrl map', () => {
    const containedIdToNewFullUrl = buildContainerMap({
      'dx-stub-1': 'urn:uuid:dx-new',
      'cpt-stub-1': 'urn:uuid:cpt-new',
    });
    const { request, droppedReasonReferences, droppedSupportingInfo } = buildLiveProcedureRequest({
      plan: buildPlan(),
      encounter: buildEncounter(),
      containedIdToNewFullUrl,
    });
    expect(droppedReasonReferences).toBe(0);
    expect(droppedSupportingInfo).toBe(0);
    expect(request.method).toBe('POST');
    expect(request.url).toBe('ServiceRequest');
    expect(request.fullUrl).toMatch(/^urn:uuid:/);
    const sr = request.resource as ServiceRequest;
    expect(sr.reasonReference).toEqual([{ reference: 'urn:uuid:dx-new' }]);
    expect(sr.supportingInfo).toEqual([{ reference: 'urn:uuid:cpt-new' }]);
  });

  test('drops references whose target is not in the contained-id map and counts them', () => {
    // Only the CPT is in the map - the diagnosis section was skipped on apply,
    // so its stub id has no new fullUrl. The remap must drop the reasonReference
    // entry rather than leak the template-stub id to the live transaction.
    const containedIdToNewFullUrl = buildContainerMap({
      'cpt-stub-1': 'urn:uuid:cpt-new',
    });
    const { request, droppedReasonReferences, droppedSupportingInfo } = buildLiveProcedureRequest({
      plan: buildPlan(),
      encounter: buildEncounter(),
      containedIdToNewFullUrl,
    });
    expect(droppedReasonReferences).toBe(1);
    expect(droppedSupportingInfo).toBe(0);
    const sr = request.resource as ServiceRequest;
    // reasonReference shouldn't even appear on the resource when it's empty,
    // so the consumer doesn't have to special-case [] vs undefined later on.
    expect(sr.reasonReference).toBeUndefined();
    expect(sr.supportingInfo).toEqual([{ reference: 'urn:uuid:cpt-new' }]);
  });

  test('sets live subject/encounter and overwrites the template stub references', () => {
    const { request } = buildLiveProcedureRequest({
      plan: buildPlan(),
      encounter: buildEncounter(),
      containedIdToNewFullUrl: new Map(),
    });
    const sr = request.resource as ServiceRequest;
    expect(sr.subject?.reference).toBe('Patient/pat-live');
    expect(sr.encounter?.reference).toBe('Encounter/enc-live');
  });

  test('emits intent=original-order, status=completed, and a fresh authoredOn timestamp', () => {
    // The plan's status='active'/intent='plan' would be invalid for a chart
    // procedure - the live save flow uses 'completed'/'original-order'. Pin
    // those defaults here so a future regression doesn't ship a plan-shape
    // ServiceRequest into the chart.
    const { request } = buildLiveProcedureRequest({
      plan: buildPlan(),
      encounter: buildEncounter(),
      containedIdToNewFullUrl: new Map(),
    });
    const sr = request.resource as ServiceRequest;
    expect(sr.status).toBe('completed');
    expect(sr.intent).toBe('original-order');
    expect(sr.authoredOn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('tags the new resource with chartDataTagSystem("procedure") so it shows up in get-chart-data', () => {
    const { request } = buildLiveProcedureRequest({
      plan: buildPlan(),
      encounter: buildEncounter(),
      containedIdToNewFullUrl: new Map(),
    });
    const sr = request.resource as ServiceRequest;
    expect(sr.meta?.tag?.some((t) => t.system === PROCEDURE_META_TAG && t.code === 'procedure')).toBe(true);
    // It must NOT carry the plan tag - that's a template-only marker.
    expect(sr.meta?.tag?.some((t) => t.system === PROCEDURE_PLAN_TAG)).toBe(false);
  });

  test('preserves category, performerType, bodySite, and all extensions verbatim', () => {
    const customExtensions: Extension[] = [
      { url: FHIR_EXTENSION.ServiceRequest.medicationUsed.url, valueString: 'Lidocaine 1%' },
      { url: FHIR_EXTENSION.ServiceRequest.suppliesUsed.url, valueString: 'Splint kit' },
      { url: FHIR_EXTENSION.ServiceRequest.timeSpent.url, valueString: '15 minutes' },
    ];
    const plan = buildPlan({ extension: customExtensions });
    const { request } = buildLiveProcedureRequest({
      plan,
      encounter: buildEncounter(),
      containedIdToNewFullUrl: new Map(),
    });
    const sr = request.resource as ServiceRequest;
    expect(sr.category).toEqual(plan.category);
    expect(sr.performerType).toEqual(plan.performerType);
    expect(sr.bodySite).toEqual(plan.bodySite);
    expect(sr.extension).toEqual(customExtensions);
  });

  test('omits optional fields when the plan does not carry them', () => {
    // A sparse template entry (procedure with only a CPT and no other form
    // fields) shouldn't end up with empty arrays / undefined extensions on the
    // resulting ServiceRequest.
    const sparsePlan = buildPlan({
      category: undefined,
      performerType: undefined,
      bodySite: undefined,
      extension: undefined,
      reasonReference: undefined,
      supportingInfo: undefined,
    });
    const { request } = buildLiveProcedureRequest({
      plan: sparsePlan,
      encounter: buildEncounter(),
      containedIdToNewFullUrl: new Map(),
    });
    const sr = request.resource as ServiceRequest;
    expect(sr.category).toBeUndefined();
    expect(sr.performerType).toBeUndefined();
    expect(sr.bodySite).toBeUndefined();
    expect(sr.extension).toBeUndefined();
    expect(sr.reasonReference).toBeUndefined();
    expect(sr.supportingInfo).toBeUndefined();
  });
});
