import { Box, Button, ButtonProps, Typography } from '@mui/material';
import { FC, ReactNode, useState } from 'react';
import { CustomDialog } from './CustomDialog';

type ConfirmationDialogProps = {
  response: () => void;
  title: string;
  description?: string;
  children: (showDialog: () => void) => ReactNode;
  actionButtons?: {
    proceed?: {
      text?: string;
      variant?: ButtonProps['variant'];
      color?: ButtonProps['color'];
    };
    back?: {
      text?: string;
      variant?: ButtonProps['variant'];
      color?: ButtonProps['color'];
    };
  };
};

export const ConfirmationDialog: FC<ConfirmationDialogProps> = (props) => {
  const [open, setOpen] = useState(false);

  const showDialog = (): void => {
    setOpen(true);
  };

  const hideDialog = (): void => {
    setOpen(false);
  };

  const confirmRequest = (): void => {
    props.response();
    hideDialog();
  };

  return (
    <>
      {props.children(showDialog)}
      {open && (
        <CustomDialog open={open} onClose={hideDialog} PaperProps={{ sx: { borderRadius: 2 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="h2" color="primary.main">
              {props.title}
            </Typography>

            {props.description && <Typography>{props.description}</Typography>}

            {/* Gap only comes into effect on smaller screens */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Button
                onClick={hideDialog}
                size="large"
                color={props?.actionButtons?.back?.color || 'primary'}
                variant={props?.actionButtons?.back?.variant || 'text'}
              >
                {props?.actionButtons?.back?.text || 'Back'}
              </Button>

              <Button
                onClick={confirmRequest}
                size="large"
                color={props?.actionButtons?.proceed?.color || 'primary'}
                variant={props?.actionButtons?.proceed?.variant || 'contained'}
              >
                {props?.actionButtons?.proceed?.text || 'Proceed'}
              </Button>
            </Box>
          </Box>
        </CustomDialog>
      )}
    </>
  );
};
