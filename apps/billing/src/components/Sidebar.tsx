import { useAuth0 } from '@auth0/auth0-react';
import {
  AccountBalance as AccountBalanceIcon,
  Apartment as ApartmentIcon,
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  CorporateFare as CorporateFareIcon,
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
  RequestQuote as RequestQuoteIcon,
  Rule as RuleIcon,
  Settings as SettingsIcon,
  Storefront as StorefrontIcon,
  Tune as TuneIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import {
  Box,
  Collapse,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { FC, ReactElement, ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RULES_ENGINE_TYPES, RULES_ENGINES } from 'utils/lib/types/data/billing/rules-engine.constants';
import { ChargeItemDefinitionLabels } from '../constants/chargeItemDefinition';
import { otherColors } from '../themes/ottehr/colors';
import ledgehrLogo from '../themes/ottehr/icons/ledgehr.png';

const DRAWER_WIDTH = 240;

interface NavLeaf {
  label: string;
  path: string;
  icon: ReactNode;
}

interface NavGroup {
  label: string;
  icon: ReactNode;
  children: NavNode[];
}

type NavNode = NavLeaf | NavGroup;

const isGroup = (node: NavNode): node is NavGroup => 'children' in node;

const navTree: NavGroup[] = [
  {
    label: 'Operations',
    icon: <WorkIcon sx={{ fontSize: 18 }} />,
    children: [
      { label: 'Accounts Receivable', path: '/accounts-receivable', icon: <RequestQuoteIcon sx={{ fontSize: 18 }} /> },
      { label: 'Claims', path: '/claims', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
      { label: 'Patients', path: '/patients', icon: <PeopleIcon sx={{ fontSize: 18 }} /> },
      { label: 'Remittances', path: '/eras', icon: <ReceiptIcon sx={{ fontSize: 18 }} /> },
      { label: 'Reports', path: '/reports', icon: <AssessmentIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    label: 'Settings',
    icon: <SettingsIcon sx={{ fontSize: 18 }} />,
    children: [
      {
        label: 'Organizations',
        icon: <CorporateFareIcon sx={{ fontSize: 18 }} />,
        children: [
          {
            label: 'Insurance Organizations',
            path: '/insurance-organizations',
            icon: <HealthAndSafetyIcon sx={{ fontSize: 18 }} />,
          },
          {
            label: 'Non-Insurance Organizations',
            path: '/non-insurance-organizations',
            icon: <StorefrontIcon sx={{ fontSize: 18 }} />,
          },
          { label: 'Billing Organizations', path: '/billing-providers', icon: <BusinessIcon sx={{ fontSize: 18 }} /> },
        ],
      },
      {
        label: 'Rendering Providers',
        path: '/rendering-providers',
        icon: <MedicalServicesIcon sx={{ fontSize: 18 }} />,
      },
      { label: 'Service Facilities', path: '/service-facilities', icon: <ApartmentIcon sx={{ fontSize: 18 }} /> },
      {
        label: ChargeItemDefinitionLabels['charge-master'].listTitle,
        path: `/${ChargeItemDefinitionLabels['charge-master'].pathComponent}`,
        icon: <ListIcon sx={{ fontSize: 18 }} />,
      },
      {
        label: ChargeItemDefinitionLabels['fee-schedule'].listTitle,
        path: `/${ChargeItemDefinitionLabels['fee-schedule'].pathComponent}`,
        icon: <AccountBalanceIcon sx={{ fontSize: 18 }} />,
      },
      { label: 'Tags', path: '/tags', icon: <LabelIcon sx={{ fontSize: 18 }} /> },
      {
        label: 'Rules',
        icon: <TuneIcon sx={{ fontSize: 18 }} />,
        children: RULES_ENGINE_TYPES.map((engine) => ({
          label: RULES_ENGINES[engine].label,
          path: `/rules/${engine}`,
          icon: <RuleIcon sx={{ fontSize: 18 }} />,
        })),
      },
    ],
  },
];

const collectGroupLabels = (nodes: NavNode[]): string[] =>
  nodes.flatMap((node) => (isGroup(node) ? [node.label, ...collectGroupLabels(node.children)] : []));

export const Sidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth0();
  // Every group starts expanded.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(collectGroupLabels(navTree).map((label) => [label, true]))
  );

  const toggleGroup = (label: string): void => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  const renderNode = (node: NavNode, depth: number): ReactElement => {
    const indent = 1.25 + depth * 1.5;

    if (isGroup(node)) {
      const isOpen = expanded[node.label];
      return (
        <Box key={node.label}>
          <ListItemButton
            onClick={() => toggleGroup(node.label)}
            sx={{
              borderRadius: 1,
              mb: '1px',
              py: 0.75,
              px: indent,
              '&:hover': { bgcolor: otherColors.apptHover },
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'action.disabled' }}>{node.icon}</ListItemIcon>
            <ListItemText
              primary={node.label}
              primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600, color: 'text.primary' }}
            />
            {isOpen ? (
              <ExpandLessIcon sx={{ fontSize: 16, color: 'action.disabled' }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16, color: 'action.disabled' }} />
            )}
          </ListItemButton>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List disablePadding>{node.children.map((child) => renderNode(child, depth + 1))}</List>
          </Collapse>
        </Box>
      );
    }

    const { label, path, icon } = node;
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return (
      <ListItemButton
        key={path}
        selected={isActive}
        onClick={() => navigate(path)}
        sx={{
          borderRadius: 1,
          mb: '1px',
          py: 0.75,
          px: indent,
          '&:hover': { bgcolor: otherColors.apptHover },
          '&.Mui-selected': {
            bgcolor: otherColors.apptHover,
            color: 'primary.dark',
            '& .MuiListItemIcon-root': { color: 'primary.dark' },
          },
          '&.Mui-selected:hover': { bgcolor: otherColors.formCardBg },
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: isActive ? 'primary.dark' : 'action.disabled' }}>{icon}</ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontSize: 13.5,
            fontWeight: isActive ? 500 : 450,
            color: isActive ? 'primary.dark' : 'text.primary',
          }}
        />
      </ListItemButton>
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
        <Box component="img" src={ledgehrLogo} alt="LedgEHR logo" sx={{ width: 60, height: 60 }} />
        <Typography sx={{ fontWeight: 500, fontSize: 20, letterSpacing: '0.12em', color: 'primary.dark' }}>
          LEDGEHR
        </Typography>
      </Box>

      <List sx={{ px: 1.25, flex: 1, overflow: 'auto', minHeight: 0 }}>
        {navTree.map((group) => renderNode(group, 0))}
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
