import { Button } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../components';
import { IntakeDataContext } from '../store';

const CancellationConfirmation = (): JSX.Element => {
  const { state } = useContext(IntakeDataContext);

  useEffect(() => {
    mixpanel.track('Cancellation Confirmation');
  }, []);

  return (
    <CustomContainer
      title="Your visit has been canceled"
      description={
        <>
          If you have any questions or concerns, please call our team at: &nbsp; Ottehr
          {/* TODO: add number instead of placeholder */}
          <strong>Placeholder number</strong>
        </>
      }
      bgVariant={IntakeFlowPageRoute.CancellationConfirmation.path}
    >
      <Link to={`/location/${state.selectedLocation?.slug}/${state.visitType}`}>
        <Button variant="outlined" size="large" type="button">
          Book again
        </Button>
      </Link>
    </CustomContainer>
  );
};

export default CancellationConfirmation;
