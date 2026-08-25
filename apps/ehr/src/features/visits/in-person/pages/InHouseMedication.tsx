import { AppBar, Box, Tab, Tabs, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
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

export type InHouseMedicationTab = 'mar' | 'medication-details';

interface InHouseMedicationProps {
  // set by the Review & Sign inline edit flow, which drives the active tab itself and
  // switches views in place instead of navigating away
  tab?: InHouseMedicationTab;
  onTabChange?: (tab: InHouseMedicationTab) => void;
  onOrderNew?: () => void;
  onEditOrder?: (orderId: string) => void;
}

export const InHouseMedication: React.FC<InHouseMedicationProps> = ({ tab, onTabChange, onOrderNew, onEditOrder }) => {
  const { id: appointmentId } = useParams();
  const { medications } = useMedicationAPI();
  const navigate = useNavigate();
  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { tabName } = useParams();
  const theme = useTheme();
  const isTabTransitionRef = useRef(false);
  const [content, setContent] = useState<{ mar: React.ReactNode; details: React.ReactNode } | null>(null);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const currentTab = tab ?? tabName;
  const isInlineFlow = useIsInlineFlow();

  // In inline mode there is no URL to carry ?scrollTo=, so a pending-row click stores it locally
  const [inlineScrollTo, setInlineScrollTo] = useState<string | undefined>(undefined);

  // handle tabs click navigation
  const handleChange = useCallback(() => {
    isTabTransitionRef.current = true;
    if (onTabChange) {
      setInlineScrollTo(undefined);
      onTabChange(currentTab === 'mar' ? 'medication-details' : 'mar');
      return;
    }
    requestAnimationFrame(() => {
      if (tabName === 'mar') {
        navigate(getInHouseMedicationDetailsUrl(appointmentId!));
      } else {
        navigate(getInHouseMedicationMARUrl(appointmentId!));
      }
    });
  }, [appointmentId, currentTab, navigate, onTabChange, tabName]);

  const [searchParams] = useSearchParams();
  const scrollTo = inlineScrollTo ?? searchParams.get('scrollTo');

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
  }, [scrollTo, currentTab]);

  const handlePendingMedicationClick = useCallback(
    (medicationId: string): void => {
      setInlineScrollTo(medicationId);
      onTabChange?.('medication-details');
    },
    [onTabChange]
  );

  const handleNavigateToMar = useCallback((): void => {
    onTabChange?.('mar');
  }, [onTabChange]);

  useEffect(() => {
    // the page is heavy and rendering takes a time, to optimization we initially show loader and starting render process for content after that
    setContent({
      mar: (
        <MarTable
          onPendingMedicationClick={onTabChange ? handlePendingMedicationClick : undefined}
          onEditOrder={onEditOrder}
        />
      ),
      details: <MedicationList onNavigateToMar={onTabChange ? handleNavigateToMar : undefined} />,
    });
  }, [medications, onTabChange, handlePendingMedicationClick, handleNavigateToMar, onEditOrder]);

  if (!content) {
    return <Loader />;
  }

  return (
    <Box>
      {isInlineFlow ? (
        !isReadOnly && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <OrderButton dataTestId={dataTestIds.inHouseMedicationsPage.orderButton} onClick={onOrderNew} />
          </Box>
        )
      ) : (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <PageTitle
            dataTestId={dataTestIds.inHouseMedicationsPage.title}
            label="Medications"
            showIntakeNotesButton={false}
          />
          {!isReadOnly && <OrderButton dataTestId={dataTestIds.inHouseMedicationsPage.orderButton} />}
        </Box>
      )}
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
            <Tabs value={currentTab === 'mar' ? 0 : 1} onChange={handleChange} aria-label="medication tabs">
              <Tab data-testid={dataTestIds.inHouseMedicationsPage.marTab} label="MAR" />
              <Tab data-testid={dataTestIds.inHouseMedicationsPage.medicationDetailsTab} label="Medication Details" />
            </Tabs>
          </Box>
        </AppBar>

        <TabContent isActive={currentTab === 'mar'}>{content.mar}</TabContent>
        <TabContent isActive={currentTab === 'medication-details'}>{content.details}</TabContent>
      </Box>

      <MedicationNotes />
    </Box>
  );
};
