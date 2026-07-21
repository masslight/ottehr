import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ListOutlinedIcon from '@mui/icons-material/ListOutlined';
import MedicalInformationOutlinedIcon from '@mui/icons-material/MedicalInformationOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PinDropOutlinedIcon from '@mui/icons-material/PinDropOutlined';
import PinOutlinedIcon from '@mui/icons-material/PinOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import { ReactElement, ReactNode } from 'react';
import { PatientEducationAdminPage } from 'src/features/admin/patient-education/PatientEducationAdminPage';
import ProgressNoteAdminPage from 'src/features/admin/ProgressNoteAdminPage';
import ChargeItemList from 'src/features/visits/telemed/components/admin/ChargeItemList';
import EMCodesAdminPage from 'src/features/visits/telemed/components/admin/EMCodesAdminPage';
import EmployersTab from 'src/features/visits/telemed/components/admin/employers/EmployersTab';
import GlobalTemplatesAdminPage from 'src/features/visits/telemed/components/admin/GlobalTemplatesAdminPage';
import InHouseLabAdminPage from 'src/features/visits/telemed/components/admin/in-house-labs/InHouseLabAdminPage';
import InsuranceConfiguration from 'src/features/visits/telemed/components/admin/InsuranceConfiguration';
import LabSetsAdminPage from 'src/features/visits/telemed/components/admin/lab-sets/LabSetsAdminPage';
import AdminPrintingConfig from 'src/features/visits/telemed/components/admin/label-printing-config/AdminLabelPrintingConfigPage';
import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import SupportDialogAdminPage from 'src/features/visits/telemed/components/admin/support-dialog/SupportDialogAdminPage';
import States from 'src/features/visits/telemed/components/admin/VirtualLocationsPage';
import AdminCustomFoldersPage from 'src/pages/AdminCustomFoldersPage';
import MedicationsConfigurationPage from 'src/pages/configuration/MedicationsConfiguration';
import EmployeesPage, { EmployeeTypes } from 'src/pages/Employees';
import { InvoiceablePatients } from 'src/pages/reports/index';
import SchedulesPage from 'src/pages/Schedules';
import ServiceCategoriesAdminPage from 'src/pages/ServiceCategoriesAdminPage';
import Invoicing from 'src/rcm/features/invoicing/Invoicing';
import ScheduledPatientOutreach from 'src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach';
import QuestionnaireAdminPage from '../visits/telemed/components/admin/questionnaires/QuestionnaireAdminPage';
import { PaymentLocationsList } from './BillingConfiguration';
import { FeeSchedulesIcon, InHouseLabsIcon, InsuranceIcon, ProgressNoteIcon, StethoscopeIcon } from './icons';
import PaperworkFlowsAdminPage from './PaperworkFlowsAdminPage';

/** Context derived from the URL that the deeper-nested admin pages still rely on. */
export interface AdminNavContext {
  insuranceTab?: string;
  outreachDetailTab?: string;
}

