import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BundleEntry, Encounter, List, Patient } from 'fhir/r4b';
import {
  examConfig,
  ExamType,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { AdminCreateTemplateInput, validateRequestParameters } from './validateRequestParameters';

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
): Promise<{ templateName: string; templateId: string }> => {
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
    meta: {
      tag: [
        {
          system: GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
        },
      ],
    },
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
    return a.resource.meta.lastUpdated > b.resource.meta.lastUpdated ? 1 : -1;
  });

  const seenTags = new Set<string>();
  encounterBundle.entry = encounterBundle.entry.filter((entry) => {
    if (entry.resource?.resourceType === 'Condition') return true;
    const tags = entry.resource?.meta?.tag?.map((tag) => `${tag.system}|${tag.code}`);
    if (!tags) return true;
    const isDuplicate = tags.some((tag) => seenTags.has(tag!));
    if (!isDuplicate) tags.forEach((tag) => seenTags.add(tag!));
    return !isDuplicate;
  });

  console.log('Count of resources after deduplication:', encounterBundle.entry.length);

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
    diagnosis: oldEncounter.resource?.diagnosis?.map((diagnosis) => {
      if (!diagnosis.condition?.reference) {
        throw new Error('Unexpectedly found no condition reference in diagnosis');
      }
      return {
        ...diagnosis,
        condition: {
          reference: `Condition/${oldIdToNewIdMap.get(diagnosis.condition.reference.split('/')[1])}`,
        },
      };
    }),
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

  return {
    templateName: createdList.title ?? templateName,
    templateId: createdList.id!,
  };
};
