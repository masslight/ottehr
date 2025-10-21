import { Button } from '@mui/material';
import { FC } from 'react';

interface ShowMoreButtonProps {
  isOpen: boolean;
  onClick: () => void;
  dataTestId?: string;
}

const ShowMoreButton: FC<ShowMoreButtonProps> = ({ isOpen, onClick, dataTestId }) => {
  return (
    <Button onClick={onClick} sx={{ p: 0 }} data-testid={dataTestId}>
      {isOpen ? 'Hide' : 'Show more'}
    </Button>
  );
};

export default ShowMoreButton;
