import Oystehr from '@oystehr/sdk';
import { ChangeInPersonVisitStatusInput } from 'utils';
import { changeInPersonVisitStatus } from '../api/api';

export const handleChangeInPersonVisitStatus = async (
  zambdaInput: ChangeInPersonVisitStatusInput,
  oystehr: Oystehr
): Promise<void> => {
  try {
    const { encounterId, user, updatedStatus } = zambdaInput;
    await changeInPersonVisitStatus(oystehr, {
      encounterId,
      user,
      updatedStatus,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};
