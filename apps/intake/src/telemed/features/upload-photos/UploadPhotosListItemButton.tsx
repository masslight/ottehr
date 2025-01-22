import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { FC } from 'react';
import { StyledListItemWithButton } from 'ui-components';
import { otherColors } from '../../../IntakeThemeProvider';

type UploadPhotosListItemButtonProps = {
  onClick: () => void;
  hideText: boolean;
  noDivider?: boolean;
};

export const UploadPhotosListItemButton: FC<UploadPhotosListItemButtonProps> = ({ onClick, hideText, noDivider }) => {
  // todo: fix this
  // const photos = paperworkData
  //   ? (filterObject(paperworkData.files || {}, (key) => key.startsWith('patient-photos')) as FileURLs)
  //   : {};
  const photos = {};
  const loading = false;
  return (
    <StyledListItemWithButton
      primaryText="Upload photos"
      secondaryText={
        loading
          ? 'Loading...'
          : Object.keys(photos).length > 0
          ? `${Object.keys(photos).length} photos attached`
          : 'No photos uploaded'
      }
      hideText={hideText}
      onClick={onClick}
      noDivider={noDivider}
    >
      <PhotoLibraryOutlinedIcon sx={{ color: otherColors.purple }} />
    </StyledListItemWithButton>
  );
};
