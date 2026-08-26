import AddIcon from '@mui/icons-material/Add';
import { AppBar, Box, Stack, Tab, Tabs, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getImmunizationMARUrl, getImmunizationVaccineDetailsUrl } from 'src/features/visits/in-person/routing/helpers';
import { ROUTER_PATH } from 'src/features/visits/in-person/routing/routesInPerson';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { PageTitle } from '../../visits/shared/components/PageTitle';
import { ImmunizationNotes } from '../components/ImmunizationNotes';
import { OrderHistoryTable } from '../components/OrderHistoryTable';
import { VaccineDetailsCardList } from '../components/VaccineDetailsCardList';

interface TabContentProps {
  isActive: boolean;
  children: React.ReactNode;
}

export type ImmunizationTab = 'mar' | 'vaccine-details';

interface ImmunizationProps {
  tab?: ImmunizationTab;
  onTabChange?: (tab: ImmunizationTab) => void;
  onCreateOrder?: () => void;
  onEditOrder?: (orderId: string) => void;
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

export const Immunization: React.FC<ImmunizationProps> = ({ tab, onTabChange, onCreateOrder, onEditOrder }) => {
  const { id: appointmentId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { tabName: tabNameFromUrl } = useParams();
  const tabName = tab ?? tabNameFromUrl;
  const isInlineFlow = useIsInlineFlow();

  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const isTabTransitionRef = useRef(false);
  const [content, setContent] = useState<{ mar: React.ReactNode; details: React.ReactNode } | null>(null);
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  // Which order card the details tab should scroll to when reached inline (the page variant
  // carries this through the URL's scrollTo search param instead)
  const [inlineScrollTo, setInlineScrollTo] = useState<string | undefined>(undefined);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const {
    resources: { patient },
  } = useAppointmentData(appointmentId);

  const onNewOrderClick = (): void => {
    if (onCreateOrder) onCreateOrder();
    else navigate(`/in-person/${appointmentId}/${ROUTER_PATH.IMMUNIZATION_ORDER_CREATE}`);
  };

  const onTabChanged = useCallback(() => {
    isTabTransitionRef.current = true;
    requestAnimationFrame(() => {
      if (onTabChange) {
        setInlineScrollTo(undefined);
        onTabChange(tabName === 'mar' ? 'vaccine-details' : 'mar');
        return;
      }
      if (tabName === 'mar') {
        navigate(getImmunizationVaccineDetailsUrl(appointmentId!));
      } else {
        navigate(getImmunizationMARUrl(appointmentId!));
      }
    });
  }, [appointmentId, navigate, tabName, onTabChange]);

  // Inline replacement for the MAR row's navigation to the details tab with ?scrollTo=<orderId>
  const onShowOrderDetails = useCallback(
    (orderId: string) => {
      setInlineScrollTo(orderId);
      onTabChange?.('vaccine-details');
    },
    [onTabChange]
  );

  // Inline replacement for the details card's navigation back to the MAR after administer/delete
  const onOrderFinished = useCallback(() => {
    setInlineScrollTo(undefined);
    onTabChange?.('mar');
  }, [onTabChange]);

  useEffect(() => {
    setContent({
      mar: (
        <OrderHistoryTable
          showActions={!isReadOnly}
          onEditOrder={onEditOrder}
          onShowDetails={onTabChange ? onShowOrderDetails : undefined}
        />
      ),
      details: (
        <VaccineDetailsCardList
          onOrderFinished={onTabChange ? onOrderFinished : undefined}
          scrollToOrderId={inlineScrollTo}
        />
      ),
    });
  }, [isReadOnly, onTabChange, onEditOrder, onShowOrderDetails, onOrderFinished, inlineScrollTo]);

  if (!content) {
    return <Loader />;
  }

  return (
    <Stack>
      <Stack direction="row" justifyContent={isInlineFlow ? 'flex-end' : 'space-between'} alignItems="center">
        {!isInlineFlow && (
          <PageTitle
            label="Immunizations"
            showIntakeNotesButton={false}
            dataTestId={dataTestIds.immunizationPage.title}
          />
        )}
        {!isReadOnly && (
          <RoundedButton variant="contained" onClick={onNewOrderClick} startIcon={<AddIcon />}>
            Order
          </RoundedButton>
        )}
      </Stack>
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
            <Tabs value={tabName === 'mar' ? 0 : 1} onChange={onTabChanged} aria-label="medication tabs">
              <Tab label="MAR" data-testid={dataTestIds.immunizationPage.marTab} />
              <Tab label="Immunization Details" data-testid={dataTestIds.immunizationPage.vaccineDetailsTab} />
            </Tabs>
          </Box>
        </AppBar>

        <TabContent isActive={tabName === 'mar'}>
          <AccordionCard
            label="Immunization history"
            collapsed={isImmunizationHistoryCollapsed}
            onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
            withBorder={false}
          >
            <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
          </AccordionCard>
          {content.mar}
          <ImmunizationNotes />
        </TabContent>
        <TabContent isActive={tabName === 'vaccine-details'}>{content.details}</TabContent>
      </Box>
    </Stack>
  );
};
