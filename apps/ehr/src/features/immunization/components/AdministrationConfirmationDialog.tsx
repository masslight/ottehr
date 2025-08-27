import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { CSSModal } from 'src/features/css-module/components/CSSModal';
import {
  ReasonListCodes,
  reasonListValues,
} from 'src/features/css-module/components/medication-administration/medicationTypes';
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
    <CSSModal
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
          <Typography>
            <strong>Patient:</strong> {patientName}
          </Typography>
          <Typography>
            <strong>Vaccine:</strong> {medicationName} / {dose}
            {unit} / {route}
          </Typography>
          <Typography>
            Please confirm that you want to mark this immunization order as{' '}
            {<strong>{administrationType.label}</strong>}
            {administrationType.type !== 'administered' ? ' and select the reason.' : '.'}
          </Typography>
          {administrationType.type !== 'administered' ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <SelectInput
                name="reason"
                label="Reason"
                options={Object.entries(reasonListValues).map(([value, label]) => {
                  return {
                    value,
                    label,
                  };
                })}
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
