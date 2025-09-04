import { otherColors } from '@ehrTheme/colors';
import { DialogContentText, Stack } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, ReactNode } from 'react';
import { RoundedButton } from '../../components/RoundedButton';
import { dataTestIds } from '../../constants/data-test-ids';
import { InnerStateDialog } from './InnerStateDialog';

type ConfirmationDialogProps = {
  response: () => Promise<void> | void;
  title: string;
  description?: string | ReactNode;
  children: (showDialog: () => void) => ReactNode;
  actionButtons?: {
    proceed?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
      disabled?: boolean;
      loading?: boolean;
    };
    back?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    };
    reverse?: boolean;
  };
};

export const ConfirmationDialog: FC<ConfirmationDialogProps> = (props) => {
  const confirmRequest = async (hideDialog: () => void): Promise<void> => {
    try {
      await props.response();
      hideDialog();
    } catch (error: unknown) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
  };

  return (
    <InnerStateDialog
      title={props.title}
      content={
        props.description &&
        (typeof props.description === 'string' ? (
          <DialogContentText sx={{ color: otherColors.tableRow }}>{props.description}</DialogContentText>
        ) : (
          props.description
        ))
      }
      actions={(hideDialog) => (
        <Stack direction={props?.actionButtons?.reverse ? 'row-reverse' : 'row'} spacing={2}>
          <RoundedButton
            data-testid={dataTestIds.dialog.proceedButton}
            onClick={() => confirmRequest(hideDialog)}
            variant="contained"
            color={props?.actionButtons?.proceed?.color || 'primary'}
            disabled={props?.actionButtons?.proceed?.disabled}
            loading={props?.actionButtons?.proceed?.loading}
          >
            {props?.actionButtons?.proceed?.text || 'Proceed'}
          </RoundedButton>
          <RoundedButton onClick={hideDialog} color={props?.actionButtons?.back?.color || 'primary'}>
            {props?.actionButtons?.back?.text || 'Back'}
          </RoundedButton>
        </Stack>
      )}
      DialogProps={{ maxWidth: 'xs' }}
    >
      {(showDialog) => props.children(showDialog)}
    </InnerStateDialog>
  );
};
