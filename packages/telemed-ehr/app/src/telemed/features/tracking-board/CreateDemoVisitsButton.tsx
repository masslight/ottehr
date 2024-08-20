import { ReactElement } from 'react';
import { Button } from '@mui/material';
import React from 'react';
import { createDemoVisits } from '../../assets';
import { createSampleAppointments } from '../../../helpers/create-sample-appointments';
import { useApiClients } from '../../../hooks/useAppClients';
import { useAuth0 } from '@auth0/auth0-react';

interface CreateDemoVisitsButtonProps {
  visitService: string;
}

const CreateDemoVisitsButton = ({ visitService }: CreateDemoVisitsButtonProps): ReactElement => {
  const { fhirClient } = useApiClients();
  const { getAccessTokenSilently } = useAuth0();

  const handleCreateSampleAppointments = async (): Promise<void> => {
    const authToken = await getAccessTokenSilently();
    const response = await createSampleAppointments(
      fhirClient,
      visitService as 'in-person' | 'telemedicine',
      authToken,
    );
    console.log('response', response);
  };

  return (
    <Button
      onClick={() => handleCreateSampleAppointments()}
      sx={{
        my: 2,
        borderRadius: 10,
        border: '1px solid #2169F5',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <img src={createDemoVisits} alt="create demo visits" />
      Create Demo Visits
    </Button>
  );
};

export default CreateDemoVisitsButton;
