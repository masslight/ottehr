import { LoadingButton } from '@mui/lab';
import { Box, Dialog, DialogActions, DialogTitle, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Claim } from 'fhir/r4b';
import React, { FC, useMemo, useState } from 'react';
import { RoundedButton } from '../../../components/RoundedButton';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useClaimsQueueStore, useEditClaimInformationMutation } from '../../state';
import { VirtualizedAutocomplete } from '../claim/modals/components';

export const ClaimsQueueButtons: FC = () => {
  const { selectedRows, employees, items } = getSelectors(useClaimsQueueStore, ['selectedRows', 'employees', 'items']);
  const [currentTeamMember, setCurrentTeamMember] = useState<string>();
  const editClaim = useEditClaimInformationMutation();
  const queryClient = useQueryClient();

  // const [anchorExportEl, setAnchorExportEl] = useState<null | HTMLElement>(null);
  // const exportOpen = Boolean(anchorExportEl);

  const [openAssign, setOpenAssign] = useState(false);

  // const handleClickExport = (event: MouseEvent<HTMLButtonElement>): void => {
  //   setAnchorExportEl(event.currentTarget);
  // };
  // const handleCloseExport = (): void => {
  //   setAnchorExportEl(null);
  // };

  const handleClickOpenAssign = (): void => {
    setCurrentTeamMember(undefined);
    setOpenAssign(true);
  };

  const handleCloseAssign = (): void => {
    setOpenAssign(false);
  };

  const currentTeamMemberObject = useMemo(
    () => employees.find((employee) => employee.id === currentTeamMember),
    [employees, currentTeamMember]
  );

  const handleAssign = (): void => {
    if (!currentTeamMemberObject) {
      return;
    }
    const claims = selectedRows
      .map((row) => items.find((item) => item.claim.id === row)?.claim)
      .filter((c) => c) as Claim[];

    const promises = claims.map((claim) =>
      editClaim.mutateAsync({
        claimData: { ...claim, enterer: { reference: currentTeamMemberObject.profile } },
        previousClaimData: claim,
        fieldsToUpdate: ['enterer'],
      })
    );

    void Promise.all(promises).then(() => {
      void queryClient.invalidateQueries({ queryKey: ['rcm-claims-queue'] });
      handleCloseAssign();
    });
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
      <RoundedButton disabled={selectedRows.length === 0} variant="contained" onClick={handleClickOpenAssign}>
        Assign to a team member
      </RoundedButton>

      {/*<RoundedButton disabled={selectedRows.length === 0} startIcon={<OpenInNewIcon />} onClick={handleClickExport}>*/}
      {/*  Export*/}
      {/*</RoundedButton>*/}

      {/*<Menu*/}
      {/*  open={exportOpen}*/}
      {/*  anchorEl={anchorExportEl}*/}
      {/*  onClose={handleCloseExport}*/}
      {/*  MenuListProps={{*/}
      {/*    'aria-labelledby': 'basic-button',*/}
      {/*  }}*/}
      {/*>*/}
      {/*  <MenuItem onClick={handleCloseExport}>Export to CSV</MenuItem>*/}
      {/*  <MenuItem onClick={handleCloseExport}>Export to XLS</MenuItem>*/}
      {/*</Menu>*/}

      <Dialog open={openAssign} onClose={handleCloseAssign} maxWidth="xs" fullWidth>
        <DialogTitle component={Typography} variant="h5" color="primary.dark" sx={{ pb: 2 }}>
          Select team member
        </DialogTitle>

        <Box sx={{ px: 3 }}>
          <VirtualizedAutocomplete
            value={currentTeamMemberObject}
            onChange={(employee) => setCurrentTeamMember(employee?.id)}
            options={employees}
            label="Team member"
            renderRow={(employee) => {
              if (employee.firstName && employee.lastName) return [employee.lastName, employee.firstName].join(', ');
              else if (employee.name) return employee.name;
              else return '-';
            }}
          />
        </Box>

        <DialogActions sx={{ display: 'flex', justifyContent: 'start', gap: 2, p: 3, pt: 2 }}>
          <LoadingButton
            sx={{
              fontWeight: 500,
              borderRadius: '100px',
              mr: '8px',
              textTransform: 'none',
            }}
            loading={editClaim.isPending}
            onClick={handleAssign}
            disabled={!currentTeamMember}
            variant="contained"
            color="primary"
          >
            Assign member
          </LoadingButton>
          <RoundedButton onClick={handleCloseAssign} color="primary">
            Cancel
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
