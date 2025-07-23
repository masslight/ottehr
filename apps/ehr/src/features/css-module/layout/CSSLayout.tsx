import React, { useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils';
import { useResetAppointmentStore } from '../../../telemed';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { CommonLayoutBreadcrumbs } from '../components/breadcrumbs/CommonLayoutBreadcrumbs';
import { Header } from '../components/Header';
import { InfoAlert } from '../components/InfoAlert';
import { Sidebar } from '../components/Sidebar';
import { useChartData } from '../hooks/useChartData';
import { BottomNavigation } from './BottomNavigation';

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
};

const mainBlocksStyle: React.CSSProperties = {
  display: 'flex',
  flexGrow: 1,
  overflow: 'hidden',
};

const contentWrapperStyle: React.CSSProperties = {
  flexGrow: 1,
  padding: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'auto',
};

export const CSSLayout: React.FC = () => {
  const { encounter, chartData } = useAppointmentStore();
  const isInitialLoad = useRef(true);

  useResetAppointmentStore();

  useChartData({
    encounterId: encounter.id!,
    onSuccess: (data) => {
      useAppointmentStore.setState({ chartData: { ...chartData, ...data } });
      isInitialLoad.current = false;
    },
    onError: (error) => {
      console.error(error);
    },
    enabled: isInitialLoad.current,
    shouldUpdateExams: true,
  });

  const assignedIntakePerformerId = getAdmitterPractitionerId(encounter);

  const assignedProviderId = getAttendingPractitionerId(encounter);

  return (
    <div style={layoutStyle}>
      <Header />
      <div style={mainBlocksStyle}>
        <Sidebar />
        <div style={contentWrapperStyle}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 20px 24px 20px',
            }}
          >
            {assignedIntakePerformerId && assignedProviderId ? (
              <>
                <CommonLayoutBreadcrumbs />
                <Outlet />
              </>
            ) : (
              <InfoAlert text="Select an intake performer and a provider in order to begin charting." persistent />
            )}
          </div>
          <BottomNavigation />
        </div>
      </div>
    </div>
  );
};

export const CSSSettingsLayout: React.FC = () => (
  <div style={layoutStyle}>
    <Header />
    <div style={mainBlocksStyle}>
      <div style={contentWrapperStyle}>
        <Outlet />
      </div>
    </div>
  </div>
);
