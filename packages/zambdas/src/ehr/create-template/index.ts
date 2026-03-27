import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { BundleEntry, Encounter, List, Patient } from 'fhir/r4b';
import {
  CreateTemplateInputSchema,
  CreateTemplateInputValidated,
  CreateTemplateOutput,
  examConfig,
  ExamType,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { ZodError } from 'zod';
import { checkOrCreateM2MClientToken, formatZodError, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';

let m2mToken: string;

export const index = wrapHandler('create-template', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedInput = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedInput));

    const { secrets } = validatedInput;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    const result = await performEffect(validatedInput, oystehr);
    console.groupEnd();
    console.debug('performEffect success', JSON.stringify(result));

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-template', error, ENVIRONMENT);
  }
});

const validateRequestParameters = (input: ZambdaInput): CreateTemplateInputValidated => {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body.');
  }

  try {
    const validatedCore = CreateTemplateInputSchema.parse(parsed);

    return {
      ...validatedCore,
      secrets: input.secrets,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(`Invalid request parameters: ${formatZodError(err)}`);
    }
    throw err;
  }
};

const performEffect = async (
  validatedInput: CreateTemplateInputValidated,
  oystehr: Oystehr
): Promise<CreateTemplateOutput> => {
  const { encounterId, templateName, examType } = validatedInput;

  const [encounterBundle, holderListBundle] = await Promise.all([
    // Fetch encounter with all related clinical resources
    oystehr.fhir.search({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_revinclude:iterate',
          value: 'Condition:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'Procedure:encounter',
        },
      ],
    }),
    // Find the holder list
    oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        {
          name: '_tag',
          value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|`,
        },
      ],
    }),
  ]);

  if (!encounterBundle.entry) {
    throw new Error('No entries found in encounter bundle, cannot make a template');
  }

  // Determine code system and version based on exam type
  const codeSystem =
    examType === ExamType.IN_PERSON ? GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM : GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM;
  const examVersion =
    examType === ExamType.IN_PERSON ? examConfig.inPerson.default.version : examConfig.telemed.default.version;

  // Build List resource
  const listToCreate: List = {
    resourceType: 'List',
    code: {
      coding: [
        {
          system: codeSystem,
          code: 'default',
          version: examVersion,
          display: examType === ExamType.IN_PERSON ? 'Global Template In-Person' : 'Global Template Telemed',
        },
      ],
    },
    status: 'current',
    mode: 'working',
    title: templateName,
    entry: [],
    contained: [],
  };

  // Create stub patient for FHIR validity
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

  // Sort by lastUpdated so we keep the most recent resource per tag
  encounterBundle.entry.sort((a, b) => {
    if (!a.resource || !b.resource) return 0;
    if (!a.resource.meta?.lastUpdated || !b.resource.meta?.lastUpdated) return 0;
    return a.resource.meta.lastUpdated > b.resource.meta.lastUpdated ? 1 : -1;
  });

  // Deduplicate: keep only the most recent resource per unique meta tag,
  // except Conditions which are all preserved (multiple ICD-10 diagnoses)
  const seenTags = new Set<string>();
  encounterBundle.entry = encounterBundle.entry.filter((entry) => {
    if (entry.resource?.resourceType === 'Condition') return true;
    const tags = entry.resource?.meta?.tag?.map((tag) => `${tag.system}|${tag.code}`);
    if (!tags) return true;
    const isDuplicate = tags.some((tag) => seenTags.has(tag!));
    if (!isDuplicate) tags.forEach((tag) => seenTags.add(tag!));
    return !isDuplicate;
  });

  // Process each resource into contained
  for (const entry of encounterBundle.entry) {
    if (!entry.resource) continue;
    if (entry.resource.resourceType === 'Encounter') continue;

    // We use any so we can scrub relevant fields from various types of resources.
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

  // Create stub encounter with remapped diagnosis references
  const oldEncounter = encounterBundle.entry.find(
    (entry) => entry.resource?.resourceType === 'Encounter'
  ) as BundleEntry<Encounter>;
  if (!oldEncounter?.resource) {
    throw new Error('Unexpectedly found no Encounter when preparing template');
  }
  // Write stub encounter with ICD-10 code Conditions leveraging oldIdToNewIdMap
  const stubEncounter: Encounter = {
    resourceType: 'Encounter',
    id: uuidV4(),
    // Stub will be replaced when template is applied.
    status: 'unknown',
    class: {
      // Stub will be replaced when template is applied.
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'Ambulatory',
    },
    diagnosis: oldEncounter.resource?.diagnosis?.map((diagnosis) => {
      if (!diagnosis.condition?.reference) {
        throw new Error('Unexpectedly found no condition reference in diagnosis');
      }
      // We keep this information when the template is applied. This is why we make the encounter stub.
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

  // Find the holder list
  const holderLists = holderListBundle.unbundle();
  if (!holderLists || holderLists.length !== 1) {
    throw new Error('Unexpectedly found no holder list or multiple holder lists');
  }
  const holderList = holderLists[0];
  if (!holderList?.id) {
    throw new Error('Could not find global template holder list');
  }

  // Create the template List resource
  const createdList = await oystehr.fhir.create<List>(listToCreate);
  if (!createdList.id) {
    throw new Error('Failed to create template List resource');
  }

  // Add the new template to the holder list
  await oystehr.fhir.patch({
    resourceType: 'List',
    id: holderList.id,
    operations: [
      {
        op: 'add',
        path: '/entry/-',
        value: {
          item: {
            reference: `List/${createdList.id}`,
          },
        },
      },
    ],
  });

  console.log(`Created template '${templateName}' with id ${createdList.id}`);

  return { templateId: createdList.id };
};
