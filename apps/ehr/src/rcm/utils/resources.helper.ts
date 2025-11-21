import Oystehr from '@oystehr/sdk';
import { Coverage, DomainResource, FhirResource, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { NameInformation, PersonInformation } from './form-values.types';

export const mapGenderToLabel: { [name in Exclude<Patient['gender'], undefined>]: string } = {
  male: 'Male',
  female: 'Female',
  other: 'Intersex',
  unknown: 'Unknown',
};

export const genderOptions = Object.keys(mapGenderToLabel)
  .filter((gender) => gender !== 'unknown')
  .map((gender) => ({ label: mapGenderToLabel[gender as Exclude<Patient['gender'], undefined>], value: gender }));

export const RELATIONSHIP_TO_INSURED = ['Child', 'Parent', 'Spouse', 'Other', 'Self'];

export const DIAGNOSES_SEQUENCE_LETTER = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.'];

export const findResourceByType = <Type extends FhirResource>(data: FhirResource[], type: string): Type | undefined => {
  return data.find((resource: FhirResource): resource is Type => resource.resourceType === type);
};

export const findResourceByTypeAndId = <Type>(data: FhirResource[], type?: string, id?: string): Type | undefined => {
  if (!type || !id) {
    return;
  }
  return data.find((resource: FhirResource) => resource.resourceType === type && resource.id === id) as unknown as
    | Type
    | undefined;
};

export const filterResourcesByType = <Type>(data: FhirResource[], type: string): Type[] => {
  return data.filter((resource: FhirResource) => resource.resourceType === type) as unknown as Type[];
};

export const getDateFromFormat = (value?: string, format?: string): DateTime | undefined => {
  if (!value) {
    return;
  }
  return DateTime.fromFormat(value, format || 'yyyy-MM-dd');
};

export const getDateFromISO = (value?: string): DateTime | undefined => {
  if (!value) {
    return;
  }
  return DateTime.fromISO(value);
};

export const generateOpByResourceData = <A extends DomainResource>(
  newData: A,
  currentData: A,
  field: keyof A
): 'remove' | 'add' | 'replace' => {
  if (newData[field] === undefined && currentData[field] !== undefined) {
    return 'remove';
  }
  if (newData[field] !== undefined && currentData[field] === undefined) {
    return 'add';
  }
  return 'replace';
};

export const getCoverageRelatedResources = async (
  oystehr: Oystehr,
  coverageReference?: string
): Promise<(Coverage | Patient | RelatedPerson)[]> => {
  if (!coverageReference) {
    return [];
  }

  const resources: (Coverage | Patient | RelatedPerson)[] = [];

  const coverageResource = (
    await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: '_id', value: coverageReference.split('/')[1] }],
    })
  ).unbundle();

  const coverage = findResourceByType<Coverage>(coverageResource, 'Coverage');

  resources.push(...coverageResource);

  const subscriberReference = coverage?.subscriber?.reference;
  if (subscriberReference) {
    const subscriberResource = (
      await oystehr.fhir.search<Patient | RelatedPerson>({
        resourceType: subscriberReference.split('/')[0] as 'Patient' | 'RelatedPerson',
        params: [{ name: '_id', value: subscriberReference.split('/')[1] }],
      })
    ).unbundle();

    resources.push(...subscriberResource);
  }

  return resources;
};

export const mapPersonInformationToResource = (
  person: Patient | RelatedPerson,
  information: PersonInformation
): void => {
  if (information.dob) {
    person.birthDate = information.dob.toFormat('yyyy-MM-dd');
  } else {
    person.birthDate = undefined;
  }

  if (information.sex) {
    person.gender = information.sex as Patient['gender'];
  } else {
    person.gender = undefined;
  }

  mapPersonNameToResource(person, information);

  const city = information.city.trim();
  const address = information.address.trim();
  const state = information.state;
  const zip = information.zip.trim();

  if (!city && !address && !state && !zip) {
    person.address = undefined;
  } else {
    if (!person.address || person.address.length === 0) {
      person.address = [{}];
    }
    if (!person.address[0].line || person.address[0].line.length === 0) {
      person.address[0].line = [];
    }

    if (city) {
      person.address[0].city = city;
    } else {
      person.address[0].city = undefined;
    }

    if (address) {
      person.address[0].line[0] = address;
    } else {
      person.address[0].line = undefined;
    }

    if (state) {
      person.address[0].state = state;
    } else {
      person.address[0].state = undefined;
    }

    if (zip) {
      person.address[0].postalCode = zip;
    } else {
      person.address[0].postalCode = undefined;
    }
  }

  const phone = information.phone;
  if (phone) {
    if (!person.telecom?.find((item) => item.system === 'phone')) {
      person.telecom = [...(person.telecom || []), { system: 'phone', value: phone }];
    } else {
      person.telecom = person.telecom.map((item) =>
        item.system === 'phone' ? { system: 'phone', value: phone } : item
      );
    }
  } else {
    person.telecom = person.telecom?.filter((item) => item.system !== 'phone');
  }
};

export const mapPersonNameToResource = (person: Patient | RelatedPerson, information: NameInformation): void => {
  const lastName = information.lastName.trim();
  const firstName = information.firstName.trim();
  const middleName = information.middleName.trim();

  if (!lastName && !firstName && !middleName) {
    person.name = undefined;
  } else {
    if (!person.name || person.name.length === 0) {
      person.name = [{}];
    }
    if (!person.name[0].given || person.name[0].given.length === 0) {
      person.name[0].given = [];
    }

    if (lastName) {
      person.name[0].family = lastName;
    } else {
      person.name[0].family = undefined;
    }

    if (!information.middleName && !information.lastName) {
      person.name[0].given = undefined;
    } else {
      if (firstName) {
        person.name[0].given[0] = firstName;
      }

      if (middleName) {
        person.name[0].given[1] = middleName;
      } else {
        person.name[0].given.splice(1, 1);
      }
    }
  }
};