export interface AdminNavItem {
  /** Sidebar label; also the default page title shown in the shared header. */
  label: string;
  /** Overrides the title shown in the shared header (defaults to {@link label}). */
  title?: string;
  path: string;
  icon: ReactElement;
  /** Render the content as a centered, narrower column — used for form/config pages. */
  centered?: boolean;
  /** Show a "Beta" chip next to the page title in the shared header. */
  beta?: boolean;
  render: (ctx: AdminNavContext) => ReactNode;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: 'Services & Locations',
    items: [
      {
        label: 'Services',
        path: '/admin/services',
        icon: <MedicalInformationOutlinedIcon />,
        render: () => <ServiceCategoriesAdminPage />,
      },
      {
        label: 'Schedules',
        path: '/admin/schedules',
        icon: <CalendarMonthOutlinedIcon />,
        render: () => <SchedulesPage />,
      },
      {
        label: 'Virtual Locations',
        path: '/admin/virtual-locations',
        icon: <PublicOutlinedIcon />,
        render: () => <States />,
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        label: 'Employees',
        path: '/admin/employees',
        icon: <AccountCircleOutlinedIcon />,
        render: () => <EmployeesPage employeeType={EmployeeTypes.employees} />,
      },
      {
        label: 'Providers',
        path: '/admin/providers',
        icon: <StethoscopeIcon />,
        render: () => <EmployeesPage employeeType={EmployeeTypes.providers} />,
      },
    ],
  },
  {
    label: 'Clinical',
    items: [
      {
        label: 'Global Templates',
        path: '/admin/global-templates',
        icon: <HistoryEduOutlinedIcon />,
        render: () => <GlobalTemplatesAdminPage />,
      },
      {
        label: 'Quick Picks',
        path: '/admin/quick-picks',
        icon: <BookmarkBorderOutlinedIcon />,
        render: () => <QuickPicksAdminPage />,
      },
      {
        label: 'In-House Labs',
        path: '/admin/in-house-labs',
        icon: <InHouseLabsIcon />,
        render: () => <InHouseLabAdminPage />,
      },
      {
        label: 'Lab Sets',
        path: '/admin/lab-sets',
        icon: <ListOutlinedIcon />,
        render: () => <LabSetsAdminPage />,
      },
      {
        label: 'In-House Medications',
        path: '/admin/medications',
        icon: <MedicationOutlinedIcon />,
        render: () => <MedicationsConfigurationPage />,
      },
    ],
  },
  {
    label: 'Billing',
    items: [
      {
        label: 'Insurance',
        path: '/admin/billing/insurance',
        icon: <InsuranceIcon />,
        render: (ctx) => <InsuranceConfiguration insuranceTab={ctx.insuranceTab} />,
      },
      {
        label: 'Fee Schedules',
        path: '/admin/billing/fee-schedules',
        icon: <FeeSchedulesIcon />,
        render: () => <ChargeItemList />,
      },
      {
        label: 'Charge Masters',
        path: '/admin/billing/charge-masters',
        icon: <PaidOutlinedIcon />,
        render: () => <ChargeItemList mode="charge-master" />,
      },
      {
        label: 'Employers',
        path: '/admin/billing/employers',
        icon: <BusinessCenterOutlinedIcon />,
        render: () => <EmployersTab />,
      },
      {
        label: 'Payment Locations',
        path: '/admin/billing/payment-locations',
        icon: <PinDropOutlinedIcon />,
        render: () => <PaymentLocationsList />,
      },
      {
        label: 'Invoicing',
        path: '/admin/billing/invoicing',
        icon: <ReceiptLongOutlinedIcon />,
        render: () => <Invoicing />,
      },
      {
        label: 'E&M Codes',
        path: '/admin/billing/em-codes',
        icon: <PinOutlinedIcon />,
        render: () => <EMCodesAdminPage />,
      },
    ],
  },
  {
    label: 'Patient',
    items: [
      {
        label: 'Patient Instructions',
        path: '/admin/patient-education',
        icon: <ArticleOutlinedIcon />,
        render: () => <PatientEducationAdminPage />,
      },
      {
        label: 'Label Printing',
        title: 'Configure Print Settings',
        path: '/admin/label-printing-config',
        icon: <PrintOutlinedIcon />,
        centered: true,
        render: () => <AdminPrintingConfig />,
      },
      {
        label: 'Docs Folders',
        path: '/admin/docs-folders',
        icon: <FolderCopyOutlinedIcon />,
        render: () => <AdminCustomFoldersPage />,
      },
    ],
  },
  {
    label: 'Communications',
    items: [
      {
        label: 'Patient Invoicing',
        path: '/admin/outreach/patient-invoices',
        icon: <EmailOutlinedIcon />,
        render: () => <InvoiceablePatients />,
      },
      {
        label: 'Automated Outreach',
        title: 'Patient Outreach, Collections and Automation',
        beta: true,
        path: '/admin/outreach/patient-outreach',
        icon: <SendOutlinedIcon />,
        render: (ctx) => <ScheduledPatientOutreach outreachTab={ctx.outreachDetailTab} />,
      },
    ],
  },
  {
    label: 'General',
    items: [
      {
        label: 'Support Dialog',
        path: '/admin/support-dialog',
        icon: <SupportAgentOutlinedIcon />,
        centered: true,
        render: () => <SupportDialogAdminPage />,
      },
      {
        label: 'Progress Note',
        path: '/admin/progress-note',
        icon: <ProgressNoteIcon />,
        centered: true,
        render: () => <ProgressNoteAdminPage />,
      },
      {
        label: 'Questionnaires',
        path: '/admin/questionnaires',
        icon: <ListAltIcon />,
        render: () => <QuestionnaireAdminPage />,
      },
      {
        label: 'Paperwork Flows',
        path: '/admin/paperwork-flows',
        icon: <AccountTreeOutlinedIcon />,
        render: () => <PaperworkFlowsAdminPage />,
      },
    ],
  },
];

export const allAdminNavItems: AdminNavItem[] = adminNavGroups.flatMap((group) => group.items);

export const DEFAULT_ADMIN_PATH = allAdminNavItems[0].path;

/** Landing target for bare /admin/billing — the first billing item, tracking nav order. */
export const DEFAULT_BILLING_PATH =
  allAdminNavItems.find((item) => item.path.startsWith('/admin/billing/'))?.path ?? DEFAULT_ADMIN_PATH;

/** Resolve the active nav item from the URL params parsed by the router. */
export function resolveActiveAdminItem(params: {
  adminTab?: string;
  billingTab?: string;
  outreachSubTab?: string;
}): AdminNavItem | undefined {
  const { adminTab, billingTab, outreachSubTab } = params;
  if (!adminTab && !billingTab && !outreachSubTab) {
    return undefined;
  }
  const path = billingTab
    ? `/admin/billing/${billingTab}`
    : outreachSubTab
    ? `/admin/outreach/${outreachSubTab}`
    : `/admin/${adminTab}`;

  return allAdminNavItems.find((item) => item.path === path);
}
