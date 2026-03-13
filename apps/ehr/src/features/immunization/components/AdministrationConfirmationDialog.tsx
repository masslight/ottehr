import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import {
  ReasonListCodes,
  reasonListValues,
} from 'src/features/visits/in-person/components/medication-administration/medicationTypes';
import { ADMINISTERED, AdministrationType } from '../common';

interface Props {
  administrationType: AdministrationType;
  patientName: string | undefined;
  medicationName: string | undefined;
  dose: string;
  unit: string | undefined;
  route: string | undefined;
  open: boolean;
  handleClose: () => void;
  handleConfirm: () => void;
}

export const AdministrationConfirmationDialog: React.FC<Props> = ({
  administrationType,
  patientName,
  medicationName,
  dose,
  unit,
  route,
  open,
  handleClose,
  handleConfirm,
}) => {
  const methods = useFormContext();
  const reason = methods.watch('reason');
  const otherReason = methods.watch('otherReason');
  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={open}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={administrationType !== ADMINISTERED && (!reason || (reason === ReasonListCodes.OTHER && !otherReason))}
      description={''}
      title={'Order ' + administrationType.label}
      confirmText={'Mark as ' + administrationType.label}
      closeButtonText="Cancel"
      ContentComponent={
        <Box display="flex" flexDirection="column" gap={1}>
          <Typography data-testid={dataTestIds.administrationConfirmationDialog.patient}>
            <strong>Patient:</strong> {patientName}
          </Typography>
          <Typography data-testid={dataTestIds.administrationConfirmationDialog.vaccine}>
            <strong>Vaccine:</strong> {medicationName} / {dose}
            {unit} / {route}
          </Typography>
          <Typography data-testid={dataTestIds.administrationConfirmationDialog.message}>
            Please confirm that you want to mark this immunization order as{' '}
            {<strong>{administrationType.label}</strong>}
            {administrationType.type !== 'administered' ? ' and select the reason.' : '.'}
          </Typography>
          {administrationType.type !== 'administered' ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <SelectInput
                dataTestId={dataTestIds.administrationConfirmationDialog.reasonField}
                name="reason"
                label="Reason"
                options={Object.keys(reasonListValues)}
                getOptionLabel={(option) => reasonListValues[option as ReasonListCodes]}
                required
              />
              {reason === ReasonListCodes.OTHER && <TextInput name="otherReason" label="Specify reason" required />}
            </Stack>
          ) : null}
        </Box>
      }
    />
  );
};
