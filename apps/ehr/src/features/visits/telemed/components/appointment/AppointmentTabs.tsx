import { TabContext, TabPanel } from '@mui/lab';
import { FC } from 'react';
import { InPersonNavigationProvider } from 'src/features/visits/in-person/context/InPersonNavigationContext';
import { AssessmentTab } from 'src/features/visits/shared/components/assessment-tab/AssessmentTab';
import { ExamTab } from 'src/features/visits/shared/components/exam-tab/ExamTab';
import { MedicalHistoryTab } from 'src/features/visits/shared/components/medical-history-tab';
import { OttehrAi } from 'src/features/visits/shared/components/OttehrAi';
import { PlanTab } from 'src/features/visits/shared/components/plan-tab/PlanTab';
import { ReviewTab } from 'src/features/visits/shared/components/review-tab/ReviewTab';
import { useAppTelemedLocalStore, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { TelemedAppointmentVisitTabs } from 'utils';
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
