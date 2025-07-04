import Oystehr from '@oystehr/sdk';
import { ChangeInPersonVisitStatusInput } from 'utils';
import { changeInPersonVisitStatus } from '../api/api';

export const handleChangeInPersonVisitStatus = async (
  zambdaInput: ChangeInPersonVisitStatusInput,
  oystehr?: Oystehr
): Promise<void> => {
  const { encounterId, user, updatedStatus } = zambdaInput;
  if (!encounterId) {
    throw new Error('Encounter ID is required to change the visit status');
  }
  if (!oystehr) {
    throw new Error('Oystehr Zambda client is not available when changing the visit status');
  }
  if (!user) {
    throw new Error('User is required to change the visit status');
  }
  try {
    await changeInPersonVisitStatus(oystehr, {
      encounterId,
      user,
      updatedStatus,
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};
