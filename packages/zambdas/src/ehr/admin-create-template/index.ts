import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, List, Patient, ServiceRequest } from 'fhir/r4b';
import {
  AdminCreateTemplateInput,
  AdminCreateTemplateOutput,
  chartDataTagSystem,
  examConfig,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
  makeOptimisticLockIfMatchHeader,
  REPEAT_TEST_ORDER_DETAIL_TAG_CONFIG,
  resourceHasTagSystem,
  SecretsKeys,
  transactionWasSuccessful,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { AD_CANONICAL_URL_BASE } from '../lab/shared/in-house-labs';
import {
  findHolderList,
  getTemplateEncounterBundle,
  hasTemplateRelevantTag,
  isDiagnosisCondition,
  isInHouseLabRepeatTestCptCode,
  TemplateEncounterResource,
} from '../shared/template-helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(
  'admin-create-template',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);

      const { secrets } = validatedInput;
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const result = await performEffect(validatedInput, oystehr);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-create-template', error, ENVIRONMENT);
    }
  }
);

const performEffect = async (
  validatedInput: AdminCreateTemplateInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr
): Promise<AdminCreateTemplateOutput> => {
  const { encounterId, templateName } = validatedInput;

  // Fetch encounter with all related clinical resources
  let encounterBundle = await getTemplateEncounterBundle(oystehr, encounterId);

  if (!encounterBundle.length) {
    throw new Error('No entries found in encounter bundle, cannot make a template');
  }

  const oldEncounter = encounterBundle.find((resource) => resource.resourceType === 'Encounter') as Encounter;
  if (!oldEncounter) {
    throw new Error('Unexpectedly found no Encounter when preparing template');
  }

  // Determine code system and version based on exam type
  const codeSystem = GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM;
  const examVersion = examConfig.default.version;
  const displayName = 'Global Template';

  // Build List Resource with contained resources
  const listToCreate: List = {
    resourceType: 'List',
    code: {
      coding: [
        {
          system: codeSystem,
          code: 'default',
          version: examVersion,
          display: displayName,
        },
      ],
    },
    // Note: individual template Lists do NOT get the GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM tag.
    // That tag is only on the "holder list" that references all templates.
    // Templates are discovered by being referenced in the holder list's entries, which are fetched via _id search.
    status: 'current',
    mode: 'working',
    title: templateName,
    entry: [],
    contained: [],
  };

  // Create stub patient
  const stubPatient: Patient = {
    resourceType: 'Patient',
    id: uuidV4(),
    name: [
      {
        family: 'stub',
        given: ['placeholder'],
      },
    ],
  };
  listToCreate.contained!.push(stubPatient);
  listToCreate.entry!.push({
    item: {
      reference: `#${stubPatient.id}`,
    },
  });

  const oldIdToNewIdMap = new Map<string, string>();

  // Deduplicate resources: sort by lastUpdated, keep most recent for resources with same meta tags (except Conditions)
  encounterBundle.sort((a, b) => {
    if (!a || !b) return 0;
    if (!a.meta?.lastUpdated || !b.meta?.lastUpdated) return 0;
    return a.meta.lastUpdated > b.meta.lastUpdated ? -1 : 1;
  });

  encounterBundle = deduplicateTemplateResourcesByMetaTag(encounterBundle);

  // Capture in-house lab orders on the encounter BEFORE the TEMPLATE_TAG_SYSTEMS
  // filter runs. In-house lab ServiceRequests aren't marked with any chart-data
  // meta tag; they're identified by their code system, so the tag-based filter
  // below strips them out. We keep a reference here so we can still convert them
  // into template plans further down.
  const inHouseLabOrders = encounterBundle.filter((resource): resource is ServiceRequest =>
    isValidInHouseLabServiceRequest(resource)
  );

  // Capture in-office procedure ServiceRequests for the same reason as in-house
  // labs: chart-data procedures are identified by their 'procedure' meta tag
  // rather than by being included in TEMPLATE_TAG_SYSTEMS below, so the tag
  // filter would otherwise drop them. delete-chart-data marks procedures as
  // status='entered-in-error' (the chart UI hides them by status); the inclusion
  // list below keeps those out so a saved template doesn't carry forward a
  // procedure the provider had already deleted.
  const procedureOrders = encounterBundle.filter((resource): resource is ServiceRequest =>
    isValidProcedureServiceRequest(resource)
  );

  // Filter to only resources relevant to template sections
  const diagnosesRefFromEncounterSet = new Set(
    oldEncounter.diagnosis?.map((dx) => dx.condition.reference).filter((elm) => elm !== undefined) ?? []
  );
  console.log(
    `these are the diagnoses from encounter set in create, Encounter/${oldEncounter.id}`,
    JSON.stringify([...diagnosesRefFromEncounterSet])
  );

  // Keep only the Encounter and resources tagged as template content. See TEMPLATE_TAG_SYSTEMS for the allow-list.
  // this will not include In House Lab ServiceRequests
  encounterBundle = filterEntriesToTemplateContent(encounterBundle, diagnosesRefFromEncounterSet);

  console.log('Count of resources after filtering to template-relevant:', encounterBundle.length);

  for (const resource of encounterBundle) {
    // Skip the Encounter — we create a stub encounter separately
    if (resource.resourceType === 'Encounter') continue;

    const anonymizedResource: any = { ...resource };
    delete anonymizedResource.meta?.versionId;
    delete anonymizedResource.meta?.lastUpdated;
    delete anonymizedResource.encounter;

    // The stub patient makes the resources that require a subject valid
    anonymizedResource.subject = {
      reference: `#${stubPatient.id}`,
    };

    const newId = uuidV4();
    oldIdToNewIdMap.set(resource.id!, newId);
    anonymizedResource.id = newId;

    listToCreate.contained!.push(anonymizedResource);
    listToCreate.entry!.push({
      item: {
        reference: `#${anonymizedResource.id}`,
      },
    });
  }

  // Materialize each captured in-house lab order as a "plan" ServiceRequest on
  // the template. We don't store the live SR/Task/Procedure/Provenance bundle
  // (that's tightly coupled to the in-house lab feature's current
  // implementation and would rot if it changes); the plan carries just enough
  // information that apply-template can re-run the live create-order flow.
  for (const order of inHouseLabOrders) {
    const planId = uuidV4();
    const plan: ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: planId,
      status: 'active',
      intent: 'plan',
      subject: { reference: `#${stubPatient.id}` },
      // Strip the |version suffix when saving the plan so a global template
      // floats forward to the current ActivityDefinition as new versions are
      // published. apply-template and admin-get-template-detail look up the
      // AD by url (ignoring any version segment) and pick the latest version
      // Note: we fully expect instantiatesCanonical to be defined here
      ...(order.instantiatesCanonical
        ? { instantiatesCanonical: order.instantiatesCanonical.map((ref) => ref.split('|')[0]) }
        : {}),
      ...(order.reasonCode ? { reasonCode: order.reasonCode } : {}), // grabs the Dx coding (not Condition) associated with the test. The Condition is already applied to the Encounter
      ...(order.note ? { note: order.note } : {}),
      meta: {
        tag: [
          {
            system: chartDataTagSystem('in-house-lab-template-plan'),
            code: 'in-house-lab-template-plan',
          },
        ],
      },
    };
    listToCreate.contained!.push(plan);
    listToCreate.entry!.push({
      item: { reference: `#${planId}` },
    });
  }

  // Materialize each captured in-office procedure as a "plan" ServiceRequest on
  // the template.
  // Diagnosis (reasonReference) and CPT (supportingInfo) cross-refs are remapped
  // through the oldIdToNewIdMap so the plan points at the template's contained
  // Conditions / CPT Procedures (which were captured above by the diagnoses
  // and CPT-code sections). At apply time, those refs get rewritten again to
  // the new live resources within a single FHIR transaction.
  const procedurePlanMetaTag = chartDataTagSystem('procedure-template-plan');
  for (const order of procedureOrders) {
    const planId = uuidV4();
    const remapReference = (ref: { reference?: string } | undefined): { reference: string } | null => {
      if (!ref?.reference) return null;
      const [resourceType, oldId] = ref.reference.split('/');
      if (!oldId) return null;
      const newId = oldIdToNewIdMap.get(oldId);
      if (!newId) return null; // referenced resource isn't in the template (filtered out earlier)
      return { reference: `${resourceType}/${newId}` };
    };
    const remappedReasonReferences = (order.reasonReference ?? [])
      .map(remapReference)
      .filter((r): r is { reference: string } => r !== null);
    const remappedSupportingInfo = (order.supportingInfo ?? [])
      .map(remapReference)
      .filter((r): r is { reference: string } => r !== null);

    const plan: ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: planId,
      status: 'active',
      intent: 'plan',
      subject: { reference: `#${stubPatient.id}` },
      ...(order.category ? { category: order.category } : {}),
      ...(order.performerType ? { performerType: order.performerType } : {}),
      ...(order.bodySite ? { bodySite: order.bodySite } : {}),
      ...(order.extension && order.extension.length > 0 ? { extension: order.extension } : {}),
      ...(remappedReasonReferences.length > 0 ? { reasonReference: remappedReasonReferences } : {}),
      ...(remappedSupportingInfo.length > 0 ? { supportingInfo: remappedSupportingInfo } : {}),
      meta: {
        tag: [
          {
            system: procedurePlanMetaTag,
            code: 'procedure-template-plan',
          },
        ],
      },
    };
    listToCreate.contained!.push(plan);
    listToCreate.entry!.push({
      item: { reference: `#${planId}` },
    });
  }

  // Create stub encounter with ICD-10 diagnosis references mapped to new IDs
  const stubEncounter: Encounter = {
    resourceType: 'Encounter',
    id: uuidV4(),
    status: 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'Ambulatory',
    },
    diagnosis: oldEncounter.diagnosis
      ?.map((diagnosis) => {
        if (!diagnosis.condition?.reference) {
          throw new Error('Unexpectedly found no condition reference in diagnosis');
        }
        const mappedId = oldIdToNewIdMap.get(diagnosis.condition.reference.split('/')[1]);
        if (!mappedId) {
          console.warn('Could not map diagnosis condition reference, skipping:', diagnosis.condition.reference);
          return null;
        }
        return {
          ...diagnosis,
          condition: { reference: `Condition/${mappedId}` },
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null),
  };
  listToCreate.contained!.push(stubEncounter);
  listToCreate.entry!.push({
    item: {
      reference: `#${stubEncounter.id}`,
    },
  });

  // Add the new template to the global templates holder list so it's discoverable and create the template itself. No orphaned templates
  console.log('Creating template with', listToCreate.contained!.length, 'contained resources');
  const listToCreateFullUrl = `urn:uuid:${uuidV4()}`;
  const holderList = await findHolderList(oystehr);
  if (!holderList) throw new Error('No global templates holder list found — cannot link template');

  const transactionResponse = await oystehr.fhir.transaction<List>({
    requests: [
      {
        method: 'POST',
        url: '/List',
        resource: listToCreate,
        fullUrl: listToCreateFullUrl,
      },
      {
        method: 'PATCH',
        url: `List/${holderList.id}`,
        operations: [
          {
            op: 'add',
            path: holderList.entry ? '/entry/-' : '/entry',
            value: { item: { reference: listToCreateFullUrl } },
          },
        ],
        ifMatch: makeOptimisticLockIfMatchHeader(holderList),
      },
    ],
  });

  if (!transactionWasSuccessful(transactionResponse)) {
    console.error(`This was failed transactionResponse: `, JSON.stringify(transactionResponse));
    throw new Error('Unable to create template or add it to template holder');
  }

  const createdList = transactionResponse.unbundle().find((list) => list.id !== holderList.id)!;

  console.log('Created template:', createdList.id, createdList.title);
  console.log('Added template to holder list');

  return {
    templateName: createdList.title ?? templateName,
    templateId: createdList.id!,
  };
};

