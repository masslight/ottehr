import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import {
  ReasonListCodes,
  reasonListValues,
} from 'src/features/visits/in-person/components/medication-administration/medicationTypes';
import { VFC_ELIGIBILITY_LABELS } from 'utils/lib/types/data/immunization/vfc';
import { ADMINISTERED, AdministrationType } from '../common';
import { useVfcEligibility } from '../hooks/useVaccineInventory';
import { useConfirmVfcCategory } from './VfcEligibilityBox';

interface Props {
  administrationType: AdministrationType;
  patientName: string | undefined;
  medicationName: string | undefined;
  dose: string;
  unit: string | undefined;
  route: string | undefined;
  open: boolean;
  handleClose: () => void;
  handleConfirm: () => void | Promise<void>;
  encounterId?: string;
  /** A dose from VFC stock is given while the visit's VFC eligibility isn't confirmed. */
  vfcUnconfirmed?: boolean;
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
  encounterId,
  vfcUnconfirmed = false,
}) => {
  const methods = useFormContext();
  const reason = methods.watch('reason');
  const otherReason = methods.watch('otherReason');
  const vfcCategory = useVfcEligibility(encounterId).data?.derived?.code;
  const { confirm: confirmVfcCategory } = useConfirmVfcCategory(encounterId);
  // With the box ticked, the pre-filled VFC category is confirmed first; a failed confirmation saves nothing.
  const confirmThenSave = async (): Promise<void> => {
    if (vfcUnconfirmed && vfcCategory && methods.getValues('confirmVfc') && !(await confirmVfcCategory(vfcCategory))) {
      return;
    }
    await handleConfirm();
  };
  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={open}
      handleClose={handleClose}
      handleConfirm={confirmThenSave}
      disabled={
        administrationType !== ADMINISTERED && (!reason || (reason === ReasonListCodes.OTHER && !otherReason?.trim()))
      }
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
            <strong>Immunization:</strong> {medicationName} / {dose}
            {unit} / {route}
          </Typography>
          {vfcUnconfirmed && (
            <>
              <Typography>VFC eligibility isn't confirmed for this visit.</Typography>
              {vfcCategory ? (
                <CheckboxInput
                  name="confirmVfc"
                  label={`Confirm VFC eligibility: ${VFC_ELIGIBILITY_LABELS[vfcCategory].long}`}
                  dataTestId={dataTestIds.administrationConfirmationDialog.vfcConfirmCheckbox}
                />
              ) : (
                <Typography>Pick a category at the top.</Typography>
              )}
            </>
          )}
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
