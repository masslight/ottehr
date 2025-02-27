import React, { FC, useEffect } from 'react';
import { TabContext, TabPanel } from '@mui/lab';
import { MedicalHistoryTab } from './MedicalHistoryTab';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore, useGetChartData } from '../../state';
import { ExamTab } from './ExamTab';
import { useZapEHRAPIClient } from '../../hooks/useOystehrAPIClient';
import { AssessmentTab } from './AssessmentTab';
import { PlanTab } from './PlanTab';
import { ReviewTab } from './ReviewTab';
import { useExamObservations } from '../../hooks/useExamObservations';

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
      <TabPanel value="hpi" sx={{ p: 0 }}>
        <MedicalHistoryTab />
      </TabPanel>
      <TabPanel value="exam" sx={{ p: 0 }}>
        <ExamTab />
      </TabPanel>
      <TabPanel value="erx" sx={{ p: 0 }}>
        <AssessmentTab />
      </TabPanel>
      <TabPanel value="plan" sx={{ p: 0 }}>
        <PlanTab />
      </TabPanel>
      <TabPanel value="sign" sx={{ p: 0 }}>
        <ReviewTab />
      </TabPanel>
    </TabContext>
  );
};
