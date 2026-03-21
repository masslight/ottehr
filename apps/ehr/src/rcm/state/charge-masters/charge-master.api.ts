import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import { ChargeMasterDesignation, chooseJson } from 'utils';

const CREATE_CHARGE_MASTER_ZAMBDA_ID = 'create-charge-master';
const UPDATE_CHARGE_MASTER_ZAMBDA_ID = 'update-charge-master';
const LIST_CHARGE_MASTERS_ZAMBDA_ID = 'list-charge-masters';
const DESIGNATE_CHARGE_MASTER_ENTRY_ZAMBDA_ID = 'designate-charge-master-entry';
const GET_CHARGE_MASTER_ENTRY_ZAMBDA_ID = 'get-charge-master-entry';
const CM_ASSOCIATE_PAYER_ZAMBDA_ID = 'cm-associate-payer';
const CM_DISASSOCIATE_PAYER_ZAMBDA_ID = 'cm-disassociate-payer';
const CM_ADD_PROCEDURE_CODE_ZAMBDA_ID = 'cm-add-procedure-code';
const CM_UPDATE_PROCEDURE_CODE_ZAMBDA_ID = 'cm-update-procedure-code';
const CM_DELETE_PROCEDURE_CODE_ZAMBDA_ID = 'cm-delete-procedure-code';
const CM_BULK_ADD_PROCEDURE_CODES_ZAMBDA_ID = 'cm-bulk-add-procedure-codes';

export interface CreateChargeMasterInput {
  name: string;
  effectiveDate: string;
  description: string;
}

export interface UpdateChargeMasterInput extends CreateChargeMasterInput {
  id: string;
  status?: 'active' | 'retired';
}

export const createChargeMaster = async (oystehr: Oystehr, parameters: CreateChargeMasterInput): Promise<any> => {
  try {
    if (CREATE_CHARGE_MASTER_ZAMBDA_ID == null) {
      throw new Error('create charge master zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_CHARGE_MASTER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listChargeMasters = async (oystehr: Oystehr): Promise<ChargeItemDefinition[]> => {
  try {
    if (LIST_CHARGE_MASTERS_ZAMBDA_ID == null) {
      throw new Error('list charge masters zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: LIST_CHARGE_MASTERS_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateChargeMaster = async (
  oystehr: Oystehr,
  parameters: UpdateChargeMasterInput
): Promise<ChargeItemDefinition> => {
  try {
    if (UPDATE_CHARGE_MASTER_ZAMBDA_ID == null) {
      throw new Error('update charge master zambda environment variable could not be loaded');
    }
    const { id: chargeMasterId, ...rest } = parameters;
    const response = await oystehr.zambda.execute({
      id: UPDATE_CHARGE_MASTER_ZAMBDA_ID,
      chargeMasterId,
      ...rest,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface DesignateChargeMasterEntryInput {
  chargeMasterId: string;
  designation: ChargeMasterDesignation;
}

export const designateChargeMasterEntry = async (
  oystehr: Oystehr,
  parameters: DesignateChargeMasterEntryInput
): Promise<ChargeItemDefinition> => {
  try {
    if (DESIGNATE_CHARGE_MASTER_ENTRY_ZAMBDA_ID == null) {
      throw new Error('designate charge master entry zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DESIGNATE_CHARGE_MASTER_ENTRY_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface GetChargeMasterEntryInput {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
}

export interface GetChargeMasterEntryResponse {
  chargeMaster: ChargeItemDefinition | null;
  source: 'payer' | 'chargemaster' | null;
}

export const getChargeMasterEntry = async (
  oystehr: Oystehr,
  parameters: GetChargeMasterEntryInput
): Promise<GetChargeMasterEntryResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GET_CHARGE_MASTER_ENTRY_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface CmAssociatePayerInput {
  chargeMasterId: string;
  organizationId: string;
}

export const cmAssociatePayer = async (
  oystehr: Oystehr,
  parameters: CmAssociatePayerInput
): Promise<ChargeItemDefinition> => {
  try {
    if (CM_ASSOCIATE_PAYER_ZAMBDA_ID == null) {
      throw new Error('cm associate payer zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CM_ASSOCIATE_PAYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cmDisassociatePayer = async (
  oystehr: Oystehr,
  parameters: CmAssociatePayerInput
): Promise<ChargeItemDefinition> => {
  try {
    if (CM_DISASSOCIATE_PAYER_ZAMBDA_ID == null) {
      throw new Error('cm disassociate payer zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CM_DISASSOCIATE_PAYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface CmAddProcedureCodeInput {
  chargeMasterId: string;
  code: string;
  description?: string;
  modifier?: string;
  amount: number;
}

export interface CmUpdateProcedureCodeInput extends CmAddProcedureCodeInput {
  index: number;
}

export interface CmDeleteProcedureCodeInput {
  chargeMasterId: string;
  index: number;
}

export interface CmBulkAddProcedureCodesInput {
  chargeMasterId: string;
  codes: { code: string; modifier?: string; amount: number }[];
}

export const cmAddProcedureCode = async (
  oystehr: Oystehr,
  parameters: CmAddProcedureCodeInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CM_ADD_PROCEDURE_CODE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cmUpdateProcedureCode = async (
  oystehr: Oystehr,
  parameters: CmUpdateProcedureCodeInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CM_UPDATE_PROCEDURE_CODE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cmDeleteProcedureCode = async (
  oystehr: Oystehr,
  parameters: CmDeleteProcedureCodeInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CM_DELETE_PROCEDURE_CODE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const cmBulkAddProcedureCodes = async (
  oystehr: Oystehr,
  parameters: CmBulkAddProcedureCodesInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: CM_BULK_ADD_PROCEDURE_CODES_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
