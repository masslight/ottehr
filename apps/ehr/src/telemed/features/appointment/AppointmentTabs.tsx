import { TabContext, TabPanel } from '@mui/lab';
import { FC, useRef } from 'react';
import { NavigationProvider } from 'src/features/css-module/context/NavigationContext';
import { TelemedAppointmentVisitTabs } from 'utils';
import { useChartData } from '../../../features/css-module/hooks/useChartData';
import { OttehrAi } from '../../../features/css-module/pages/OttehrAi';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useExamObservations } from '../../hooks/useExamObservations';
import { useAppointmentStore } from '../../state';
import { AssessmentTab } from './AssessmentTab';
import { ExamTab } from './ExamTab';
import { MedicalHistoryTab } from './MedicalHistoryTab';
import { PlanTab } from './PlanTab';
import { ReviewTab } from './ReviewTab';
import { VitalsTab } from './VitalsTab';

export const AppointmentTabs: FC = () => {
  const isInitialLoad = useRef(true);
  const { currentTab, encounter, chartData } = getSelectors(useAppointmentStore, [
    'currentTab',
    'encounter',
    'chartData',
  ]);
  const { update } = useExamObservations();

  useChartData({
    encounterId: encounter.id!,
    onSuccess: (data) => {
      useAppointmentStore.setState({ chartData: { ...chartData, ...data } });
      update(data.examObservations, true);
      isInitialLoad.current = false;
    },
    onError: (error) => {
      console.error(error);
    },
    enabled: isInitialLoad.current,
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
