import React, { FC } from 'react';
import { IconButton } from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { otherColors } from '../../CustomThemeProvider';

type DeleteIconButtonProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

export const DeleteIconButton: FC<DeleteIconButtonProps> = (props) => {
  const { onClick, disabled } = props;

  return (
    <IconButton sx={{ color: otherColors.endCallButton }} size="small" disabled={disabled} onClick={onClick}>
      <DeleteOutlinedIcon fontSize="small" />
    </IconButton>
  );
};
