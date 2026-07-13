import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  Box,
  Button,
  ButtonGroup,
  ClickAwayListener,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Stack,
} from '@mui/material';
import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { RadiologyTable, RadiologyTableColumn } from '../components/RadiologyTable';

const radiologyColumns: RadiologyTableColumn[] = [
  'studyType',
  'studyName',
  'dx',
  'ordered',
  'stat',
  'status',
  'actions',
];

export const RadiologyOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { encounter } = useAppointmentData();
  const encounterId = encounter?.id;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLDivElement>(null);

  const handleCreateOrder = useCallback((): void => {
    navigate('create');
  }, [navigate]);

  const handleCreateExternalOrder = useCallback((): void => {
    setMenuOpen(false);
    navigate('create-external');
  }, [navigate]);

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PageTitle label="Radiology" showIntakeNotesButton={false} dataTestId={dataTestIds.radiologyPage.title} />
        <Stack direction="row" spacing={2} alignItems="center">
          {!isReadOnly && (
            <>
              <ButtonGroup
                ref={menuAnchorRef}
                variant="contained"
                sx={{ borderRadius: 28, boxShadow: 'none', '& .MuiButtonGroup-grouped': { border: 'none' } }}
              >
                <Button
                  data-testid={dataTestIds.radiologyPage.orderButton}
                  onClick={handleCreateOrder}
                  sx={{ textTransform: 'none', borderRadius: '28px 0 0 28px', fontWeight: 'bold', pl: 3 }}
                >
                  Order Radiology
                </Button>
                <Button
                  data-testid={dataTestIds.radiologyPage.orderMenuButton}
                  size="small"
                  aria-label="more radiology order options"
                  aria-haspopup="menu"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  sx={{ borderRadius: '0 28px 28px 0' }}
                >
                  <ArrowDropDownIcon />
                </Button>
              </ButtonGroup>
              <Popper
                open={menuOpen}
                anchorEl={menuAnchorRef.current}
                transition
                placement="bottom-end"
                sx={{ zIndex: 1 }}
              >
                {({ TransitionProps }) => (
                  <Grow {...TransitionProps}>
                    <Paper>
                      <ClickAwayListener onClickAway={() => setMenuOpen(false)}>
                        <MenuList autoFocusItem={menuOpen}>
                          <MenuItem
                            data-testid={dataTestIds.radiologyPage.externalOrderMenuItem}
                            onClick={handleCreateExternalOrder}
                          >
                            External Radiology Order
                          </MenuItem>
                        </MenuList>
                      </ClickAwayListener>
                    </Paper>
                  </Grow>
                )}
              </Popper>
            </>
          )}
        </Stack>
      </Box>
      <RadiologyTable
        encounterId={encounterId}
        columns={radiologyColumns}
        showFilters={false}
        allowDelete={!isReadOnly}
        onCreateOrder={!isReadOnly ? handleCreateOrder : undefined}
      />
    </Stack>
  );
};
