import React, { FC, useEffect } from 'react';
import { TabContext, TabPanel } from '@mui/lab';
import { MedicalHistoryTab } from './MedicalHistoryTab';
import { getSelectors } from '../../../shared/store/getSelectors';
import { EXAM_OBSERVATIONS_FIELDS, useAppointmentStore, useGetChartData } from '../../state';
import { ExamTab } from './ExamTab';
import { useZapEHRAPIClient } from '../../hooks/useZapEHRAPIClient';
import { useExamObservations } from '../../hooks/useExamObservations';
import { AssessmentTab } from './AssessmentTab';
import { PlanTab } from './PlanTab';
import { ReviewTab } from './ReviewTab';

export const AppointmentTabs: FC = () => {
  const apiClient = useZapEHRAPIClient();
  const { currentTab, encounter, chartData, isReadOnly } = getSelectors(useAppointmentStore, [
    'currentTab',
    'encounter',
    'chartData',
    'isReadOnly',
  ]);
  const { update, isLoading } = useExamObservations();

  const { isFetching } = useGetChartData({ apiClient, encounterId: encounter.id }, (data) => {
    useAppointmentStore.setState({ chartData: data });
    update(EXAM_OBSERVATIONS_FIELDS, (data.examObservations && data.examObservations.length > 0) || isReadOnly);
    update(data.examObservations, true);
  });

  useEffect(() => {
    useAppointmentStore.setState({ isChartDataLoading: isFetching || !chartData });
  }, [chartData, isFetching]);

  useEffect(() => {
    useAppointmentStore.setState({ isExamObservationsLoading: isFetching || !chartData || isLoading });
  }, [chartData, isFetching, isLoading]);

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
