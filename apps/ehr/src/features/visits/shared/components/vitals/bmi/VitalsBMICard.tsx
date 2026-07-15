import { otherColors } from '@ehrTheme/colors';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Collapse, Typography } from '@mui/material';
import React, { JSX, useCallback, useState } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { dataTestIds } from 'src/constants/data-test-ids';
import { BMI_UNIT, formatBMI, VitalsBMIObservationDTO, VitalsObservationDTO } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import VitalsHistoryContainer from '../components/VitalsHistoryContainer';
import VitalHistoryElement from '../components/VitalsHistoryEntry';

interface VitalsBMICardProps {
  current: VitalsBMIObservationDTO[];
  historical: VitalsBMIObservationDTO[];
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
  isWeightRefused?: boolean;
}

const VitalsBMICard: React.FC<VitalsBMICardProps> = ({
  current,
  historical,
  onDelete,
  isWeightRefused = false,
}): JSX.Element => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const handleSectionCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const latestBMI = current[0]?.value;
  const label = `BMI (${BMI_UNIT})${latestBMI !== undefined ? ` ${formatBMI(latestBMI)}` : ''}`;
  const currentIds = new Set(current.map((obs) => obs.resourceId));

  return (
    <Box sx={{ mt: 3 }} data-testid={dataTestIds.vitalsPage.bmiCard}>
      <AccordionCard label={label} collapsed={isCollapsed} onSwitch={handleSectionCollapse}>
        <DoubleColumnContainer
          divider
          leftColumn={
            latestBMI === undefined ? (
              <Box
                sx={{
                  mx: 2,
                  my: 1.5,
                  p: 2,
                  bgcolor: '#EBF3FF',
                  borderRadius: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 1,
                }}
                data-testid={dataTestIds.vitalsPage.bmiInfoMessage}
              >
                <InfoOutlinedIcon sx={{ color: 'primary.main', mt: '2px', flexShrink: 0 }} />
                <Typography variant="body2" color="text.primary">
                  Please enter the patient's weight and height for today to calculate their BMI.
                  <br />
                  The BMI will be calculated automatically.
                </Typography>
              </Box>
            ) : null
          }
          rightColumn={
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Collapse in={isWeightRefused} unmountOnExit>
                <Box
                  sx={{
                    mx: 2,
                    my: 1.5,
                    p: 2,
                    borderRadius: 1,
                    bgcolor: otherColors.dialogNote,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                  data-testid={dataTestIds.vitalsPage.bmiWeightRefusedWarning}
                >
                  <WarningAmberIcon sx={{ color: otherColors.warningIcon, mt: '2px', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: otherColors.warningText, fontWeight: 500 }}>
                    BMI not calculated, weight declined by patient
                  </Typography>
                </Box>
              </Collapse>
              <VitalsHistoryContainer
                currentEncounterObs={current}
                historicalObs={historical}
                isLoading={false}
                historyElementCreator={(historyEntry) => (
                  <VitalHistoryElement
                    historyEntry={historyEntry}
                    onDelete={currentIds.has(historyEntry.resourceId) && !isReadOnly ? onDelete : undefined}
                    dataTestId={dataTestIds.vitalsPage.bmiItem}
                  />
                )}
              />
            </Box>
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsBMICard;
