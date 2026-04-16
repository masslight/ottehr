import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import {
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
} from 'utils';

export function verifyIsTemplate(templateList: List, templateId: string): void {
  const isTemplate = templateList.code?.coding?.some(
    (c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM || c.system === GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM
  );
  if (!isTemplate) {
    throw new Error(`List ${templateId} is not a global template`);
  }
}

export async function findHolderList(oystehr: Oystehr): Promise<List | undefined> {
  const holderLists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: '_tag', value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|` }],
    })
  ).unbundle();

  return holderLists.find((l) => l.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM));
}
