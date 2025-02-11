import { FC, ReactNode } from 'react';
import { DialogContentText, Stack } from '@mui/material';
import { RoundedButton } from '../../components/RoundedButton';
import { InnerStateDialog } from './InnerStateDialog';
import { dataTestIds } from '../../constants/data-test-ids';

type ConfirmationDialogProps = {
  response: () => void;
  title: string;
  description?: string | ReactNode;
  children: (showDialog: () => void) => ReactNode;
  actionButtons?: {
    proceed?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
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
            onClick={() => confirmRequest(hideDialog)}
            variant="contained"
            color={props?.actionButtons?.proceed?.color || 'primary'}
            data-testid={dataTestIds.telemedEhrFlow.dialogButtonConfirm}
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
