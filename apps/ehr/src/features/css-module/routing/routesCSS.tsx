import { InHouseLabOrderCreatePage } from 'src/features/in-house-labs/pages/InHouseLabOrderCreatePage';
import { InHouseLabTestDetailsPage } from 'src/features/in-house-labs/pages/InHouseLabOrderDetailsPage';
import { InHouseLabsPage } from 'src/features/in-house-labs/pages/InHouseLabsPage';
import { NursingOrderCreatePage } from 'src/features/nursing-orders/pages/NursingOrderCreatePage';
import { NursingOrderDetailsPage } from 'src/features/nursing-orders/pages/NursingOrderDetailsPage';
import { NursingOrdersPage } from 'src/features/nursing-orders/pages/NursingOrdersPage';
import { FEATURE_FLAGS } from '../../../constants/feature-flags';
import { AssessmentCard } from '../../../telemed/features/appointment/AssessmentTab';
import { CreateExternalLabOrder } from '../../external-labs/pages/CreateExternalLabOrder';
import { ExternalLabOrdersListPage } from '../../external-labs/pages/ExternalLabOrdersListPage';
import { OrderDetailsPage } from '../../external-labs/pages/OrderDetails';
import { CreateRadiologyOrder } from '../../radiology/pages/CreateRadiologyOrder';
import { RadiologyOrderDetailsPage } from '../../radiology/pages/RadiologyOrderDetails';
import { RadiologyOrdersListPage } from '../../radiology/pages/RadiologyOrdersListPage';
import { RouteCSS } from '../context/NavigationContext';
import { Allergies } from '../pages/Allergies';
import { ERXPage } from '../pages/ERXPage';
import { Examination } from '../pages/Examination';
import { Hospitalization } from '../pages/Hospitalization';
import { InHouseMedication } from '../pages/InHouseMedication';
import { InHouseOrderEdit } from '../pages/InHouseOrderEdit';
import { InHouseOrderNew } from '../pages/InHouseOrderNew';
import { MedicalConditions } from '../pages/MedicalConditions';
import { Medications } from '../pages/Medications';
import { OttehrAi } from '../pages/OttehrAi';
import { PatientInfo } from '../pages/PatientInfo';
import { PatientVitals } from '../pages/PatientVitals';
import { Plan } from '../pages/Plan';
import Procedures from '../pages/Procedures';
import ProceduresNew from '../pages/ProceduresNew';
import { ProgressNote } from '../pages/ProgressNote';
import { Screening } from '../pages/Screening';
import { SurgicalHistory } from '../pages/SurgicalHistory';

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
  OTTEHR_AI = 'ottehr-ai',

  EXTERNAL_LAB_ORDER = 'external-lab-orders',
  EXTERNAL_LAB_ORDER_CREATE = `external-lab-orders/create`,
  EXTERNAL_LAB_ORDER_DETAILS = `external-lab-orders/:serviceRequestID/order-details`,

  RADIOLOGY_ORDER = 'radiology',
  RADIOLOGY_ORDER_CREATE = `radiology/create`,
  RADIOLOGY_ORDER_DETAILS = `radiology/:serviceRequestID/order-details`,

  PROCEDURES = 'procedures',
  PROCEDURES_NEW = 'procedures/new',
  PROCEDURES_EDIT = 'procedures/:procedureId',

  IN_HOUSE_LAB_ORDERS = 'in-house-lab-orders',
  IN_HOUSE_LAB_ORDER_CREATE = `in-house-lab-orders/create`,
  IN_HOUSE_LAB_ORDER_DETAILS = `in-house-lab-orders/:serviceRequestID/order-details`,

  NURSING_ORDERS = 'nursing-orders',
  NURSING_ORDER_CREATE = 'nursing-orders/create',
  NURSING_ORDER_DETAILS = 'nursing-orders/:serviceRequestID/order-details',
}

