import { useAuth0 } from '@auth0/auth0-react';
import {
  Apartment as ApartmentIcon,
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  BusinessCenterOutlined as BusinessCenterIcon,
  Description as DescriptionIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Label as LabelIcon,
  List as ListIcon,
  Logout as LogoutIcon,
  MedicalServices as MedicalServicesIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  RequestQuoteOutlined as RequestQuoteIcon,
  Rule as RuleIcon,
  SettingsOutlined as SettingsIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import { Box, Collapse, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FC, ReactElement, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { otherColors } from 'utils/lib/theme/billing-palette';
import {
  RULES_ENGINE_TYPES,
  RULES_ENGINES,
  RulesEngineType,
} from 'utils/lib/types/data/billing/rules-engine.constants';
import { ChargeItemDefinitionLabels } from '../constants/chargeItemDefinition';
import { useInvoicingInBillingApp } from '../hooks/useInvoicingInBillingApp';

const DRAWER_WIDTH = 220;

interface NavItem {
  label: string;
  path: string;
  icon: ReactElement;
  // Shown only while invoicing runs in the billing app.
  invoicing?: boolean;
  hidden?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  // Collapsed on load unless the current page is one of its items.
  defaultCollapsed?: boolean;
}

// Menu position of each rules engine: submission, the two pre-invoice engines, then post-adjudication.
// A Record so a new engine fails to compile until it is given a place.
const RULES_MENU_POSITION: Record<RulesEngineType, number> = {
  'claim-submission': 0,
  'non-insurance-payer-pre-invoice': 1,
  'patient-ar-pre-invoice': 2,
  'post-adjudication': 3,
};

const navSections: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Claims', path: '/claims', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
      { label: 'Work Queues', path: '/work-queues', icon: <ViewListIcon sx={{ fontSize: 18 }} /> },
      { label: 'Invoices', path: '/invoices', icon: <RequestQuoteIcon sx={{ fontSize: 18 }} />, invoicing: true },
      { label: 'Remits', path: '/eras', icon: <ReceiptIcon sx={{ fontSize: 18 }} /> },
      { label: 'Patients', path: '/patients', icon: <PeopleIcon sx={{ fontSize: 18 }} /> },
      { label: 'Reports', path: '/reports', icon: <AssessmentIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    title: 'Workflow',
    items: [
      { label: 'Claim Creation Queue', path: '/claim-creation-queue', icon: <ListIcon sx={{ fontSize: 18 }} /> },
      ...[...RULES_ENGINE_TYPES]
        .sort((a, b) => RULES_MENU_POSITION[a] - RULES_MENU_POSITION[b])
        .map((engine) => ({
          label: RULES_ENGINES[engine].label,
          path: `/rules/${engine}`,
          icon: <RuleIcon sx={{ fontSize: 18 }} />,
        })),
    ],
  },
  {
    title: 'Settings',
    defaultCollapsed: true,
    items: [
      {
        label: 'Rendering Providers',
        path: '/rendering-providers',
        icon: <MedicalServicesIcon sx={{ fontSize: 18 }} />,
      },
      { label: 'Billing Providers', path: '/billing-providers', icon: <BusinessIcon sx={{ fontSize: 18 }} /> },
      { label: 'Service Facilities', path: '/service-facilities', icon: <ApartmentIcon sx={{ fontSize: 18 }} /> },
      {
        label: 'Insurance Organizations',
        path: '/insurance-organizations',
        icon: <HealthAndSafetyIcon sx={{ fontSize: 18 }} />,
      },
      {
        label: 'Non-Insurance Organizations',
        path: '/non-insurance-organizations',
        icon: <BusinessCenterIcon sx={{ fontSize: 18 }} />,
      },
      {
        label: ChargeItemDefinitionLabels['charge-master'].listTitle,
        path: `/${ChargeItemDefinitionLabels['charge-master'].pathComponent}`,
        icon: <ListIcon sx={{ fontSize: 18 }} />,
      },
      {
        label: 'Invoicing Configuration',
        path: '/invoicing-configuration',
        icon: <SettingsIcon sx={{ fontSize: 18 }} />,
        invoicing: true,
      },
      {
        label: 'Outreach',
        path: '/outreach-configuration',
        icon: <SettingsIcon sx={{ fontSize: 18 }} />,
        invoicing: true,
        hidden: !FEATURE_FLAGS_CONFIG.automatedPatientOutreachEnabled,
      },
      { label: 'Tags', path: '/tags', icon: <LabelIcon sx={{ fontSize: 18 }} /> },
    ],
  },
];

const isPathActive = (pathname: string, path: string): boolean =>
  pathname === path || (path !== '/' && pathname.startsWith(path));

export const Sidebar: FC = () => {
  const location = useLocation();
  const { logout } = useAuth0();
  const invoicingInBillingApp = useInvoicingInBillingApp();

  const visibleSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.hidden && (!item.invoicing || invoicingInBillingApp)),
  }));

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      navSections.map((section) => [
        section.title,
        !!section.defaultCollapsed && !section.items.some((item) => isPathActive(location.pathname, item.path)),
      ])
    )
  );

  const toggleSection = (title: string): void => setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  const renderNavItem = ({ label, path, icon }: NavItem): ReactElement => {
    const isActive = isPathActive(location.pathname, path);
    return (
      <Link key={path} to={path} style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}>
        <ListItemButton
          selected={isActive}
          sx={{
            borderRadius: 1,
            mb: '1px',
            py: 0.75,
            px: 1.25,
            '&:hover': { bgcolor: otherColors.apptHover },
            '&.Mui-selected': {
              bgcolor: otherColors.apptHover,
              color: 'primary.dark',
              '& .MuiListItemIcon-root': { color: 'primary.dark' },
            },
            '&.Mui-selected:hover': { bgcolor: otherColors.formCardBg },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: isActive ? 'primary.dark' : 'action.disabled' }}>
            {icon}
          </ListItemIcon>
          <ListItemText
            primary={label}
            primaryTypographyProps={{
              fontSize: 13.5,
              fontWeight: isActive ? 500 : 450,
              color: isActive ? 'primary.dark' : 'text.primary',
            }}
          />
        </ListItemButton>
      </Link>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: `1px solid ${otherColors.lightDivider}`,
          bgcolor: 'background.paper',
          position: 'relative',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.25, py: 2.5 }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: 1,
            bgcolor: 'primary.dark',
            display: 'grid',
            placeItems: 'center',
            color: 'primary.contrastText',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          O
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.015em', color: 'primary.dark' }}>
          Ottehr Billing
        </Typography>
      </Box>

      <List sx={{ px: 1.25, flex: 1, overflow: 'auto', minHeight: 0 }}>
        {visibleSections.map(({ title, items }, index) => {
          const isOpen = !collapsed[title];
          const sectionId = `sidebar-section-${title.toLowerCase()}`;
          return (
            <Box key={title} component="li" sx={{ listStyle: 'none', mt: index === 0 ? 0 : 1.5 }}>
              <ListItemButton
                onClick={() => toggleSection(title)}
                aria-expanded={isOpen}
                aria-controls={sectionId}
                sx={{ borderRadius: 1, py: 0.5, px: 1.25, mb: 0.25 }}
              >
                <ListItemText
                  primary={title}
                  primaryTypographyProps={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                />
                {isOpen ? (
                  <ExpandLessIcon sx={{ fontSize: 18, color: 'action.disabled' }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 18, color: 'action.disabled' }} />
                )}
              </ListItemButton>
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List id={sectionId} disablePadding>
                  {items.map(renderNavItem)}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      <List sx={{ px: 1.25 }}>
        <ListItemButton
          onClick={() => void logout({ logoutParams: { returnTo: window.location.origin, federated: true } })}
          sx={{
            borderRadius: 1,
            py: 0.75,
            px: 1.25,
            '&:hover': { bgcolor: otherColors.apptHover },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'action.disabled' }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary="Log out"
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 450, color: 'text.primary' }}
          />
        </ListItemButton>
      </List>
      <Box sx={{ px: 1 }}>
        <Typography variant="caption">Environment: {import.meta.env.VITE_APP_ENV}</Typography>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <Typography variant="caption">Version: {import.meta.env.VITE_APP_VERSION}</Typography>
      </Box>
    </Drawer>
  );
};
