import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { Box, Divider, List, Skeleton, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { AccordionCard } from '../../../../../telemed/components';
import { useMedicationHistory } from '../../../hooks/useMedicationHistory';
import { ButtonStyled } from '../../generic-notes-list/components/ui/ButtonStyled';
import { MedicationHistoryEntity } from './MedicationHistoryEntity';

const PATIENT_MEDS_COUNT_TO_LOAD = 100;

export const MedicationHistoryList: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);
  const { isLoading, medicationHistory } = useMedicationHistory('patient', PATIENT_MEDS_COUNT_TO_LOAD);

  const shownMeds = useMemo(() => {
    if (!seeMoreOpen) {
      return medicationHistory.slice(0, 3);
    } else {
      return medicationHistory;
    }
  }, [seeMoreOpen, medicationHistory]);

  const handleToggle = (): void => {
    setIsCollapsed((v) => !v);
  };

  const toggleShowMore = (): void => {
    setSeeMoreOpen((state) => !state);
  };

  const getSeeMoreButtonLabel = (): string => {
    return seeMoreOpen ? 'See less' : 'See more';
  };

  return (
    <AccordionCard label="Medication History" collapsed={isCollapsed} onSwitch={handleToggle}>
      <Box sx={{ px: 3, py: 1 }}>
        <List disablePadding>
          {shownMeds.map((item, index) => (
            <React.Fragment key={item.resourceId}>
              <MedicationHistoryEntity item={item} />
              {index < shownMeds.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
          {isLoading && (
            <>
              <Skeleton width={'100%'} height={51}></Skeleton>
              <Skeleton width={'100%'} height={51}></Skeleton>
              <Skeleton width={'100%'} height={51}></Skeleton>
            </>
          )}
        </List>
        {!isLoading && medicationHistory.length > 0 && (
          <ButtonStyled onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
            {getSeeMoreButtonLabel()}
          </ButtonStyled>
        )}
        {!isLoading && medicationHistory.length === 0 && (
          <Typography variant="body1" sx={{ opacity: 0.65 }}>
            No previous medication history available
          </Typography>
        )}
      </Box>
    </AccordionCard>
  );
};
