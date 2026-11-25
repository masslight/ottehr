import Oystehr, { FhirResourceReturnValue } from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';

export enum ListName {
  Patient = 'patient',
  EHR = 'ehr',
}

export async function findInsuranceOverrideList(
  oystehr: Oystehr,
  listName: string
): Promise<FhirResourceReturnValue<List> | undefined> {
  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        {
          name: 'identifier',
          value: `${ottehrIdentifierSystem('insurance-override')}|${listName}`,
        },
      ],
    })
  ).unbundle();
  return lists[0] as FhirResourceReturnValue<List> | undefined;
}

export async function getInsuranceOverrideList(
  oystehr: Oystehr,
  listName: string
): Promise<FhirResourceReturnValue<List>> {
  console.group('get insurance override list');
  const existingList = await findInsuranceOverrideList(oystehr, listName);
  if (!existingList) {
    // Create if not found
    console.group('create insurance override list');
    const list = await oystehr.fhir.create<List>({
      resourceType: 'List',
      identifier: [
        {
          system: ottehrIdentifierSystem('insurance-override'),
          value: listName,
        },
      ],
      mode: 'working',
      status: 'current',
    });
    console.groupEnd();
    return list;
  }
  console.groupEnd();
  return existingList;
}
