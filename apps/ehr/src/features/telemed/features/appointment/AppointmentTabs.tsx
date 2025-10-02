import { TabContext, TabPanel } from '@mui/lab';
import { FC } from 'react';
import { AssessmentTab } from 'src/components/AssessmentTab';
import { ExamTab } from 'src/components/ExamTab';
import { MedicalHistoryTab } from 'src/components/MedicalHistoryTab';
import { OttehrAi } from 'src/features/in-person/components/OttehrAi';
import { InPersonNavigationProvider } from 'src/features/in-person/context/InPersonNavigationContext';
import { useAppTelemedLocalStore, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { TelemedAppointmentVisitTabs } from 'utils';
import { PlanTab } from '../../../../components/PlanTab';
import { ReviewTab } from '../../../../components/ReviewTab';
import { useExamObservations } from '../../hooks/useExamObservations';
import { VitalsTab } from './VitalsTab';

export const AppointmentTabs: FC = () => {
  const currentTab = useAppTelemedLocalStore((state) => state.currentTab);
  const { update } = useExamObservations();

  const { chartData } = useChartData({
    onSuccess: (data) => {
      if (!data) return;
      update(data.examObservations, true);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  return (
    // temporary navigation provider for vitals to work
    <InPersonNavigationProvider>
      <TabContext value={currentTab}>
        <TabPanel value={TelemedAppointmentVisitTabs.hpi} sx={{ p: 0 }}>
          <MedicalHistoryTab />
        </TabPanel>
        <TabPanel value={TelemedAppointmentVisitTabs.vitals} sx={{ p: 0 }}>
          <VitalsTab />
        </TabPanel>
        <TabPanel value={TelemedAppointmentVisitTabs.exam} sx={{ p: 0 }}>
          <ExamTab />
        </TabPanel>
        <TabPanel value={TelemedAppointmentVisitTabs.assessment} sx={{ p: 0 }}>
          <AssessmentTab />
        </TabPanel>
        <TabPanel value={TelemedAppointmentVisitTabs.plan} sx={{ p: 0 }}>
          <PlanTab />
        </TabPanel>
        <TabPanel value={TelemedAppointmentVisitTabs.sign} sx={{ p: 0 }}>
          <ReviewTab />
        </TabPanel>
        {chartData?.aiChat != null ? (
          <TabPanel value={TelemedAppointmentVisitTabs.ottehrai} sx={{ p: 0 }}>
            <OttehrAi />
          </TabPanel>
        ) : undefined}
      </TabContext>
    </InPersonNavigationProvider>
  );
};