export const filterEntriesToTemplateContent = (
  resources: TemplateEncounterResource[],
  diagnosesRefFromEncounterSet: Set<string>
): TemplateEncounterResource[] => {
  return resources.filter((resource) => {
    if (!resource || resource.resourceType === 'Encounter') return true;

    // Diagnosis Conditions are only included if they are still referenced on Encounter.diagnosis.
    // The _revinclude:iterate search returns ALL Conditions ever linked to the encounter, including
    // ones that were previously removed from Encounter.diagnosis, so we must check the active set.
    if (isDiagnosisCondition(resource)) {
      return diagnosesRefFromEncounterSet.has(`Condition/${resource.id}`);
    }

    // we don't write the repeat tests themselves to the templates, so don't take their cpt codes either
    if (isInHouseLabRepeatTestCptCode(resource)) return false;

    return hasTemplateRelevantTag(resource);
  });
};

// Drops chart-data resources that duplicate a previously-seen meta tag
// (system|code pair). Used at the top of template creation to coalesce
// stale or re-saved chart entries down to the most recent one.
//
// Some chart-data sections legitimately have multiple resources sharing the
// same meta tag - they're list-shaped, with each new entry adding to the
// collection rather than replacing the previous one. Those are exempted:
//
//   - Diagnoses (identified by the 'diagnosis' meta tag, NOT by ICD-10 code:
//     Medical Conditions also carry ICD-10 codes but are patient-specific
//     history, not template content).
//   - CPT codes.
//   - Patient instructions.
//   - In-office procedures (each procedure ServiceRequest carries the same
//     'procedure' meta tag, so without this exemption a chart with N
//     procedures would get coalesced down to one).
//
// Caller is responsible for any other sorting / shaping of the resource list.
export const deduplicateTemplateResourcesByMetaTag = (
  resources: TemplateEncounterResource[]
): TemplateEncounterResource[] => {
  const seenTags = new Set<string>();
  return resources.filter((resource) => {
    if (isDiagnosisCondition(resource)) return true;
    const tags = resource?.meta?.tag?.map((tag) => `${tag.system}|${tag.code}`);
    if (!tags) return true;
    if (
      tags.some(
        (tag) =>
          tag?.includes(chartDataTagSystem('cpt-code')) ||
          tag?.includes(chartDataTagSystem('patient-instruction')) ||
          tag?.includes(chartDataTagSystem('procedure'))
      )
    )
      return true;
    const isDuplicate = tags.some((tag) => seenTags.has(tag!));
    if (!isDuplicate) tags.forEach((tag) => seenTags.add(tag!));
    return !isDuplicate;
  });
};

