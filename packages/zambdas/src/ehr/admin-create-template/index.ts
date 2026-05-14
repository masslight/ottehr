import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BundleEntry, Condition, Encounter, List, Patient, ServiceRequest } from 'fhir/r4b';
import {
  AdminCreateTemplateInput,
  AdminCreateTemplateOutput,
  chartDataTagSystem,
  examConfig,
  ExamType,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
  ICD_10_CODE_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { findHolderList } from '../shared/template-helpers';
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
  const { encounterId, templateName, examType } = validatedInput;

  // Fetch encounter with all related clinical resources
  const encounterBundle = await oystehr.fhir.search({
    resourceType: 'Encounter',
    params: [
      { name: '_id', value: encounterId },
      { name: '_revinclude:iterate', value: 'Observation:encounter' },
      { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
      { name: '_revinclude:iterate', value: 'Communication:encounter' },
      { name: '_revinclude:iterate', value: 'Condition:encounter' },
      { name: '_revinclude:iterate', value: 'Procedure:encounter' },
      // Pulled in so in-house lab orders on this encounter can be saved as
      // template plans below.
      { name: '_revinclude:iterate', value: 'ServiceRequest:encounter' },
    ],
  });

  if (!encounterBundle.entry) {
    throw new Error('No entries found in encounter bundle, cannot make a template');
  }

  // Determine code system and version based on exam type
  const codeSystem =
    examType === ExamType.IN_PERSON ? GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM : GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM;
  const examVersion =
    examType === ExamType.IN_PERSON ? examConfig.inPerson.default.version : examConfig.telemed.default.version;
  const displayName = examType === ExamType.IN_PERSON ? 'Global Template In-Person' : 'Global Template Telemed';

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
  encounterBundle.entry.sort((a, b) => {
    if (!a.resource || !b.resource) return 0;
    if (!a.resource.meta?.lastUpdated || !b.resource.meta?.lastUpdated) return 0;
    return a.resource.meta.lastUpdated > b.resource.meta.lastUpdated ? -1 : 1;
  });

  const seenTags = new Set<string>();
  encounterBundle.entry = encounterBundle.entry.filter((entry) => {
    // ICD-10 diagnoses are additive (multiple per encounter), so skip deduplication for them
    if (
      entry.resource?.resourceType === 'Condition' &&
      (entry.resource as Condition).code?.coding?.some((c) => c.system === ICD_10_CODE_SYSTEM)
    ) {
      return true;
    }
    const tags = entry.resource?.meta?.tag?.map((tag) => `${tag.system}|${tag.code}`);
    if (!tags) return true;
    // CPT codes and patient instructions are additive (multiple per encounter), so skip deduplication for them
    if (
      tags.some(
        (tag) =>
          tag?.includes(chartDataTagSystem('cpt-code')) || tag?.includes(chartDataTagSystem('patient-instruction'))
      )
    )
      return true;
    const isDuplicate = tags.some((tag) => seenTags.has(tag!));
    if (!isDuplicate) tags.forEach((tag) => seenTags.add(tag!));
    return !isDuplicate;
  });

  // Capture in-house lab orders on the encounter BEFORE the TEMPLATE_TAG_SYSTEMS
  // filter runs. In-house lab ServiceRequests aren't marked with any chart-data
  // meta tag; they're identified by their code system, so the tag-based filter
  // below strips them out. We keep a reference here so we can still convert them
  // into template plans further down.
  const inHouseLabOrders = (encounterBundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter(
      (resource): resource is ServiceRequest =>
        resource?.resourceType === 'ServiceRequest' &&
        (resource as ServiceRequest).code?.coding?.some((c) => c.system === IN_HOUSE_TEST_CODE_SYSTEM) === true
    );

  // Filter to only resources relevant to template sections
  const TEMPLATE_TAG_SYSTEMS = new Set([
    chartDataTagSystem('chief-complaint'),
    chartDataTagSystem('mechanism-of-injury'),
    chartDataTagSystem('ros'), // legacy
    chartDataTagSystem('exam-observation-field'),
    chartDataTagSystem('ros-observation-field'),
    chartDataTagSystem('medical-decision'),
    chartDataTagSystem('patient-instruction'),
    chartDataTagSystem('cpt-code'),
    chartDataTagSystem('em-code'),
  ]);

  encounterBundle.entry = encounterBundle.entry.filter((entry) => {
    if (!entry.resource || entry.resource.resourceType === 'Encounter') return true;
    // Keep ICD-10 Conditions (Assessment / Diagnoses)
    if (
      entry.resource.resourceType === 'Condition' &&
      (entry.resource as Condition).code?.coding?.some((c) => c.system === ICD_10_CODE_SYSTEM)
    ) {
      return true;
    }
    // Keep resources with a template-relevant meta tag
    return entry.resource.meta?.tag?.some((tag) => tag.system && TEMPLATE_TAG_SYSTEMS.has(tag.system));
  });

  console.log('Count of resources after filtering to template-relevant:', encounterBundle.entry.length);

  for (const entry of encounterBundle.entry) {
    if (!entry.resource) continue;
    // Skip the Encounter — we create a stub encounter separately
    if (entry.resource.resourceType === 'Encounter') continue;

    const anonymizedResource: any = { ...entry.resource };
    delete anonymizedResource.meta?.versionId;
    delete anonymizedResource.meta?.lastUpdated;
    delete anonymizedResource.encounter;

    // The stub patient makes the resources that require a subject valid
    anonymizedResource.subject = {
      reference: `#${stubPatient.id}`,
    };

    const newId = uuidV4();
    oldIdToNewIdMap.set(entry.resource.id!, newId);
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
      code: order.code,
      ...(order.instantiatesCanonical ? { instantiatesCanonical: order.instantiatesCanonical } : {}),
      ...(order.reasonCode ? { reasonCode: order.reasonCode } : {}),
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

  // Create stub encounter with ICD-10 diagnosis references mapped to new IDs
  const oldEncounter = encounterBundle.entry.find(
    (entry) => entry.resource?.resourceType === 'Encounter'
  ) as BundleEntry<Encounter>;
  if (!oldEncounter) {
    throw new Error('Unexpectedly found no Encounter when preparing template');
  }

  const stubEncounter: Encounter = {
    resourceType: 'Encounter',
    id: uuidV4(),
    status: 'unknown',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'Ambulatory',
    },
    diagnosis: oldEncounter.resource?.diagnosis
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

  console.log('Creating template with', listToCreate.contained!.length, 'contained resources');

  const createdList = await oystehr.fhir.create<List>(listToCreate);

  console.log('Created template:', createdList.id, createdList.title);

  // Add the new template to the global templates holder list so it's discoverable
  const holderList = await findHolderList(oystehr);

  if (holderList) {
    const updatedEntries = [...(holderList.entry ?? []), { item: { reference: `List/${createdList.id}` } }];
    await oystehr.fhir.update<List>(
      {
        ...holderList,
        entry: updatedEntries,
      },
      { optimisticLockingVersionId: holderList.meta?.versionId }
    );
    console.log('Added template to holder list');
  } else {
    throw new Error('No global templates holder list found — cannot link template');
  }

  return {
    templateName: createdList.title ?? templateName,
    templateId: createdList.id!,
  };
};
