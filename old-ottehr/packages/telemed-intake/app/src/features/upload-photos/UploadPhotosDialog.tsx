import { FC } from 'react';
import { CustomDialog } from 'ottehr-components';
import { UploadPhotosWrapper } from './UploadPhotosWrapper';

type UploadPhotosDialogProps = { onClose: () => void };

export const UploadPhotosDialog: FC<UploadPhotosDialogProps> = ({ onClose }) => {
  return (
    <CustomDialog open={true} onClose={onClose}>
      <UploadPhotosWrapper onClose={onClose}></UploadPhotosWrapper>
    </CustomDialog>
  );
};
