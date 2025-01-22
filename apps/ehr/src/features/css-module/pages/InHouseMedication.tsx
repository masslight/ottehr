import React, { useEffect, useRef, useCallback, useLayoutEffect, useState } from 'react';
import { Box, Tabs, Tab, AppBar, useTheme } from '@mui/material';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { PageHeader } from '../components/medication-administration/PageHeader';
import { OrderButton } from '../components/medication-administration/OrderButton';
import { MarTable } from '../components/medication-administration/mar/MarTable';
import { MedicationList } from '../components/medication-administration/medication-details/MedicationList';
import { useMedicationAPI } from '../hooks/useMedicationOperations';
import { MedicationNotes } from '../components/medication-administration/MedicationNotes';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getInHouseMedicationMARUrl, getInHouseMedicationDetailsUrl } from '../routing/helpers';
import { CSSLoader } from '../components/CSSLoader';

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
  const { id: encounterId } = useParams();
  const { medications } = useMedicationAPI();
  const navigate = useNavigate();
  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const { tabName } = useParams();
  const theme = useTheme();
  const isTabTransitionRef = useRef(false);
  const [content, setContent] = useState<{ mar: React.ReactNode; details: React.ReactNode } | null>(null);

  // const { data: medicationOrders } = useGetMedicationOrders({ encounterId });

  // handle tabs click navigation
  const handleChange = useCallback(() => {
    isTabTransitionRef.current = true;
    requestAnimationFrame(() => {
      tabName === 'mar'
        ? navigate(getInHouseMedicationDetailsUrl(encounterId!))
        : navigate(getInHouseMedicationMARUrl(encounterId!));
    });
  }, [encounterId, navigate, tabName]);

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

  const [isTabsSticky, setIsTabsSticky] = useState(false);
  const stickyObserverRef = useRef<IntersectionObserver | null>(null);
  const stickyTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stickyObserverRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsTabsSticky(!entry.isIntersecting);
      },
      {
        threshold: [0],
        rootMargin: '-1px 0px 0px 0px',
      }
    );

    if (stickyTriggerRef.current) {
      stickyObserverRef.current.observe(stickyTriggerRef.current);
    }

    return () => {
      if (stickyObserverRef.current) {
        stickyObserverRef.current.disconnect();
      }
    };
  }, [content]);

  if (!content) {
    return <CSSLoader />;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" pl={0.5} mb={2} mt={2}>
        <PageHeader title="Medications" variant="h3" component="h1" />
        <OrderButton />
      </Box>
      <MedicationHistoryList />

      <Box position="relative" ref={tabContentRef}>
        <Box ref={stickyTriggerRef} sx={{ position: 'absolute', top: '-6px', left: 0, right: 0, height: '1px' }} />
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            top: '-20px',
            zIndex: 3,
            mb: 2,
            mt: 3,
            transition: 'box-shadow 0.3s ease-in-out',
          }}
          ref={tabsRef}
        >
          <Box
            sx={{
              marginLeft: '-20px',
              padding: '0 24px',
              width: 'calc(100% + 40px)',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: theme.palette.background.default,
              boxShadow: isTabsSticky ? '0px 4px 4px 0px rgba(0, 0, 0, 0.1)' : 'none',
              transition: 'box-shadow 0.3s ease-in-out',
            }}
          >
            <Tabs
              sx={{
                transition: 'padding-right 0.3s ease-in-out',
                paddingRight: isTabsSticky ? '220px' : '24px',
              }}
              value={tabName === 'mar' ? 0 : 1}
              onChange={handleChange}
              aria-label="medication tabs"
            >
              <Tab label="MAR" />
              <Tab label="Medication Details" />
            </Tabs>
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                top: '4px',
                transition: 'transform 0.2s ease-in-out',
                transform: isTabsSticky ? 'translateX(0)' : 'translateX(100%)',
              }}
            >
              <OrderButton sx={{ marginRight: '24px' }} size="medium" />
            </Box>
          </Box>
        </AppBar>
        <TabContent isActive={tabName === 'mar'}>{content.mar}</TabContent>
        <TabContent isActive={tabName === 'medication-details'}>{content.details}</TabContent>
      </Box>

      <MedicationNotes />
    </Box>
  );
};
