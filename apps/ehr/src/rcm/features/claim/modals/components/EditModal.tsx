import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { LoadingButton } from '@mui/lab';
import { Box, DialogProps, DialogTitle, IconButton, Typography } from '@mui/material';
import React, { FC, ReactNode } from 'react';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { PropsWithChildren } from '../../../../../shared/types';
import { InnerStateDialog } from '../../../../../telemed';

type EditModalProps = PropsWithChildren<{
  onSave: (hideDialog: () => void) => void;
  title: string;
  customDialogButton?: (showDialog: () => void) => ReactNode;
  isSaveLoading?: boolean;
  onShow?: () => void;
  maxWidth?: DialogProps['maxWidth'];
}>;

export const EditModal: FC<EditModalProps> = (props) => {
  const { children, onSave, title, customDialogButton, isSaveLoading, onShow, maxWidth } = props;

  return (
    <InnerStateDialog
      showCloseButton
      DialogProps={{ maxWidth: maxWidth || 'lg', PaperProps: { sx: { p: 2, pt: 3 } } }}
      title={
        <DialogTitle component={Typography} variant="h4" color="primary.dark" sx={{ pb: 0 }}>
          {title}
        </DialogTitle>
      }
      actions={(hideDialog) => (
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <LoadingButton
            onClick={() => onSave(hideDialog)}
            loading={isSaveLoading}
            variant="contained"
            sx={{
              fontWeight: 500,
              borderRadius: '100px',
              mr: '8px',
              textTransform: 'none',
            }}
          >
            Save changes
          </LoadingButton>
          <RoundedButton variant="text" onClick={hideDialog}>
            Cancel
          </RoundedButton>
        </Box>
      )}
      content={<Box sx={{ pt: 3 }}>{children}</Box>}
    >
      {(showDialog) =>
        customDialogButton ? (
          customDialogButton(showDialog)
        ) : (
          <IconButton
            color="primary"
            size="small"
            onClick={() => {
              onShow?.();
              showDialog();
            }}
          >
            <EditOutlinedIcon />
          </IconButton>
        )
      }
    </InnerStateDialog>
  );
};
