import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Typography } from '@mui/material';
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
}

const VitalsBMICard: React.FC<VitalsBMICardProps> = ({ current, historical, onDelete }): JSX.Element => {
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
                Please add and save Weight and Height to calculate BMI.
                <br />
                BMI will be saved automatically.
              </Typography>
            </Box>
          }
          rightColumn={
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
          }
        />
      </AccordionCard>
    </Box>
  );
};

export default VitalsBMICard;
