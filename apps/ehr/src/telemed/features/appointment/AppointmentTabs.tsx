import { TabContext, TabPanel } from '@mui/lab';
import { FC, useEffect } from 'react';
import { TelemedAppointmentVisitTabs } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useExamObservations } from '../../hooks/useExamObservations';
import { useZapEHRAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentStore, useGetChartData } from '../../state';
import { AssessmentTab } from './AssessmentTab';
import { ExamTab } from './ExamTab';
import { MedicalHistoryTab } from './MedicalHistoryTab';
import { PlanTab } from './PlanTab';
import { ReviewTab } from './ReviewTab';

export const AppointmentTabs: FC = () => {
  const apiClient = useZapEHRAPIClient();
  const { currentTab, encounter, chartData } = getSelectors(useAppointmentStore, [
    'currentTab',
    'encounter',
    'chartData',
  ]);
  const { update } = useExamObservations();

  const { isFetching } = useGetChartData({ apiClient, encounterId: encounter.id }, (data) => {
    useAppointmentStore.setState({ chartData: { ...chartData, ...data } });
    update(data.examObservations, true);
  });

  useEffect(() => {
    useAppointmentStore.setState({
      isChartDataLoading: isFetching,
    });
  }, [chartData, isFetching]);

  return (
    <TabContext value={currentTab}>
      <TabPanel value={TelemedAppointmentVisitTabs.hpi} sx={{ p: 0 }}>
        <MedicalHistoryTab />
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
    </TabContext>
  );
};
