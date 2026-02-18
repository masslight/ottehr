import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { LoadingButton } from '@mui/lab';
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
import { AccordionCard } from 'src/components/AccordionCard';
import { COLLAPSED_MEDS_COUNT, useMedicationHistory } from 'src/features/visits/in-person/hooks/useMedicationHistory';
import { ButtonStyled } from 'src/features/visits/shared/components/generic-notes-list/components/ui/ButtonStyled';
import { usePrintChartData } from 'src/features/visits/shared/hooks/usePrintChartData';
import { MedicationHistoryEntity } from './MedicationHistoryEntity';

export const MedicationHistoryList: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  const { isLoading, medicationHistory } = useMedicationHistory();
  const { generateMedicationHistoryPdf, openPdf } = usePrintChartData({});

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

  const handlePrintMedicationHistoryClick = React.useCallback(async (): Promise<void> => {
    setPrintLoading(true);
    try {
      const medPdfUrl = await generateMedicationHistoryPdf(medicationHistory);
      console.log('medPdfUrl is', medPdfUrl);
      if (medPdfUrl) await openPdf(medPdfUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setPrintLoading(false);
    }
  }, [generateMedicationHistoryPdf, openPdf, medicationHistory]);

  return (
    <AccordionCard
      label="Medication History"
      collapsed={isCollapsed}
      onSwitch={handleToggle}
      headerItem={
        <LoadingButton
          loading={printLoading}
          variant="outlined"
          type="button"
          sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }}
          onClick={handlePrintMedicationHistoryClick}
          disabled={!medicationHistory.length}
        >
          Print Medications
        </LoadingButton>
      }
    >
      <Box sx={{ px: 3, py: 1 }}>
        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Medication</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Who Added</TableCell>
                <TableCell>Last Time Taken</TableCell>
                <TableCell />
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
                    <TableCell />
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
                    <TableCell />
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
                    <TableCell />
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
