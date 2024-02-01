import { FC, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@mui/material';

interface LinkedButtonWithIconProps {
  to: string;
  text: string;
  btnVariant: 'text' | 'contained' | 'outlined';
  btnSize?: 'small' | 'medium' | 'large';
  startIcon?: ReactNode;
  onClickFn?: MouseEventHandler<HTMLButtonElement>;
}

const LinkedButtonWithIcon: FC<LinkedButtonWithIconProps> = ({
  to,
  text,
  btnVariant,
  btnSize = 'small',
  startIcon,
  onClickFn,
}) => {
  return (
    <Link to={to}>
      <Button variant={btnVariant} size={btnSize} startIcon={startIcon} sx={{ bottom: 4 }} onClick={onClickFn}>
        {text}
      </Button>
    </Link>
  );
};

export default LinkedButtonWithIcon;
