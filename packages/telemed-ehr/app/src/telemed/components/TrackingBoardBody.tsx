import React, { ReactElement, useState } from 'react';
import PageContainer from '../../layout/PageContainer';
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  ToggleButtonGroup,
} from '@mui/material';
// import ChatModal from '../../components/ChatModal';
import { TrackingBoardTabs } from './TrackingBoardTabs';
import { ContainedPrimaryToggleButton } from './ContainedPrimaryToggleButton';
import { getSelectors } from '../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../state';

const PROVIDER_CONTACTS = ['1234567890'];

export function TrackingBoardBody(): ReactElement {
  const { alignment, setAlignment } = getSelectors(useTrackingBoardStore, ['alignment', 'setAlignment']);

  const [selectedContact, setSelectedContact] = useState(PROVIDER_CONTACTS[0]);

  const handleChangeSelectedContact = (event: SelectChangeEvent): void => {
    if (!event.target.value) {
      return;
    }
    setSelectedContact(event.target.value);
  };

  return (
    <form>
      <PageContainer>
        <>
          <Grid container direction="row" justifyContent="space-between" alignItems="center">
            <ToggleButtonGroup size="small" value={alignment} exclusive onChange={setAlignment}>
              <ContainedPrimaryToggleButton value="my-patients">My Patients</ContainedPrimaryToggleButton>
              <ContainedPrimaryToggleButton value="all-patients">All Patients</ContainedPrimaryToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ width: 260 }}>
              <FormControl fullWidth variant="standard">
                <InputLabel id="demo-simple-select-label">Send alerts to:</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  sx={{ width: '260px' }}
                  value={selectedContact}
                  label="Send alerts to:"
                  onChange={handleChangeSelectedContact}
                >
                  {PROVIDER_CONTACTS.map((contact) => (
                    <MenuItem value={contact} key={contact}>
                      {contact}
                    </MenuItem>
                  ))}
                  <Button
                    size="small"
                    fullWidth
                    sx={{
                      padding: '6px 16px',
                      justifyContent: 'flex-start',
                      fontSize: '14px',
                      fontWeight: 700,
                      textTransform: 'none',
                    }}
                  >
                    Manage contacts
                  </Button>
                </Select>
              </FormControl>
            </Box>
          </Grid>
          {/*<ChatModal />*/}
          <TrackingBoardTabs />
        </>
      </PageContainer>
    </form>
  );
}
