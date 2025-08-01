import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { PropsWithChildren } from 'react';
import { InnerStatePopover } from 'src/telemed/components/InnerStatePopover';

type VitalAbnormalValuePopoverProps = PropsWithChildren<{
  isAbnormal: boolean;
}>;

export const VitalAbnormalValuePopover: FC<VitalAbnormalValuePopoverProps> = (props) => {
  const { children, isAbnormal } = props;

  return (
    <InnerStatePopover
      popoverChildren={
        <Typography variant="body2" sx={{ p: 1 }}>
          Abnormal value
        </Typography>
      }
      popoverProps={{
        anchorOrigin: {
          vertical: 'top',
          horizontal: 'center',
        },
        transformOrigin: {
          vertical: 'bottom',
          horizontal: 'center',
        },
      }}
    >
      {({ handlePopoverOpen, handlePopoverClose }) => (
        <Box
          onMouseEnter={isAbnormal ? handlePopoverOpen : undefined}
          onMouseLeave={isAbnormal ? handlePopoverClose : undefined}
          component="span"
        >
          {children}
        </Box>
      )}
    </InnerStatePopover>
  );
};
