import AddIcon from '@mui/icons-material/Add';
import { Button, Grid, Stack, ToggleButtonGroup, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ContainedPrimaryToggleButton } from 'src/components/ContainedPrimaryToggleButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import PageContainer from 'src/layout/PageContainer';
import { getSelectors } from 'utils';
import { useTrackingBoardStore } from '../../state/tracking-board/tracking-board.store';
import { TrackingBoardTabs } from './TrackingBoardTabs';

export function TrackingBoardBody(): ReactElement {
  const { alignment, setAlignment } = getSelectors(useTrackingBoardStore, ['alignment', 'setAlignment']);

  return (
    <form>
      <PageContainer>
        <>
          <Grid container direction="row" justifyContent="space-between" alignItems="center">
            <ToggleButtonGroup size="small" value={alignment} exclusive onChange={setAlignment}>
              <ContainedPrimaryToggleButton
                value="all-patients"
                data-testid={dataTestIds.telemedEhrFlow.allPatientsButton}
              >
                All Patients
              </ContainedPrimaryToggleButton>
              <ContainedPrimaryToggleButton
                value="my-patients"
                data-testid={dataTestIds.telemedEhrFlow.myPatientsButton}
              >
                Patients Matching My Credentials
              </ContainedPrimaryToggleButton>
            </ToggleButtonGroup>

            <Stack direction="row" spacing={2} alignItems="center">
              <Link to="/visits/add">
                <Button
                  sx={{
                    borderRadius: 100,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                  color="primary"
                  variant="contained"
                >
                  <AddIcon />
                  <Typography fontWeight="bold">Visit</Typography>
                </Button>
              </Link>
            </Stack>
          </Grid>
          <TrackingBoardTabs />
        </>
      </PageContainer>
    </form>
  );
}
