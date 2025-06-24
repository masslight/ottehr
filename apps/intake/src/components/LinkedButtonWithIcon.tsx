import { Button } from '@mui/material';
import { FC, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LinkedButtonWithIconProps {
  to: string;
  text: string;
  btnVariant: 'text' | 'contained' | 'outlined';
  btnSize?: 'small' | 'medium' | 'large';
  startIcon?: ReactNode;
  onClickFn?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

const LinkedButtonWithIcon: FC<LinkedButtonWithIconProps> = ({
  to,
  text,
  btnVariant,
  btnSize = 'small',
  startIcon,
  onClickFn,
  className,
}) => {
  return (
    <Link to={to} className={className}>
      <Button variant={btnVariant} size={btnSize} startIcon={startIcon} sx={{ bottom: 4 }} onClick={onClickFn}>
        {text}
      </Button>
    </Link>
  );
};

export default LinkedButtonWithIcon;
