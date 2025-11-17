import { Immunization } from 'src/features/immunization/pages/Immunization';
import { InHouseLabOrderCreatePage } from 'src/features/in-house-labs/pages/InHouseLabOrderCreatePage';
import { InHouseLabTestDetailsPage } from 'src/features/in-house-labs/pages/InHouseLabOrderDetailsPage';
import { InHouseLabsPage } from 'src/features/in-house-labs/pages/InHouseLabsPage';
import { NursingOrderCreatePage } from 'src/features/nursing-orders/pages/NursingOrderCreatePage';
import { NursingOrderDetailsPage } from 'src/features/nursing-orders/pages/NursingOrderDetailsPage';
import { NursingOrdersPage } from 'src/features/nursing-orders/pages/NursingOrdersPage';
import { FEATURE_FLAGS } from '../../../../constants/feature-flags';
import { CreateExternalLabOrder } from '../../../external-labs/pages/CreateExternalLabOrder';
import { ExternalLabOrdersListPage } from '../../../external-labs/pages/ExternalLabOrdersListPage';
import { OrderDetailsPage } from '../../../external-labs/pages/OrderDetails';
import { ImmunizationOrderCreateEdit } from '../../../immunization/pages/ImmunizationOrderCreateEdit';
import { CreateRadiologyOrder } from '../../../radiology/pages/CreateRadiologyOrder';
import { RadiologyOrderDetailsPage } from '../../../radiology/pages/RadiologyOrderDetails';
import { RadiologyOrdersListPage } from '../../../radiology/pages/RadiologyOrdersListPage';
import { AssessmentCard } from '../../shared/components/assessment-tab/AssessmentCard';
import { ExamTab } from '../../shared/components/exam-tab/ExamTab';
import { OttehrAi } from '../../shared/components/OttehrAi';
import { RouteInPerson } from '../context/InPersonNavigationContext';
import { Allergies } from '../pages/Allergies';
import { CCAndIntakeNotes } from '../pages/CCAndIntakeNotes';
import { ERXPage } from '../pages/ERXPage';
import { FollowUpNote } from '../pages/FollowUpNote';
import { HistoryAndTemplates } from '../pages/HistoryAndTemplates';
import { Hospitalization } from '../pages/Hospitalization';
import { InHouseMedication } from '../pages/InHouseMedication';
import { InHouseOrderEdit } from '../pages/InHouseOrderEdit';
import { InHouseOrderNew } from '../pages/InHouseOrderNew';
import { MedicalConditions } from '../pages/MedicalConditions';
import { Medications } from '../pages/Medications';
import { PatientVitals } from '../pages/PatientVitals';
import { Plan } from '../pages/Plan';
import Procedures from '../pages/Procedures';
import ProceduresNew from '../pages/ProceduresNew';
import { ProgressNote } from '../pages/ProgressNote';
import { Screening } from '../pages/Screening';
import { SurgicalHistory } from '../pages/SurgicalHistory';

export enum ROUTER_PATH {
  CC_AND_INTAKE_NOTES = 'cc-and-intake-notes',
  PROGRESS_NOTE = 'progress-note',
  FOLLOW_UP_NOTE = 'follow-up-note',
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
  HISTORY_AND_TEMPLATES = 'history-of-present-illness-and-templates',
  ASSESSMENT = 'assessment',
  EXAMINATION = 'examination',
  PLAN = 'plan',
  ERX = 'erx',
  OTTEHR_AI = 'ottehr-ai',

  EXTERNAL_LAB_ORDER = 'external-lab-orders',
  EXTERNAL_LAB_ORDER_CREATE = `external-lab-orders/create`,
  EXTERNAL_LAB_ORDER_DETAILS = `external-lab-orders/:serviceRequestID/order-details`,
  EXTERNAL_LAB_ORDER_REPORT_DETAILS = `external-lab-orders/report/:diagnosticReportId/order-details`,

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

  IMMUNIZATION = 'immunization/:tabName',
  IMMUNIZATION_ORDER_CREATE = 'immunization/order',
  IMMUNIZATION_ORDER_EDIT = 'immunization/order/:orderId',
}

