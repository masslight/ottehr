import { Grid } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LocationSelect from 'src/components/LocationSelect';
import PageContainer from 'src/layout/PageContainer';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { TaskRow } from '../components/TaskRow';

export const Tasks: React.FC = () => {
  const [locationSelected, setLocationSelected] = useState<LocationWithWalkinSchedule | undefined>(undefined);
  const location = useLocation();
  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);
  return (
    <PageContainer>
      <Grid container>
        <Grid item md={2.8} xs={1}>
          <LocationSelect
            queryParams={queryParams}
            //handleSubmit={handleSubmit}
            location={locationSelected}
            updateURL={true}
            storeLocationInLocalStorage={true}
            setLocation={setLocationSelected}
          />
        </Grid>
        <Grid item xs={12}>
          <TaskRow />
        </Grid>
      </Grid>
    </PageContainer>
  );
};
