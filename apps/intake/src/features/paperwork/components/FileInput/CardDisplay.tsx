import { Box, Button, Skeleton, useTheme } from '@mui/material';
import { FC, useContext } from 'react';
import { IntakeThemeContext } from '../../../../contexts';
import { dataTestIds } from '../../../../helpers/data-test-ids';

interface CardDisplayProps {
  name: string;
  previewUrl: string;
  isLoading: boolean;
  onClear: () => void;
}

const CardDisplay: FC<CardDisplayProps> = ({ name, previewUrl, isLoading, onClear }) => {
  const theme = useTheme();
  const { otherColors } = useContext(IntakeThemeContext);

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          height: 260,
          border: `1px dashed ${theme.palette.primary.main}`,
          borderRadius: 2,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <ContentWrapper loading={isLoading}>
          <img src={previewUrl} alt={name} width="100%" height="260" style={{ objectFit: 'contain' }} />
        </ContentWrapper>
      </Box>
      <Button
        variant="text"
        onClick={() => {
          if (isLoading) {
            return;
          }
          onClear();
        }}
        sx={{
          color: otherColors.clearImage,
          justifyContent: 'start',
          px: 0,
          mt: 2,
          '&:hover': { backgroundColor: 'transparent' },
        }}
        data-testid={isLoading ? dataTestIds.fileCardUploadingButton : dataTestIds.fileCardClearButton}
      >
        {isLoading ? 'Uploading...' : 'Clear'}
      </Button>
    </Box>
  );
};

interface ContentWrapperProps extends React.PropsWithChildren {
  loading: boolean;
}

const ContentWrapper: FC<ContentWrapperProps> = ({ loading, children }) => {
  if (loading) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{
          '&.MuiSkeleton-root': {
            backgroundColor: 'rgba(0.25,0.25,0.25,0.25)',
            '>*': {
              visibility: 'visible',
            },
          },
        }}
      >
        {children}
      </Skeleton>
    );
  } else {
    return <>{children}</>;
  }
};

export default CardDisplay;
