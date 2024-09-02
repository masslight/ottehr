import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { filterObject, StyledListItemWithButton } from 'ottehr-components';
import { FileURLs } from 'ottehr-utils';
import { useGetPaperwork } from '../paperwork';
import { useTheme } from '@mui/system';

type UploadPhotosListItemButtonProps = {
  onClick: () => void;
  hideText: boolean;
};

export const UploadPhotosListItemButton: FC<UploadPhotosListItemButtonProps> = ({ onClick, hideText }) => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const { data: paperworkData, isLoading, isFetching } = useGetPaperwork(() => {}, { staleTime: 60000 });
  const theme = useTheme();
  const { t } = useTranslation();
  const photos = paperworkData
    ? (filterObject(paperworkData.files || {}, (key) => key.startsWith('patient-photos')) as FileURLs)
    : {};

  return (
    <StyledListItemWithButton
      primaryText={t('uploadPhotos.button')}
      secondaryText={
        isLoading || isFetching
          ? t('general.loading')
          : Object.keys(photos).length > 0
            ? t('photosAttached', { count: Object.keys(photos).length })
            : t('noPhotosAttached')
      }
      hideText={hideText}
      onClick={onClick}
    >
      <PhotoLibraryOutlinedIcon sx={{ color: theme.palette.primary.main }} />
    </StyledListItemWithButton>
  );
};
