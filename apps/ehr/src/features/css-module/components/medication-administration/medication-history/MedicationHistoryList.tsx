import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import {
  Box,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { COLLAPSED_MEDS_COUNT, useMedicationHistory } from 'src/features/css-module/hooks/useMedicationHistory';
import { AccordionCard } from '../../../../../telemed/components';
import { ButtonStyled } from '../../generic-notes-list/components/ui/ButtonStyled';
import { MedicationHistoryEntity } from './MedicationHistoryEntity';

export const MedicationHistoryList: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);

  const { isLoading, medicationHistory } = useMedicationHistory();

  // todo: need to update react-query and use isInitialLoading
  const showSkeletons = isLoading && medicationHistory.length === 0;

  const shownMeds = useMemo(() => {
    if (!seeMoreOpen) {
      return medicationHistory.slice(0, COLLAPSED_MEDS_COUNT);
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
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Medication</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Who Added</TableCell>
                <TableCell>Last Time Taken</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {showSkeletons ? (
                <>
                  <TableRow>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton width={'100%'} height={24} />
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                shownMeds.map((item) => <MedicationHistoryEntity key={item.resourceId} item={item} />)
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {!showSkeletons && medicationHistory.length > COLLAPSED_MEDS_COUNT && (
          <ButtonStyled onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
            {getSeeMoreButtonLabel()}
          </ButtonStyled>
        )}
        {!showSkeletons && medicationHistory.length === 0 && (
          <Typography variant="body1" sx={{ opacity: 0.65 }}>
            No previous medication history available
          </Typography>
        )}
      </Box>
    </AccordionCard>
  );
};
