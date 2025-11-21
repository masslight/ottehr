import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import globalTemplates from '../../../../config/oystehr/global-templates.json';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

const recreateGlobalTemplates = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  const oldTemplates = await getTemplates(oystehr);
  console.log('found the templates, count: ', oldTemplates.length);
  const oldGlobalTemplatesHolder = await getGlobalTemplateHolder(oystehr);
  console.log('found the global templates holder?: ', oldGlobalTemplatesHolder?.id);

  console.log('\n--------- Deleting old templates ---------\n');

  for (const resource of oldTemplates) {
    console.log(`Deleted FHIR Template: ${resource.title}, with id: ${resource.id}`);
    try {
      await oystehr.fhir.delete({ resourceType: 'List', id: resource.id! });
    } catch (error) {
      console.error(`Failed to delete FHIR Template: ${resource.title}, with id: ${resource.id}`, error);
    }
  }

  console.log('\n--------- Deleting old global templates holder ---------\n');

  if (oldGlobalTemplatesHolder) {
    console.log(
      `Deleted FHIR Global Template Holder: ${oldGlobalTemplatesHolder.title}, with id: ${oldGlobalTemplatesHolder.id}`
    );
    await oystehr.fhir.delete({ resourceType: 'List', id: oldGlobalTemplatesHolder.id! });
  }

  // Now managed by IaC

  // console.log('\n--------- Creating new templates ---------\n');

  // const globalTemplatesAny = globalTemplates as any; // For some reason the json typing is not working but i can deal

  // const newTemplateIds = [];
  // for (const templateJSON of Object.values(globalTemplatesAny.fhirResources)) {
  //   const resource = (templateJSON as any).resource as List;
  //   if (resource.title === undefined) {
  //     console.log('Skipping template with undefined title: ', JSON.stringify(templateJSON, null, 2));
  //     continue;
  //   }
  //   const newTemplate = await oystehr.fhir.create(resource);
  //   console.log(`Created FHIR Template: ${newTemplate.title}, with id: ${newTemplate.id}`);
  //   newTemplateIds.push(newTemplate.id!);
  // }

  // console.log('\n--------- Creating new global template holder ---------\n');

  // const newGlobalTemplateResource = globalTemplateHolderJSON.fhirResources.GlobalTemplatesHolderList.resource;
  // newGlobalTemplateResource.entry = newTemplateIds.map((id: string) => ({ item: { reference: `List/${id}` } }));
  // const globalTemplateHolder = await oystehr.fhir.create(newGlobalTemplateResource as List);
  // console.log('All done! global template holder for validation, ', JSON.stringify(globalTemplateHolder, null, 2));
};

const getTemplates = async (oystehr: Oystehr): Promise<List[]> => {
  const globalTemplatesAny = globalTemplates as any; // For some reason the json typing is not working but i can deal
  const titles = Object.values(globalTemplatesAny.fhirResources)
    .map((listResource: any) => {
      // We know they are List resources
      return listResource.resource.title;
    })
    .filter((title) => {
      return title !== undefined;
    });

  const templates: List[] = [];
  for (const title of titles) {
    console.time('searching for template ' + title);
    // Escape commas in title
    const titleEncoded = title.replace(',', '\\,');
    console.log('template name commas encoded: ', titleEncoded);
    const results = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'title:exact', value: titleEncoded }],
      })
    ).unbundle();
    if (results.length > 0) {
      templates.push(...results);
      console.log(
        'found templates with title: ',
        title,
        ' id: ',
        results.map((r) => r.id)
      );
    } else {
      console.log('Did not find template with title: ', title);
    }
    console.timeEnd('searching for template ' + title);
  }

  return templates;
};

const getGlobalTemplateHolder = async (oystehr: Oystehr): Promise<List> => {
  return (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        {
          name: '_tag',
          value: 'https://fhir.zapehr.com/r4/StructureDefinitions/global-template-list|global-templates',
        },
      ],
    })
  ).unbundle()[0];
};

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(recreateGlobalTemplates);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
