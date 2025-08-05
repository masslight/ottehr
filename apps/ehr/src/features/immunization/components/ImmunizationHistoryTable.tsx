import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import {
  Button,
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
import React, { ReactElement, useMemo, useState } from 'react';
import {
  COLLAPSED_MEDS_COUNT,
  MedicationWithTypeDTO,
  useMedicationHistory,
} from 'src/features/css-module/hooks/useMedicationHistory';

export const ImmunizationHistoryTable: React.FC = () => {
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

  const skeletonCell = (): ReactElement => {
    return (
      <TableCell>
        <Skeleton width={'100%'} height={24} />
      </TableCell>
    );
  };

  const skeletonRow = (): ReactElement => {
    return (
      <TableRow>
        {skeletonCell()}
        {skeletonCell()}
        {skeletonCell()}
        {skeletonCell()}
        {skeletonCell()}
      </TableRow>
    );
  };

  const historyRow = (medication: MedicationWithTypeDTO): ReactElement => {
    return (
      <TableRow>
        <TableCell>{medication.name}</TableCell>
        <TableCell>Dose / Route / Instructions</TableCell>
        <TableCell>Ordered</TableCell>
        <TableCell>Given</TableCell>
        <TableCell>{medication.status}</TableCell>
      </TableRow>
    );
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
        <TableBody>
          {isLoading ? (
            <>
              {skeletonRow()}
              {skeletonRow()}
              {skeletonRow()}
            </>
          ) : (
            shownMeds.map(historyRow)
          )}
          {!isLoading && medicationHistory.length > COLLAPSED_MEDS_COUNT && (
            <Button onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
              {getSeeMoreButtonLabel()}
            </Button>
          )}
          {!isLoading && medicationHistory.length === 0 && (
            <Typography variant="body1" sx={{ opacity: 0.65 }}>
              No items
            </Typography>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
