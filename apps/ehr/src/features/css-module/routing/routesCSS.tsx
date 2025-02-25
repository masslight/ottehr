import { RouteCSS } from '../context/NavigationContext';
import { Allergies } from '../pages/Allergies';
import { InHouseMedication } from '../pages/InHouseMedication';
import { InHouseOrderEdit } from '../pages/InHouseOrderEdit';
import { InHouseOrderNew } from '../pages/InHouseOrderNew';
import { MedicalConditions } from '../pages/MedicalConditions';
import { Medications } from '../pages/Medications';
import { PatientInfo } from '../pages/PatientInfo';
import { PatientVitals } from '../pages/PatientVitals';
import { ProgressNote } from '../pages/ProgressNote';
import { Hospitalization } from '../pages/Hospitalization';
import { Screening } from '../pages/Screening';
import { SurgicalHistory } from '../pages/SurgicalHistory';
import { AssessmentCard } from '../../../telemed/features/appointment/AssessmentTab';
import { Plan } from '../pages/Plan';
import { Examination } from '../pages/Examination';
import { ERX } from '../pages/ERX';
// import { SubmitExternalLabOrders } from '../../external-labs/pages/SubmitExternalLabOrders';
// import { OrderDetails } from '../../external-labs/pages/OrderDetails';
// import { ExternalLabOrdersListPage } from '../../external-labs/pages/ExternalLabOrdersListPage';

export enum ROUTER_PATH {
  PROGRESS_NOTE = 'progress-note',
  PATIENT_INFO = 'patient-info',
  SCREENING = 'screening-questions',
  VITALS = 'vitals',
  ALLERGIES = 'allergies',
  MEDICATIONS = 'medications',
  MEDICAL_CONDITIONS = 'medical-conditions',
  SURGICAL_HISTORY = 'surgical-history',
  HOSPITALIZATION = 'hospitalization',
  IN_HOUSE_MEDICATION = 'in-house-medication/:tabName',
  IN_HOUSE_ORDER_NEW = 'in-house-medication/order/new',
  IN_HOUSE_ORDER_EDIT = 'in-house-medication/order/edit/:orderId',
  ASSESSMENT = 'assessment',
  EXAMINATION = 'examination',
  PLAN = 'plan',
  ERX = 'erx',

  // TODO: Uncomment after the module is ready
  // ERX = 'erx',
  // EXTERNAL_LAB_ORDER = 'external-lab-orders',
  // EXTERNAL_LAB_ORDER_CREATE = 'external-lab-orders/create',
  // EXTERNAL_LAB_ORDER_DETAILS = 'external-lab-orders/order-details',
}