export const routesCSS: Record<ROUTER_PATH, RouteCSS> = {
  [ROUTER_PATH.PROGRESS_NOTE]: {
    path: ROUTER_PATH.PROGRESS_NOTE,
    modes: ['provider', 'readonly'],
    element: <ProgressNote />,
    text: 'Progress Note',
    iconKey: 'Progress Note',
  },
  [ROUTER_PATH.OTTEHR_AI]: {
    path: ROUTER_PATH.OTTEHR_AI,
    modes: ['intake', 'provider', 'readonly'],
    element: <OttehrAi />,
    text: 'Oystehr AI',
    iconKey: 'Oystehr AI',
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
  [ROUTER_PATH.EXTERNAL_LAB_ORDER]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly'] : [],
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <ExternalLabOrdersListPage /> : null,
    text: 'External Labs',
    iconKey: 'External Labs',
  },
  [ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <CreateExternalLabOrder /> : null,
    text: 'Order External Lab',
    iconKey: 'External Labs',
  },
  [ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <OrderDetailsPage /> : null,
    text: 'Order Details',
    iconKey: 'External Labs',
  },
  [ROUTER_PATH.RADIOLOGY_ORDER]: {
    path: ROUTER_PATH.RADIOLOGY_ORDER,
    modes: FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly'] : [],
    element: FEATURE_FLAGS.RADIOLOGY_ENABLED ? <RadiologyOrdersListPage /> : null,
    text: 'Radiology',
    iconKey: 'Radiology',
  },
  [ROUTER_PATH.RADIOLOGY_ORDER_CREATE]: {
    path: ROUTER_PATH.RADIOLOGY_ORDER_CREATE,
    modes: FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.RADIOLOGY_ENABLED ? <CreateRadiologyOrder /> : null,
    text: 'Radiology',
    iconKey: 'Radiology',
  },
  [ROUTER_PATH.RADIOLOGY_ORDER_DETAILS]: {
    path: ROUTER_PATH.RADIOLOGY_ORDER_DETAILS,
    modes: FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.RADIOLOGY_ENABLED ? <RadiologyOrderDetailsPage /> : null,
    text: 'Radiology',
    iconKey: 'Radiology',
  },
  [ROUTER_PATH.ERX]: {
    path: ROUTER_PATH.ERX,
    modes: ['provider', 'readonly'],
    element: <ERXPage />,
    text: 'eRX',
    iconKey: 'eRX',
  },
  [ROUTER_PATH.PROCEDURES]: {
    path: ROUTER_PATH.PROCEDURES,
    modes: ['provider'],
    element: <Procedures />,
    text: 'Procedures',
    iconKey: 'Procedures',
  },
  [ROUTER_PATH.PROCEDURES_NEW]: {
    path: ROUTER_PATH.PROCEDURES_NEW,
    modes: ['provider'],
    isSkippedInNavigation: true,
    element: <ProceduresNew />,
    text: 'Document Procedure ',
    iconKey: 'Procedures',
  },
  [ROUTER_PATH.PROCEDURES_EDIT]: {
    path: ROUTER_PATH.PROCEDURES_EDIT,
    modes: ['provider'],
    isSkippedInNavigation: true,
    element: <ProceduresNew />,
    text: 'Edit Procedure ',
    iconKey: 'Procedures',
  },
  [ROUTER_PATH.IN_HOUSE_LAB_ORDERS]: {
    path: ROUTER_PATH.IN_HOUSE_LAB_ORDERS,
    modes: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly'] : [],
    element: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabsPage /> : null,
    text: 'In-House Labs',
    iconKey: 'In-House Labs',
  },
  [ROUTER_PATH.IN_HOUSE_LAB_ORDER_CREATE]: {
    path: ROUTER_PATH.IN_HOUSE_LAB_ORDER_CREATE,
    modes: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabOrderCreatePage /> : null,
    text: 'In-House Labs',
    iconKey: 'In-House Labs',
  },
  [ROUTER_PATH.IN_HOUSE_LAB_ORDER_DETAILS]: {
    path: ROUTER_PATH.IN_HOUSE_LAB_ORDER_DETAILS,
    modes: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabTestDetailsPage /> : null,
    text: 'In-House Labs',
    iconKey: 'In-House Labs',
  },
  [ROUTER_PATH.NURSING_ORDERS]: {
    path: ROUTER_PATH.NURSING_ORDERS,
    modes: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider'] : [],
    element: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrdersPage /> : null,
    text: 'Nursing Orders',
    iconKey: 'Nursing Orders',
  },
  [ROUTER_PATH.NURSING_ORDER_CREATE]: {
    path: ROUTER_PATH.NURSING_ORDER_CREATE,
    modes: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrderCreatePage /> : null,
    text: 'Nursing Orders',
    iconKey: 'Nursing Orders',
  },
  [ROUTER_PATH.NURSING_ORDER_DETAILS]: {
    path: ROUTER_PATH.NURSING_ORDER_DETAILS,
    modes: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrderDetailsPage /> : null,
    text: 'Nursing Orders',
    iconKey: 'Nursing Orders',
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
};
