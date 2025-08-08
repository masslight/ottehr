import AddIcon from '@mui/icons-material/Add';
import { AppBar, Box, Stack, Tab, Tabs, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { CSSLoader } from 'src/features/css-module/components/CSSLoader';
import { getImmunizationMARUrl, getImmunizationVaccineDetailsUrl } from 'src/features/css-module/routing/helpers';
import { ROUTER_PATH } from 'src/features/css-module/routing/routesCSS';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { OrderHistoryTable } from '../components/OrderHistoryTable';
import { VaccineDetailsCardList } from '../components/VaccineDetailsCardList';

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

export const Immunization: React.FC = () => {
  const { id: appointmentId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { tabName } = useParams();

  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const isTabTransitionRef = useRef(false);
  const [content, setContent] = useState<{ mar: React.ReactNode; details: React.ReactNode } | null>(null);

  const onNewOrderClick = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.IMMUNIZATION_ORDER_CREATE}`);
  };

  const onTabChanged = useCallback(() => {
    isTabTransitionRef.current = true;
    requestAnimationFrame(() => {
      if (tabName === 'mar') {
        navigate(getImmunizationVaccineDetailsUrl(appointmentId!));
      } else {
        navigate(getImmunizationMARUrl(appointmentId!));
      }
    });
  }, [appointmentId, navigate, tabName]);

  useEffect(() => {
    setContent({ mar: <OrderHistoryTable showActions={true} />, details: <VaccineDetailsCardList /> });
  }, []);

  if (!content) {
    return <CSSLoader />;
  }

  return (
    <Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <PageTitle label="Immunization" showIntakeNotesButton={false} />
        <RoundedButton variant="contained" onClick={onNewOrderClick} startIcon={<AddIcon />}>
          New Order
        </RoundedButton>
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
              <Tab label="MAR" />
              <Tab label="Vaccine Details" />
            </Tabs>
          </Box>
        </AppBar>

        <TabContent isActive={tabName === 'mar'}>{content.mar}</TabContent>
        <TabContent isActive={tabName === 'vaccine-details'}>{content.details}</TabContent>
      </Box>
    </Stack>
  );
};