export const routesInPerson: Record<ROUTER_PATH, RouteInPerson> = {
  [ROUTER_PATH.CC_AND_INTAKE_NOTES]: {
    path: ROUTER_PATH.CC_AND_INTAKE_NOTES,
    modes: ['provider', 'intake', 'readonly'],
    element: <CCAndIntakeNotes />,
    text: 'CC & Intake Notes',
    iconKey: 'CC & Intake Notes',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.SCREENING]: {
    path: ROUTER_PATH.SCREENING,
    modes: ['provider', 'intake', 'readonly'],
    element: <Screening />,
    text: 'Screening Questions',
    iconKey: 'Screening Questions',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.VITALS]: {
    path: ROUTER_PATH.VITALS,
    modes: ['provider', 'intake', 'readonly'],
    element: <PatientVitals />,
    text: 'Vitals',
    iconKey: 'Vitals',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.ALLERGIES]: {
    path: ROUTER_PATH.ALLERGIES,
    modes: ['provider', 'intake', 'readonly', 'follow-up'],
    element: <Allergies />,
    text: 'Allergies',
    iconKey: 'Allergies',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.MEDICATIONS]: {
    path: ROUTER_PATH.MEDICATIONS,
    modes: ['provider', 'intake', 'readonly', 'follow-up'],
    element: <Medications />,
    text: 'Medications',
    iconKey: 'Medications',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.MEDICAL_CONDITIONS]: {
    path: ROUTER_PATH.MEDICAL_CONDITIONS,
    modes: ['provider', 'intake', 'readonly', 'follow-up'],
    element: <MedicalConditions />,
    text: 'Medical Conditions',
    iconKey: 'Medical Conditions',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.SURGICAL_HISTORY]: {
    path: ROUTER_PATH.SURGICAL_HISTORY,
    modes: ['provider', 'intake', 'readonly', 'follow-up'],
    element: <SurgicalHistory />,
    text: 'Surgical History',
    iconKey: 'Surgical History',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.HOSPITALIZATION]: {
    path: ROUTER_PATH.HOSPITALIZATION,
    modes: ['provider', 'intake', 'readonly', 'follow-up'],
    element: <Hospitalization />,
    text: 'Hospitalization',
    iconKey: 'Hospitalization',
    groupLabel: 'Intake',
  },
  [ROUTER_PATH.IN_HOUSE_MEDICATION]: {
    path: ROUTER_PATH.IN_HOUSE_MEDICATION,
    sidebarPath: 'in-house-medication/mar',
    activeCheckPath: 'in-house-medication',
    modes: ['provider', 'readonly', 'follow-up'],
    element: <InHouseMedication />,
    text: 'In-house Medications',
    iconKey: 'Med. Administration',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IN_HOUSE_ORDER_NEW]: {
    path: ROUTER_PATH.IN_HOUSE_ORDER_NEW,
    modes: ['provider', 'readonly', 'follow-up'],
    isSkippedInNavigation: true,
    activeCheckPath: 'order/new',
    element: <InHouseOrderNew />,
    text: 'In-house Medications',
    iconKey: 'Med. Administration',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IN_HOUSE_ORDER_EDIT]: {
    path: ROUTER_PATH.IN_HOUSE_ORDER_EDIT,
    modes: ['provider', 'readonly', 'follow-up'],
    isSkippedInNavigation: true,
    activeCheckPath: 'order/edit',
    element: <InHouseOrderEdit />,
    text: 'In-house Medications',
    iconKey: 'Med. Administration',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IN_HOUSE_LAB_ORDERS]: {
    path: ROUTER_PATH.IN_HOUSE_LAB_ORDERS,
    modes: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    element: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabsPage /> : null,
    text: 'In-House Labs',
    iconKey: 'In-House Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IN_HOUSE_LAB_ORDER_CREATE]: {
    path: ROUTER_PATH.IN_HOUSE_LAB_ORDER_CREATE,
    modes: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabOrderCreatePage /> : null,
    text: 'In-House Labs',
    iconKey: 'In-House Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IN_HOUSE_LAB_ORDER_DETAILS]: {
    path: ROUTER_PATH.IN_HOUSE_LAB_ORDER_DETAILS,
    modes: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabTestDetailsPage /> : null,
    text: 'In-House Labs',
    iconKey: 'In-House Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.RADIOLOGY_ORDER]: {
    path: ROUTER_PATH.RADIOLOGY_ORDER,
    modes: FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    element: FEATURE_FLAGS.RADIOLOGY_ENABLED ? <RadiologyOrdersListPage /> : null,
    text: 'Radiology',
    iconKey: 'Radiology',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.RADIOLOGY_ORDER_CREATE]: {
    path: ROUTER_PATH.RADIOLOGY_ORDER_CREATE,
    modes: FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.RADIOLOGY_ENABLED ? <CreateRadiologyOrder /> : null,
    text: 'Radiology',
    iconKey: 'Radiology',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.RADIOLOGY_ORDER_DETAILS]: {
    path: ROUTER_PATH.RADIOLOGY_ORDER_DETAILS,
    modes: FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.RADIOLOGY_ENABLED ? <RadiologyOrderDetailsPage /> : null,
    text: 'Radiology',
    iconKey: 'Radiology',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.PROCEDURES]: {
    path: ROUTER_PATH.PROCEDURES,
    modes: ['provider', 'follow-up'],
    element: <Procedures />,
    text: 'Procedures',
    iconKey: 'Procedures',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.PROCEDURES_NEW]: {
    path: ROUTER_PATH.PROCEDURES_NEW,
    modes: ['provider', 'follow-up'],
    isSkippedInNavigation: true,
    element: <ProceduresNew />,
    text: 'Document Procedure ',
    iconKey: 'Procedures',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.PROCEDURES_EDIT]: {
    path: ROUTER_PATH.PROCEDURES_EDIT,
    modes: ['provider', 'follow-up'],
    isSkippedInNavigation: true,
    element: <ProceduresNew />,
    text: 'Edit Procedure ',
    iconKey: 'Procedures',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.NURSING_ORDERS]: {
    path: ROUTER_PATH.NURSING_ORDERS,
    modes: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider', 'follow-up'] : [],
    element: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrdersPage /> : null,
    text: 'Nursing Orders',
    iconKey: 'Nursing Orders',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.NURSING_ORDER_CREATE]: {
    path: ROUTER_PATH.NURSING_ORDER_CREATE,
    modes: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrderCreatePage /> : null,
    text: 'Nursing Orders',
    iconKey: 'Nursing Orders',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.NURSING_ORDER_DETAILS]: {
    path: ROUTER_PATH.NURSING_ORDER_DETAILS,
    modes: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrderDetailsPage /> : null,
    text: 'Nursing Orders',
    iconKey: 'Nursing Orders',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IMMUNIZATION]: {
    path: ROUTER_PATH.IMMUNIZATION,
    sidebarPath: 'immunization/mar',
    activeCheckPath: 'immunization',
    modes: ['provider', 'follow-up'],
    element: <Immunization />,
    text: 'Immunization',
    iconKey: 'Immunization',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IMMUNIZATION_ORDER_CREATE]: {
    path: ROUTER_PATH.IMMUNIZATION_ORDER_CREATE,
    modes: ['provider', 'follow-up'],
    isSkippedInNavigation: true,
    element: <ImmunizationOrderCreateEdit />,
    text: 'Immunization',
    iconKey: 'Immunization',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.IMMUNIZATION_ORDER_EDIT]: {
    path: ROUTER_PATH.IMMUNIZATION_ORDER_EDIT,
    modes: ['provider', 'follow-up'],
    isSkippedInNavigation: true,
    element: <ImmunizationOrderCreateEdit />,
    text: 'Immunization',
    iconKey: 'Immunization',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.EXTERNAL_LAB_ORDER]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <ExternalLabOrdersListPage /> : null,
    text: 'External Labs',
    iconKey: 'External Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <CreateExternalLabOrder /> : null,
    text: 'Order External Lab',
    iconKey: 'External Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <OrderDetailsPage /> : null,
    text: 'Order Details',
    iconKey: 'External Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.EXTERNAL_LAB_ORDER_REPORT_DETAILS]: {
    path: ROUTER_PATH.EXTERNAL_LAB_ORDER_REPORT_DETAILS,
    modes: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly', 'follow-up'] : [],
    isSkippedInNavigation: true,
    element: FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <OrderDetailsPage /> : null,
    text: 'Order Details',
    iconKey: 'External Labs',
    groupLabel: 'Actions',
  },
  [ROUTER_PATH.HISTORY_AND_TEMPLATES]: {
    path: ROUTER_PATH.HISTORY_AND_TEMPLATES,
    modes: ['provider', 'readonly'],
    element: <HistoryAndTemplates />,
    text: 'HPI/MOI & Templates',
    iconKey: 'History',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.EXAMINATION]: {
    path: ROUTER_PATH.EXAMINATION,
    modes: ['provider', 'readonly'],
    element: <ExamTab />,
    text: 'Exam',
    iconKey: 'Stethoscope',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.ASSESSMENT]: {
    path: ROUTER_PATH.ASSESSMENT,
    modes: ['provider', 'readonly'],
    element: <AssessmentCard />,
    text: 'Assessment',
    iconKey: 'Prescription',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.PLAN]: {
    path: ROUTER_PATH.PLAN,
    modes: ['provider', 'readonly'],
    element: <Plan />,
    text: 'Plan',
    iconKey: 'Lab profile',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.ERX]: {
    path: ROUTER_PATH.ERX,
    modes: ['provider', 'readonly', 'follow-up'],
    element: <ERXPage />,
    text: 'eRX',
    iconKey: 'eRX',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.PROGRESS_NOTE]: {
    path: ROUTER_PATH.PROGRESS_NOTE,
    modes: ['provider', 'readonly'],
    element: <ProgressNote />,
    text: 'Review & Sign',
    iconKey: 'Review & Sign',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.FOLLOW_UP_NOTE]: {
    path: ROUTER_PATH.FOLLOW_UP_NOTE,
    modes: ['follow-up'],
    element: <FollowUpNote />,
    text: 'Review & Sign',
    iconKey: 'Review & Sign',
    groupLabel: 'Provider',
  },
  [ROUTER_PATH.OTTEHR_AI]: {
    path: ROUTER_PATH.OTTEHR_AI,
    modes: ['intake', 'provider', 'readonly'],
    element: <OttehrAi />,
    text: 'Oystehr AI',
    iconKey: 'Oystehr AI',
    groupLabel: 'Additional Resources',
  },
};
