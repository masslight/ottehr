import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import { ChargeMasterDesignation, chooseJson } from 'utils';

const CREATE_FEE_SCHEDULE_ZAMBDA_ID = 'create-fee-schedule';
const UPDATE_FEE_SCHEDULE_ZAMBDA_ID = 'update-fee-schedule';
const LIST_FEE_SCHEDULES_ZAMBDA_ID = 'list-fee-schedules';
const DESIGNATE_CHARGE_MASTER_ZAMBDA_ID = 'designate-charge-master';
const GET_CHARGE_MASTER_ZAMBDA_ID = 'get-charge-master';
const ASSOCIATE_PAYER_ZAMBDA_ID = 'associate-payer';
const DISASSOCIATE_PAYER_ZAMBDA_ID = 'disassociate-payer';
const ADD_PROCEDURE_CODE_ZAMBDA_ID = 'add-procedure-code';
const UPDATE_PROCEDURE_CODE_ZAMBDA_ID = 'update-procedure-code';
const DELETE_PROCEDURE_CODE_ZAMBDA_ID = 'delete-procedure-code';
const BULK_ADD_PROCEDURE_CODES_ZAMBDA_ID = 'bulk-add-procedure-codes';

export interface CreateFeeScheduleInput {
  name: string;
  effectiveDate: string;
  description: string;
}

export interface UpdateFeeScheduleInput extends CreateFeeScheduleInput {
  id: string;
  status?: 'active' | 'retired';
}

export const createFeeSchedule = async (oystehr: Oystehr, parameters: CreateFeeScheduleInput): Promise<any> => {
  try {
    if (CREATE_FEE_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('create fee schedule zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: CREATE_FEE_SCHEDULE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const listFeeSchedules = async (oystehr: Oystehr): Promise<ChargeItemDefinition[]> => {
  try {
    if (LIST_FEE_SCHEDULES_ZAMBDA_ID == null) {
      throw new Error('list fee schedules zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: LIST_FEE_SCHEDULES_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateFeeSchedule = async (
  oystehr: Oystehr,
  parameters: UpdateFeeScheduleInput
): Promise<ChargeItemDefinition> => {
  try {
    if (UPDATE_FEE_SCHEDULE_ZAMBDA_ID == null) {
      throw new Error('update fee schedule zambda environment variable could not be loaded');
    }
    const { id: feeScheduleId, ...rest } = parameters;
    const response = await oystehr.zambda.execute({
      id: UPDATE_FEE_SCHEDULE_ZAMBDA_ID,
      feeScheduleId,
      ...rest,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface DesignateChargeMasterInput {
  feeScheduleId: string;
  designation: ChargeMasterDesignation;
}

export const designateChargeMaster = async (
  oystehr: Oystehr,
  parameters: DesignateChargeMasterInput
): Promise<ChargeItemDefinition> => {
  try {
    if (DESIGNATE_CHARGE_MASTER_ZAMBDA_ID == null) {
      throw new Error('designate charge master zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DESIGNATE_CHARGE_MASTER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface GetChargeMasterInput {
  designation: ChargeMasterDesignation;
  payerOrganizationId?: string;
}

export interface GetChargeMasterResponse {
  feeSchedule: ChargeItemDefinition | null;
  source: 'payer' | 'chargemaster' | null;
}

export const getChargeMaster = async (
  oystehr: Oystehr,
  parameters: GetChargeMasterInput
): Promise<GetChargeMasterResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GET_CHARGE_MASTER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface AssociatePayerInput {
  feeScheduleId: string;
  organizationId: string;
}

export const associatePayer = async (
  oystehr: Oystehr,
  parameters: AssociatePayerInput
): Promise<ChargeItemDefinition> => {
  try {
    if (ASSOCIATE_PAYER_ZAMBDA_ID == null) {
      throw new Error('associate payer zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: ASSOCIATE_PAYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const disassociatePayer = async (
  oystehr: Oystehr,
  parameters: AssociatePayerInput
): Promise<ChargeItemDefinition> => {
  try {
    if (DISASSOCIATE_PAYER_ZAMBDA_ID == null) {
      throw new Error('disassociate payer zambda environment variable could not be loaded');
    }
    const response = await oystehr.zambda.execute({
      id: DISASSOCIATE_PAYER_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export interface AddProcedureCodeInput {
  feeScheduleId: string;
  code: string;
  description?: string;
  modifier?: string;
  amount: number;
}

export interface UpdateProcedureCodeInput extends AddProcedureCodeInput {
  index: number;
}

export interface DeleteProcedureCodeInput {
  feeScheduleId: string;
  index: number;
}

export interface BulkAddProcedureCodesInput {
  feeScheduleId: string;
  codes: { code: string; modifier?: string; amount: number }[];
}

export const addProcedureCode = async (
  oystehr: Oystehr,
  parameters: AddProcedureCodeInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: ADD_PROCEDURE_CODE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const updateProcedureCode = async (
  oystehr: Oystehr,
  parameters: UpdateProcedureCodeInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: UPDATE_PROCEDURE_CODE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const deleteProcedureCode = async (
  oystehr: Oystehr,
  parameters: DeleteProcedureCodeInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: DELETE_PROCEDURE_CODE_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const bulkAddProcedureCodes = async (
  oystehr: Oystehr,
  parameters: BulkAddProcedureCodesInput
): Promise<ChargeItemDefinition> => {
  try {
    const response = await oystehr.zambda.execute({
      id: BULK_ADD_PROCEDURE_CODES_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