// Orders the provider canceled or marked as a mistake live on as
// status='revoked' / 'entered-in-error' ServiceRequests on the encounter even
// though they're hidden from the chart UI. Both lab and procedure capture
// predicates apply this allow-list so a saved template doesn't accidentally
// carry deleted entries forward.
const TEMPLATE_INCLUDABLE_SR_STATUSES = new Set<ServiceRequest['status']>(['draft', 'active', 'on-hold', 'completed']);

export const isValidInHouseLabServiceRequest = (resource: TemplateEncounterResource): boolean => {
  if (resource.resourceType !== 'ServiceRequest') return false;
  return (
    !!resource.code?.coding?.some((c) => c.system === IN_HOUSE_TEST_CODE_SYSTEM) &&
    !resourceHasTagSystem(resource, REPEAT_TEST_ORDER_DETAIL_TAG_CONFIG.system) && // we don't want repeat tests included
    !resource.basedOn?.some((basedOn) => basedOn.reference?.startsWith('ServiceRequest/')) && // we don't want reflex tests included either
    resource.instantiatesCanonical?.some((canonical) => canonical.startsWith(AD_CANONICAL_URL_BASE)) === true &&
    TEMPLATE_INCLUDABLE_SR_STATUSES.has((resource as ServiceRequest).status)
  );
};

// Chart-data procedures are stored as ServiceRequest with the 'procedure' meta
// tag (createProcedureServiceRequest in shared/chart-data uses
// fillMeta('procedure', 'procedure')). delete-chart-data patches status to
// 'entered-in-error', and the chart UI hides revoked/entered-in-error
// procedures - we mirror that filtering here so deleted procedures don't leak
// into templates.
export const isValidProcedureServiceRequest = (resource: TemplateEncounterResource): boolean => {
  if (resource.resourceType !== 'ServiceRequest') return false;
  return (
    resourceHasTagSystem(resource, chartDataTagSystem('procedure')) &&
    TEMPLATE_INCLUDABLE_SR_STATUSES.has((resource as ServiceRequest).status)
  );
};
