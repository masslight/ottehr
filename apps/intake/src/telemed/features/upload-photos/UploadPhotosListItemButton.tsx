import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { otherColors } from '@theme/colors';
import { Attachment } from 'fhir/r4b';
import { FC, useEffect, useState } from 'react';
import { UCGetPaperworkResponse } from 'utils';
import { create } from 'zustand';
import { StyledListItemWithButton } from '../../../components/StyledListItemWithButton';
import { useGetPaperwork } from '../paperwork';

type UploadPhotosListItemButtonProps = {
  onClick: () => void;
  hideText: boolean;
  noDivider?: boolean;
};

export const useUploadPhotosStore = create<{
  paperworkData?: UCGetPaperworkResponse;
  isLoading: boolean;
  isFetching: boolean;
  attachment?: Attachment;
}>()(() => ({ isLoading: false, isFetching: false }));

export const UploadPhotosListItemButton: FC<UploadPhotosListItemButtonProps> = ({ onClick, hideText, noDivider }) => {
  const { isLoading, isFetching } = useGetPaperwork((data) => {
    const attachment = data?.questionnaireResponse?.item
      ?.find((item) => item.linkId === 'patient-condition-page')
      ?.item?.find((item) => item.linkId === 'patient-photos')?.answer?.[0]?.valueAttachment;
    setIsPhotoUploaded(!!attachment?.url);
    useUploadPhotosStore.setState({ paperworkData: data, attachment });
  });
  const [isPhotoUploaded, setIsPhotoUploaded] = useState(false);

  useEffect(() => {
    useUploadPhotosStore.setState({ isLoading, isFetching });
  }, [isLoading, isFetching]);

  return (
    <StyledListItemWithButton
      primaryText="Upload photo"
      secondaryText={isLoading || isFetching ? 'Loading...' : isPhotoUploaded ? 'Photo attached' : 'No photo uploaded'}
      hideText={hideText}
      onClick={onClick}
      noDivider={noDivider}
    >
      <PhotoLibraryOutlinedIcon sx={{ color: otherColors.purple }} />
    </StyledListItemWithButton>
  );
};
