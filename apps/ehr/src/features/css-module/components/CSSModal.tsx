import WarningIcon from '@mui/icons-material/Warning';
import { Box, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useState } from 'react';
import { CustomDialog, CustomDialogProps } from '../../../components/dialogs/CustomDialog';
import { dataTestIds } from '../../../constants/data-test-ids';

type CSSModalProps<Entity = undefined> = {
  handleConfirm: (entity: Entity) => any;
  entity?: Entity;
  errorMessage?: string;
  icon?: React.ReactNode;
  showEntityPreview?: boolean;
  getEntityPreviewText?: (entity: Entity) => string;
  color?: string;
  ContentComponent?: ReactElement;
  description?: React.ReactNode;
  disabled?: boolean;
};

export function CSSModal<T = undefined>({
  handleConfirm: _handleConfirm,
  entity,
  errorMessage,
  icon = <WarningIcon sx={{ mr: 1 }} />,
  showEntityPreview = true,
  getEntityPreviewText = (entity: T | undefined) => (entity !== undefined ? JSON.stringify(entity) : ''),
  open,
  handleClose,
  title,
  description,
  closeButtonText,
  closeButton,
  confirmText,
  error,
  color = 'error.main',
  ContentComponent,
  disabled,
}: CSSModalProps<T> & Omit<CustomDialogProps, 'handleConfirm' | 'confirmLoading'>): React.ReactElement {
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [errorFromAction, setError] = useState<string | undefined>(undefined);

  const handleConfirm = async (): Promise<void> => {
    setIsPerformingAction(true);
    setError(undefined);
    try {
      await _handleConfirm(entity as T);
      handleClose();
    } catch {
      setError(errorMessage);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setIsPerformingAction(false);
    }
  };

  const dialogTitle = (
    <Box display="flex" alignItems="center" color={color} data-testid={dataTestIds.cssModal.confirmationDialogue}>
      {icon}
      <Typography variant="h4">{title}</Typography>
    </Box>
  );

  const dialogContent = (
    <>
      <Typography>{description}</Typography>
      {showEntityPreview && entity !== undefined && (
        <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
          <Typography variant="body1" color="text.main">
            {getEntityPreviewText(entity)}
          </Typography>
        </Box>
      )}
      {ContentComponent}
    </>
  );

  return (
    <CustomDialog
      open={open}
      handleClose={handleClose}
      title={dialogTitle}
      description={dialogContent}
      closeButton={closeButton}
      closeButtonText={closeButtonText}
      handleConfirm={handleConfirm}
      confirmText={confirmText}
      confirmLoading={isPerformingAction}
      error={error || errorFromAction}
      disabled={disabled}
    />
  );
}
