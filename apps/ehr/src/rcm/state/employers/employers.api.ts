import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { chooseJson } from 'utils';

export const CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM =
  'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id';

const CREATE_EMPLOYER_ZAMBDA_ID = 'create-employer';
const LIST_EMPLOYERS_ZAMBDA_ID = 'list-employers';
const UPDATE_EMPLOYER_ZAMBDA_ID = 'update-employer';
const ACTIVATE_EMPLOYER_ZAMBDA_ID = 'activate-employer';
const DEACTIVATE_EMPLOYER_ZAMBDA_ID = 'deactivate-employer';

export interface EmployerAddressInput {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  zipPlus4?: string;
  country?: string;
}

export interface EmployerContactInput {
  phone?: string;
  fax?: string;
  email?: string;
  notes?: string;
}

export interface EmployerIdentifierInput {
  system?: string;
  value: string;
}

export interface CreateEmployerInput {
  name: string;
  active?: boolean;
  category?: string;
  identifier?: EmployerIdentifierInput;
  address?: EmployerAddressInput;
  contact?: EmployerContactInput;
}

export interface UpdateEmployerInput {
  employerId: string;
  name?: string;
  active?: boolean;
  category?: string;
  identifier?: EmployerIdentifierInput;
  address?: EmployerAddressInput;
  contact?: EmployerContactInput;
}

export interface EmployerStatusInput {
  employerId: string;
}

export const createEmployer = async (oystehr: Oystehr, parameters: CreateEmployerInput): Promise<Organization> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CREATE_EMPLOYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listEmployers = async (oystehr: Oystehr): Promise<Organization[]> => {
  try {
    const response = await oystehr.zambda.execute({
      id: LIST_EMPLOYERS_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateEmployer = async (oystehr: Oystehr, parameters: UpdateEmployerInput): Promise<Organization> => {
  try {
    const response = await oystehr.zambda.execute({
      id: UPDATE_EMPLOYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const activateEmployer = async (oystehr: Oystehr, parameters: EmployerStatusInput): Promise<Organization> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ACTIVATE_EMPLOYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deactivateEmployer = async (oystehr: Oystehr, parameters: EmployerStatusInput): Promise<Organization> => {
  try {
    const response = await oystehr.zambda.execute({
      id: DEACTIVATE_EMPLOYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
