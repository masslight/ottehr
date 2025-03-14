import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Address, HumanName, Patient, RelatedPerson } from 'fhir/r4b';
import { createFhirHumanName, ELIGIBILITY_RELATED_PERSON_META_TAG, GetEligibilityPolicyHolder } from 'utils';

const getGender = (sex: string | undefined): 'male' | 'female' | 'unknown' | 'other' => {
  if (sex != undefined) {
    switch (sex.toLowerCase()) {
      case 'male':
        return 'male';
      case 'female':
        return 'female';
      case 'unknown':
        return 'unknown';
      default:
        return 'other';
    }
  }
  return 'unknown';
};

export type CreateRelatedPersonObject = Omit<GetEligibilityPolicyHolder, 'isPatient'>;

interface CreateOrUpdateRelatedPersonParameters {
  oystehr: Oystehr;
  patient: Patient;
  relatedPersonData: CreateRelatedPersonObject;
  relatedPerson?: RelatedPerson;
  eligibility?: boolean;
  primary?: boolean;
}
export const createOrUpdateRelatedPerson = async ({
  oystehr,
  patient,
  relatedPersonData,
  relatedPerson,
  eligibility,
  primary,
}: CreateOrUpdateRelatedPersonParameters): Promise<RelatedPerson> => {
  let newRelatedPerson: RelatedPerson;
  if (!relatedPerson) {
    console.log('Creating a RelatedPerson.');
    newRelatedPerson = await createRelatedPerson(
      patient,
      relatedPersonData,
      oystehr,
      eligibility ? (primary ? 1 : 2) : undefined
    );
  } else {
    console.log('Updating the RelatedPerson.');
    newRelatedPerson = await updateRelatedPerson(relatedPerson, relatedPersonData, oystehr);
  }
  return newRelatedPerson;
};

const createRelatedPerson = async (
  patient: Patient,
  data: CreateRelatedPersonObject,
  oystehr: Oystehr,
  eligibility?: number
): Promise<RelatedPerson> => {
  let code = '';
  switch (data.relationship) {
    case 'Father':
      code = 'FTH';
      break;
    case 'Mother':
      code = 'MTH';
      break;
    case 'Parent':
      code = 'PRN';
      break;
    case 'Spouse':
      code = 'SPS';
      break;
    case 'Sibling':
      code = 'SIB';
      break;
    case 'Other':
      code = 'O';
      break;
    default:
      code = 'CHILD';
      break;
  }

  const address: Address[] = [
    {
      line: data.address ? [data.address] : [],
      city: data.city,
      state: data.state,
      postalCode: data.zip,
      country: 'US',
    },
  ];

  const relatedPerson = await oystehr.fhir.create<RelatedPerson>({
    resourceType: 'RelatedPerson',
    patient: { reference: `Patient/${patient.id}` },
    name: createFhirHumanName(data.firstName, data.middleName, data.lastName),
    birthDate: data.dob,
    gender: getGender(data.sex),
    address,
    relationship: [
      {
        coding: [
          {
            code,
            display: data.relationship ? data.relationship : 'Child',
            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
          },
        ],
      },
    ],
    meta: eligibility
      ? {
          tag: [
            {
              code: `${ELIGIBILITY_RELATED_PERSON_META_TAG}_${eligibility}`,
            },
          ],
        }
      : undefined,
  });
  return relatedPerson;
};

const createPatchOperation = (
  path: string,
  value: string | string[] | HumanName[] | undefined,
  existing: string | string[] | undefined
): Operation | undefined => {
  if (value != null) {
    if (existing != null) {
      // Replace
      return {
        op: 'replace',
        path,
        value,
      };
    } else {
      // Add
      return {
        op: 'add',
        path,
        value,
      };
    }
  } else {
    if (existing != null) {
      // Remove
      return {
        op: 'remove',
        path,
      };
    } else {
      // Leave it
      return undefined;
    }
  }
};

