import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { handleChangeInPersonVisitStatus } from './inPersonVisitStatusUtils';

interface CompleteIntakeWorkflowParams {
  assignedIntakePerformerId?: string;
  encounterId: string;
  endIntakePractitioner: (practitionerId: string) => Promise<void>;
  refetch: () => Promise<unknown> | unknown;
  zambdaClient?: Oystehr;
}

export const completeIntakeWorkflow = async ({
  assignedIntakePerformerId,
  encounterId,
  endIntakePractitioner,
  refetch,
  zambdaClient,
}: CompleteIntakeWorkflowParams): Promise<boolean> => {
  try {
    if (assignedIntakePerformerId) {
      await endIntakePractitioner(assignedIntakePerformerId);
    }

    await handleChangeInPersonVisitStatus(
      {
        encounterId,
        updatedStatus: 'ready for provider',
      },
      zambdaClient
    );
    await refetch();
    return true;
  } catch (error) {
    console.error(error);
    enqueueSnackbar('An error occurred trying to complete intake. Please try again.', { variant: 'error' });
    return false;
  }
};
