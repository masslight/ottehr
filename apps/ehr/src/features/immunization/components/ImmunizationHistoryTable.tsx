import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import {
  Button,
  Paper,
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
import { ImmunizationHistoryTableRow } from './ImmunizationHistoryTableRow';
import { ImmunizationHistoryTableSkeletonBody } from './ImmunizationHistoryTableSkeletonBody';

interface Props {
  showActions: boolean;
}

export const ImmunizationHistoryTable: React.FC<Props> = ({ showActions }) => {
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);

  const { isLoading, medicationHistory } = useMedicationHistory();

  const shownMeds = useMemo(() => {
    if (!seeMoreOpen) {
      return medicationHistory.slice(0, COLLAPSED_MEDS_COUNT);
    } else {
      return medicationHistory;
    }
  }, [seeMoreOpen, medicationHistory]);

  const toggleShowMore = (): void => {
    setSeeMoreOpen((state) => !state);
  };

  const getSeeMoreButtonLabel = (): string => {
    return seeMoreOpen ? 'See less' : 'See more';
  };

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Vaccine</TableCell>
            <TableCell>Dose / Route / Instructions</TableCell>
            <TableCell>Ordered</TableCell>
            <TableCell>Given</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        {isLoading ? (
          <ImmunizationHistoryTableSkeletonBody />
        ) : (
          <TableBody>
            {shownMeds.map((med) => (
              <ImmunizationHistoryTableRow historyEntry={med} showActions={showActions} />
            ))}
            {medicationHistory.length > COLLAPSED_MEDS_COUNT && (
              <Button onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
                {getSeeMoreButtonLabel()}
              </Button>
            )}
            {medicationHistory.length === 0 && (
              <Typography variant="body1" sx={{ opacity: 0.65 }}>
                No items
              </Typography>
            )}
          </TableBody>
        )}
      </Table>
    </TableContainer>
  );
};
