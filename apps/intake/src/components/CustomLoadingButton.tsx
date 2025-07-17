import LoadingButton, { LoadingButtonProps } from '@mui/lab/LoadingButton';
import { FC } from 'react';

export const CustomLoadingButton: FC<LoadingButtonProps> = (props) => {
  return (
    <LoadingButton
      {...props}
      variant="contained"
      color="secondary"
      data-testid="loading-button"
      sx={{
        // align button to right if no back button
        mt: { xs: 1, md: 0 },
        ml: { xs: 0, md: 'auto' },
      }}
      size="large"
    >
      {/* if user uses google translate instead of language picker they could run into DOM tree issues for text nodes */}
      {/* https://github.com/facebook/react/issues/11538#issuecomment-390386520 */}
      <span>{props.children}</span>
    </LoadingButton>
  );
};
