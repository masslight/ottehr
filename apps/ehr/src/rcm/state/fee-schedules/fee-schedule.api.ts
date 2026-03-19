import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition } from 'fhir/r4b';
import { ChargeMasterDesignation, chooseJson } from 'utils';

const CREATE_FEE_SCHEDULE_ZAMBDA_ID = 'create-fee-schedule';
const UPDATE_FEE_SCHEDULE_ZAMBDA_ID = 'update-fee-schedule';
const LIST_FEE_SCHEDULES_ZAMBDA_ID = 'list-fee-schedules';
const DESIGNATE_CHARGE_MASTER_ZAMBDA_ID = 'designate-charge-master';

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
