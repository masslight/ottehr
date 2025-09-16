import { TabContext, TabPanel } from '@mui/lab';
import { FC } from 'react';
import { NavigationProvider } from 'src/features/css-module/context/NavigationContext';
import { useChartData } from 'src/telemed';
import { TelemedAppointmentVisitTabs } from 'utils';
import { OttehrAi } from '../../../features/css-module/pages/OttehrAi';
import { useExamObservations } from '../../hooks/useExamObservations';
import { useAppTelemedLocalStore } from '../../state';
import { AssessmentTab } from './AssessmentTab';
import { ExamTab } from './ExamTab';
import { MedicalHistoryTab } from './MedicalHistoryTab';
import { PlanTab } from './PlanTab';
import { ReviewTab } from './ReviewTab';
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
    <NavigationProvider>
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
    </NavigationProvider>
  );
};
