import { Popover, PopoverProps } from '@mui/material';
import { FC, MouseEvent, ReactNode, useState } from 'react';

type InnerStatePopoverProps = {
  children: ({
    handlePopoverOpen,
    handlePopoverClose,
  }: {
    handlePopoverOpen: (event: MouseEvent<Element>) => void;
    handlePopoverClose: () => void;
  }) => ReactNode;
  popoverChildren: ReactNode;
  popoverProps?: Omit<PopoverProps, 'open'>;
};

export const InnerStatePopover: FC<InnerStatePopoverProps> = (props) => {
  const { children, popoverChildren, popoverProps } = props;

  const [anchorEl, setAnchorEl] = useState<Element | null>(null);

  const handlePopoverOpen = (event: MouseEvent<Element>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = (): void => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      {children({ handlePopoverOpen, handlePopoverClose })}
      <Popover
        sx={{
          pointerEvents: 'none',
        }}
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        onClose={handlePopoverClose}
        disableRestoreFocus
        {...popoverProps}
      >
        {popoverChildren}
      </Popover>
    </>
  );
};