export const routesCSS: Record<ROUTER_PATH, RouteCSS> = {
  [ROUTER_PATH.PROGRESS_NOTE]: {
    path: ROUTER_PATH.PROGRESS_NOTE,
    modes: ['provider', 'readonly'],
    element: <ProgressNote />,
    text: 'Progress Note',
    iconKey: 'Progress Note',
  },
  [ROUTER_PATH.PATIENT_INFO]: {
    path: ROUTER_PATH.PATIENT_INFO,
    modes: ['intake', 'readonly'],
    element: <PatientInfo />,
    text: 'Patient',
    iconKey: 'Patient',
  },
  [ROUTER_PATH.SCREENING]: {
    path: ROUTER_PATH.SCREENING,
    modes: ['provider', 'intake', 'readonly'],
    element: <Screening />,
    text: 'Screening',
    iconKey: 'Screening Questions',
  },
  [ROUTER_PATH.VITALS]: {
    path: ROUTER_PATH.VITALS,
    modes: ['provider', 'intake', 'readonly'],
    element: <PatientVitals />,
    text: 'Vitals',
    iconKey: 'Vitals',
  },
  [ROUTER_PATH.ALLERGIES]: {
    path: ROUTER_PATH.ALLERGIES,
    modes: ['provider', 'intake', 'readonly'],
    element: <Allergies />,
    text: 'Allergies',
    iconKey: 'Allergies',
  },
  [ROUTER_PATH.MEDICATIONS]: {
    path: ROUTER_PATH.MEDICATIONS,
    modes: ['provider', 'intake', 'readonly'],
    element: <Medications />,
    text: 'Medications',
    iconKey: 'Medications',
  },
  [ROUTER_PATH.MEDICAL_CONDITIONS]: {
    path: ROUTER_PATH.MEDICAL_CONDITIONS,
    modes: ['provider', 'intake', 'readonly'],
    element: <MedicalConditions />,
    text: 'Medical Conditions',
    iconKey: 'Medical Conditions',
  },
  [ROUTER_PATH.SURGICAL_HISTORY]: {
    path: ROUTER_PATH.SURGICAL_HISTORY,
    modes: ['provider', 'intake', 'readonly'],
    element: <SurgicalHistory />,
    text: 'Surgical History',
    iconKey: 'Surgical History',
  },
  [ROUTER_PATH.HOSPITALIZATION]: {
    path: ROUTER_PATH.HOSPITALIZATION,
    modes: ['provider', 'intake', 'readonly'],
    element: <Hospitalization />,
    text: 'Hospitalization',
    iconKey: 'Hospitalization',
  },
  [ROUTER_PATH.IN_HOUSE_MEDICATION]: {
    path: ROUTER_PATH.IN_HOUSE_MEDICATION,
    sidebarPath: 'in-house-medication/mar',
    activeCheckPath: 'in-house-medication',
    modes: ['provider', 'readonly'],
    element: <InHouseMedication />,
    text: 'In-house Medications',
    iconKey: 'Med. Administration',
  },
  [ROUTER_PATH.IN_HOUSE_ORDER_NEW]: {
    path: ROUTER_PATH.IN_HOUSE_ORDER_NEW,
    modes: ['provider', 'readonly'],
    isSkippedInNavigation: true,
    activeCheckPath: 'order/new',
    element: <InHouseOrderNew />,
    text: 'In-house Medications',
    iconKey: 'Med. Administration',
  },
  [ROUTER_PATH.IN_HOUSE_ORDER_EDIT]: {
    path: ROUTER_PATH.IN_HOUSE_ORDER_EDIT,
    modes: ['provider', 'readonly'],
    isSkippedInNavigation: true,
    activeCheckPath: 'order/edit',
    element: <InHouseOrderEdit />,
    text: 'In-house Medications',
    iconKey: 'Med. Administration',
  },
  [ROUTER_PATH.ERX]: {
    path: ROUTER_PATH.ERX,
    modes: ['provider', 'readonly'],
    element: <ERX />,
    text: 'eRX',
    iconKey: 'eRX',
  },
  [ROUTER_PATH.EXAMINATION]: {
    path: ROUTER_PATH.EXAMINATION,
    modes: ['provider', 'readonly'],
    element: <Examination />,
    text: 'Exam',
    iconKey: 'Stethoscope',
  },
  [ROUTER_PATH.ASSESSMENT]: {
    path: ROUTER_PATH.ASSESSMENT,
    modes: ['provider', 'readonly'],
    element: <AssessmentCard />,
    text: 'Assessment',
    iconKey: 'Prescription',
  },
  [ROUTER_PATH.PLAN]: {
    path: ROUTER_PATH.PLAN,
    modes: ['provider', 'readonly'],
    element: <Plan />,
    text: 'Plan',
    iconKey: 'Lab profile',
  },

  // TODO: Uncomment after the module is ready
  // [ROUTER_PATH.EXTERNAL_LAB_ORDER]: {
  //   path: ROUTER_PATH.EXTERNAL_LAB_ORDER,
  //   modes: ['provider', 'readonly'],
  //   element: <ExternalLabOrdersListPage />,
  //   text: 'Send Out Labs',
  //   iconKey: 'Send Out Labs',
  // },
  // [ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE]: {
  //   path: ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE,
  //   modes: ['provider', 'readonly'],
  //   isSkippedInNavigation: true,
  //   element: <SubmitExternalLabOrders />,
  //   text: 'Order Lab',
  //   iconKey: 'Send Out Labs',
  // },
  // [ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS]: {
  //   path: ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS,
  //   modes: ['provider', 'readonly'],
  //   isSkippedInNavigation: true,
  //   element: <OrderDetails />,
  //   text: 'Order Details',
  //   iconKey: 'Send Out Labs',
  // },
};
