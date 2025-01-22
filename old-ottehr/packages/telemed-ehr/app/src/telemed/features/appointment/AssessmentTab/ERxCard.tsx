import { Box } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { AccordionCard, RoundedButton } from '../../../components';
import { useAppointmentStore } from '../../../state';
import { ERX } from '../ERX';
import { PrescribedMedicationReviewItem } from '../ReviewTab/components/PrescribedMedicationReviewItem';
import { isErxEnabled } from '../../../../helpers/erx';

export const ERxCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { isReadOnly, chartData } = getSelectors(useAppointmentStore, ['isReadOnly', 'chartData']);

  const [isERXOpen, setIsERXOpen] = useState(false);
  const [isERXLoading, setIsERXLoading] = useState(false);
  const isERXDisabled = !isErxEnabled();

  const handleERXLoadingStatusChange = useCallback<(status: boolean) => void>(
    (status) => setIsERXLoading(status),
    [setIsERXLoading],
  );

  return (
    <AccordionCard label="RX" collapsed={collapsed} onSwitch={() => setCollapsed((prevState) => !prevState)}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {(chartData?.prescribedMedications?.length || -1) >= 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {chartData?.prescribedMedications?.map((med) => (
              <PrescribedMedicationReviewItem medication={med} key={med.resourceId || med.name} />
            ))}
          </Box>
        )}
        <RoundedButton
          disabled={isReadOnly || isERXLoading || isERXDisabled}
          variant="contained"
          onClick={() => setIsERXOpen(true)}
        >
          Add RX
        </RoundedButton>
      </Box>
      {isERXOpen && <ERX onClose={() => setIsERXOpen(false)} onLoadingStatusChange={handleERXLoadingStatusChange} />}
    </AccordionCard>
  );
};
