import { AppBar, Box, Tab, Tabs, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { dataTestIds } from '../../../constants/data-test-ids';
import { PageTitle } from '../../../telemed/components/PageTitle';
import { CSSLoader } from '../components/CSSLoader';
import { MarTable } from '../components/medication-administration/mar/MarTable';
import { MedicationList } from '../components/medication-administration/medication-details/MedicationList';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { MedicationNotes } from '../components/medication-administration/MedicationNotes';
import { OrderButton } from '../components/medication-administration/OrderButton';
import { useMedicationAPI } from '../hooks/useMedicationOperations';
import { getInHouseMedicationDetailsUrl, getInHouseMedicationMARUrl } from '../routing/helpers';

interface TabContentProps {
  isActive: boolean;
  children: React.ReactNode;
}

const TabContent: React.FC<TabContentProps> = ({ isActive, children }) => (
  <Box
    sx={{
      display: isActive ? 'block' : 'none', // used this hack to fast switch between tabs, MUI take a lot of time to render tab from zero
    }}
  >
    {children}
  </Box>
);

export const InHouseMedication: React.FC = () => {
  const { id: appointmentId } = useParams();
  const { medications } = useMedicationAPI();
  const navigate = useNavigate();
  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { tabName } = useParams();
  const theme = useTheme();
  const isTabTransitionRef = useRef(false);
  const [content, setContent] = useState<{ mar: React.ReactNode; details: React.ReactNode } | null>(null);

  // handle tabs click navigation
  const handleChange = useCallback(() => {
    isTabTransitionRef.current = true;
    requestAnimationFrame(() => {
      tabName === 'mar'
        ? navigate(getInHouseMedicationDetailsUrl(appointmentId!))
        : navigate(getInHouseMedicationMARUrl(appointmentId!));
    });
  }, [appointmentId, navigate, tabName]);

  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');

  // handle scroll to element (row was clicked - scroll to element, or tab was clicked - scroll to table top)
  useLayoutEffect(() => {
    if (isTabTransitionRef.current || scrollTo) {
      requestAnimationFrame(() => {
        if (tabContentRef.current && tabsRef.current) {
          const element = scrollTo ? document.getElementById(`medication-${scrollTo}`) : tabContentRef.current;
          element?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
        }
      });
    }
  }, [scrollTo, tabName]);

  useEffect(() => {
    // the page is heavy and rendering takes a time, to optimization we initially show loader and starting render process for content after that
    setContent({ mar: <MarTable />, details: <MedicationList /> });
  }, [medications]);

  if (!content) {
    return <CSSLoader />;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle
          dataTestId={dataTestIds.inHouseMedicationsPage.title}
          label="Medications"
          showIntakeNotesButton={false}
        />
        <OrderButton dataTestId={dataTestIds.inHouseMedicationsPage.orderButton} />
      </Box>
      <MedicationHistoryList />

      <Box ref={tabContentRef}>
        <AppBar
          position="static"
          color="default"
          elevation={0}
          sx={{
            zIndex: 3,
            mb: 2,
            mt: 3,
          }}
          ref={tabsRef}
        >
          <Box
            sx={{
              marginLeft: '-20px',
              padding: '0 24px',
              width: 'calc(100% + 40px)',
              backgroundColor: theme.palette.background.default,
            }}
          >
            <Tabs value={tabName === 'mar' ? 0 : 1} onChange={handleChange} aria-label="medication tabs">
              <Tab label="MAR" />
              <Tab data-testid={dataTestIds.inHouseMedicationsPage.medicationDetailsTab} label="Medication Details" />
            </Tabs>
          </Box>
        </AppBar>

        <TabContent isActive={tabName === 'mar'}>{content.mar}</TabContent>
        <TabContent isActive={tabName === 'medication-details'}>{content.details}</TabContent>
      </Box>

      <MedicationNotes />
    </Box>
  );
};