const updateRelatedPerson = async (
  relatedPerson: RelatedPerson,
  data: CreateRelatedPersonObject,
  oystehr: Oystehr
): Promise<RelatedPerson> => {
  if (relatedPerson.id == null) {
    throw new Error("RelatedPerson can't be missing an ID.");
  }
  const gender = getGender(data.sex);

  const operations: Operation[] = [];
  const existingDetails = {
    givenNames: relatedPerson.name?.[0].given,
    lastName: relatedPerson.name?.[0].family,
    dob: relatedPerson.birthDate,
    gender: relatedPerson.gender,
    address: relatedPerson.address?.[0].line?.[0],
    city: relatedPerson.address?.[0].city,
    state: relatedPerson.address?.[0].state,
    zip: relatedPerson.address?.[0].postalCode,
  };

  const nameOp = createPatchOperation(
    '/name',
    createFhirHumanName(data.firstName, data.middleName, data.lastName),
    existingDetails.givenNames || existingDetails.lastName
  );
  if (nameOp) operations.push(nameOp);
  if (data.dob !== existingDetails.dob) {
    const operation = createPatchOperation('/birthDate', data.dob, existingDetails.dob);
    if (operation) operations.push(operation);
  }
  if (gender !== existingDetails.gender) {
    const operation = createPatchOperation('/gender', gender, existingDetails.gender);
    if (operation) operations.push(operation);
  }
  if (data.address !== existingDetails.address) {
    const operation = createPatchOperation(
      '/address/0/line',
      data.address ? [data.address] : [],
      existingDetails.address
    );
    if (operation) operations.push(operation);
  }
  if (data.city !== existingDetails.city) {
    const operation = createPatchOperation('/address/0/city', data.city, existingDetails.city);
    if (operation) operations.push(operation);
  }
  if (data.state !== existingDetails.state) {
    const operation = createPatchOperation('/address/0/state', data.state, existingDetails.state);
    if (operation) operations.push(operation);
  }
  if (data.zip !== existingDetails.zip) {
    const operation = createPatchOperation('/address/0/postalCode', data.zip, existingDetails.zip);
    if (operation) operations.push(operation);
  }

  let codingIndex = -1;
  const relationshipIndex =
    relatedPerson.relationship?.findIndex((relationship) => {
      const index = relationship.coding?.findIndex(
        (coding) => coding.system === 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype'
      );
      if (index != null && index >= 0) {
        codingIndex = index;
        return true;
      }
      return false;
    }) ?? -1;
  const relationshipIndexToUse = relationshipIndex > -1 ? relationshipIndex : 0;
  const codingIndexToUse = codingIndex > -1 ? codingIndex : 0;
  if (data.relationship !== relatedPerson.relationship?.[relationshipIndexToUse].coding?.[codingIndexToUse].display) {
    let code = '';
    switch (data.relationship) {
      case 'Father':
        code = 'FTH';
        break;
      case 'Mother':
        code = 'MTH';
        break;
      case 'Parent':
        code = 'PRN';
        break;
      case 'Spouse':
        code = 'SPS';
        break;
      case 'Sibling':
        code = 'SIB';
        break;
      case 'Other':
        code = 'O';
        break;
      default:
        code = 'CHILD';
        break;
    }
    let display = 'Child';
    if (data.relationship) display = data.relationship;

    // Upsert if existing
    const path = `/relationship/${relationshipIndexToUse}/coding/${codingIndexToUse}`;
    operations.push({
      op: 'add',
      path: `${path}/code`,
      value: code,
    });
    operations.push({
      op: 'add',
      path: `${path}/display`,
      value: display,
    });
  }

  if (operations.length === 0) return relatedPerson;

  console.log('Updating RelatedPerson with:', operations);
  const updatedRelatedPerson = await oystehr.fhir.patch<RelatedPerson>({
    resourceType: 'RelatedPerson',
    id: relatedPerson.id,
    operations,
  });
  return updatedRelatedPerson;
};
