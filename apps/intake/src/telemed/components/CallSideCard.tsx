import EastIcon from '@mui/icons-material/East';
import { Card, IconButton } from '@mui/material';
import { FC, useState } from 'react';
import { SideCardList } from './SideCardList';

export const CallSideCard: FC = () => {
  const [isCardExpanded, setIsCardExpanded] = useState(true);

  const toggleCard = (): void => {
    setIsCardExpanded((prevState) => !prevState);
  };

  return (
    <Card
      sx={{
        flex: '1 auto',
        py: 5,
        px: isCardExpanded ? 5 : 2,
        borderRadius: 2,
        boxShadow: 0,
        position: 'relative',
        minWidth: isCardExpanded ? '347px' : '86px',
        width: isCardExpanded ? '347px' : '86px',
        transition: 'all 0.5s',
      }}
    >
      <IconButton onClick={toggleCard} size="small" sx={{ position: 'absolute', left: 7, top: 7 }}>
        <EastIcon
          sx={{
            transition: 'transform 0.5s',
            transform: isCardExpanded ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        />
      </IconButton>
      <SideCardList isCardExpanded={isCardExpanded} />
    </Card>
  );
};
