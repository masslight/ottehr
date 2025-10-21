import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { Box, Button, Divider, Skeleton, Typography } from '@mui/material';
import React, { JSX, useMemo, useState } from 'react';
import { VitalsObservationDTO } from 'utils';
import { HISTORY_ELEMENT_SKELETON_TEXT } from '../types';

type VitalsHistoryContainerProps<TypeObsDTO extends VitalsObservationDTO> = {
  currentEncounterObs: TypeObsDTO[];
  historicalObs: TypeObsDTO[];
  isLoading: boolean;
  historyElementSkeletonText?: string;
  historyElementCreator: (historyEntry: TypeObsDTO) => React.ReactNode;
};

export function VitalsHistoryContainer<TypeObsDTO extends VitalsObservationDTO>({
  currentEncounterObs,
  historicalObs,
  isLoading,
  historyElementSkeletonText = HISTORY_ELEMENT_SKELETON_TEXT,
  historyElementCreator: historyElement,
}: VitalsHistoryContainerProps<TypeObsDTO>): JSX.Element {
  const [isMoreEntitiesShown, setIsMoreEntitiesShown] = useState(false);
  const toggleSeeMore = (): void => {
    setIsMoreEntitiesShown((state) => !state);
  };

  const { mainHistoryEntries, extraHistoryEntries } = useMemo(() => {
    const historyEntries = [...currentEncounterObs, ...historicalObs];
    const mainHistoryEntries = historyEntries.slice(0, Math.min(historyEntries.length, 3));
    const startIndex = Math.min(historyEntries.length, 3);
    const extraHistoryEntries = historyEntries.slice(startIndex, historyEntries.length);
    return { mainHistoryEntries, extraHistoryEntries };
  }, [currentEncounterObs, historicalObs]);

  const hasExtraHistoryEntries = extraHistoryEntries && extraHistoryEntries.length > 0;

  const fullHistoryEntriesList = useMemo(() => {
    if (!isMoreEntitiesShown) {
      return mainHistoryEntries;
    }
    return [...mainHistoryEntries, ...(extraHistoryEntries ?? [])];
  }, [isMoreEntitiesShown, mainHistoryEntries, extraHistoryEntries]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <Box key={index}>
              <VitalsHistoryElementSkeleton text={historyElementSkeletonText} />
              {index < mainHistoryEntries.length - 1 && <Divider orientation="horizontal" sx={{ width: '100%' }} />}
            </Box>
          ))}
        <Skeleton>
          <Typography sx={{ fontSize: '16px' }}>See more</Typography>
        </Skeleton>
      </Box>
    );
  }
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {fullHistoryEntriesList.map((entry, index) => (
        <Box key={entry.resourceId}>
          {historyElement(entry)}
          {index < fullHistoryEntriesList.length - 1 && <Divider orientation="horizontal" sx={{ width: '100%' }} />}
        </Box>
      ))}

      {hasExtraHistoryEntries && (
        <Button
          sx={{
            display: 'flex',
            textTransform: 'none',
            textAlign: 'left',
            justifyContent: 'flex-start',
            color: 'primary.main',
            minWidth: 'auto',
            fontWeight: 'bold',
            '&:hover': { backgroundColor: 'transparent' },
          }}
          onClick={toggleSeeMore}
          startIcon={isMoreEntitiesShown ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
        >
          {isMoreEntitiesShown ? 'See less' : 'See more'}
        </Button>
      )}
    </Box>
  );
}

export const VitalsHistoryElementSkeleton: React.FC<{ text: string }> = ({ text }): JSX.Element => (
  <Skeleton>
    <Typography sx={{ fontSize: '16px' }}>{text}</Typography>
  </Skeleton>
);

export default VitalsHistoryContainer;
