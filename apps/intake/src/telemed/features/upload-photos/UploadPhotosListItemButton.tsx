import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { otherColors } from '@theme/colors';
import { Attachment } from 'fhir/r4b';
import { FC, useEffect, useState } from 'react';
import { useGetPaperwork } from 'src/telemed/features/paperwork/paperwork.queries';
import { UCGetPaperworkResponse } from 'utils/lib/types/data/paperwork/paperwork.types';
import { create } from 'zustand';
import { StyledListItemWithButton } from '../../../components/StyledListItemWithButton';
import { resolveConditionPhotoState } from './conditionPhotoState';

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
  documentReferenceId?: string;
  hasConditionStep?: boolean;
}>()(() => ({ isLoading: false, isFetching: false }));

export const UploadPhotosListItemButton: FC<UploadPhotosListItemButtonProps> = ({ onClick, hideText, noDivider }) => {
  const { isLoading, isFetching } = useGetPaperwork((data) => {
    if (!data) {
      return;
    }
    const { hasConditionStep, attachment, documentReferenceId } = resolveConditionPhotoState(data);
    setIsPhotoUploaded(!!attachment?.url);
    useUploadPhotosStore.setState({ paperworkData: data, attachment, documentReferenceId, hasConditionStep });
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
