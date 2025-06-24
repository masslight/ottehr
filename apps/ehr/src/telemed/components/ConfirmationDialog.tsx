import { DialogContentText, Stack } from '@mui/material';
import { FC, ReactNode } from 'react';
import { RoundedButton } from '../../components/RoundedButton';
import { dataTestIds } from '../../constants/data-test-ids';
import { InnerStateDialog } from './InnerStateDialog';

type ConfirmationDialogProps = {
  response: () => void;
  title: string;
  description?: string | ReactNode;
  children: (showDialog: () => void) => ReactNode;
  actionButtons?: {
    proceed?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
      disabled?: boolean;
    };
    back?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    };
    reverse?: boolean;
  };
};

export const ConfirmationDialog: FC<ConfirmationDialogProps> = (props) => {
  const confirmRequest = (hideDialog: () => void): void => {
    props.response();
    hideDialog();
  };

  return (
    <InnerStateDialog
      title={props.title}
      content={
        props.description &&
        (typeof props.description === 'string' ? (
          <DialogContentText>{props.description}</DialogContentText>
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
