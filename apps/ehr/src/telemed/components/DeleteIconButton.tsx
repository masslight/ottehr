import { otherColors } from '@ehrTheme/colors';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { IconButton, IconButtonProps, SvgIconProps } from '@mui/material';
import React, { FC } from 'react';

type DeleteIconButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  size?: IconButtonProps['size'];
  fontSize?: SvgIconProps['fontSize'];
  dataTestId?: string;
};

export const DeleteIconButton: FC<DeleteIconButtonProps> = (props) => {
  const { onClick, disabled, size, fontSize, dataTestId } = props;

  return (
    <IconButton
      data-testid={dataTestId}
      sx={{ color: otherColors.endCallButton }}
      size={size || 'small'}
      disabled={disabled}
      onClick={onClick}
    >
      <DeleteOutlinedIcon fontSize={fontSize || 'small'} />
    </IconButton>
  );
};
