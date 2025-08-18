"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.routesCSS = exports.ROUTER_PATH = void 0;
var InHouseLabOrderCreatePage_1 = require("src/features/in-house-labs/pages/InHouseLabOrderCreatePage");
var InHouseLabOrderDetailsPage_1 = require("src/features/in-house-labs/pages/InHouseLabOrderDetailsPage");
var InHouseLabsPage_1 = require("src/features/in-house-labs/pages/InHouseLabsPage");
var NursingOrderCreatePage_1 = require("src/features/nursing-orders/pages/NursingOrderCreatePage");
var NursingOrderDetailsPage_1 = require("src/features/nursing-orders/pages/NursingOrderDetailsPage");
var NursingOrdersPage_1 = require("src/features/nursing-orders/pages/NursingOrdersPage");
var feature_flags_1 = require("../../../constants/feature-flags");
var AssessmentTab_1 = require("../../../telemed/features/appointment/AssessmentTab");
var CreateExternalLabOrder_1 = require("../../external-labs/pages/CreateExternalLabOrder");
var ExternalLabOrdersListPage_1 = require("../../external-labs/pages/ExternalLabOrdersListPage");
var OrderDetails_1 = require("../../external-labs/pages/OrderDetails");
var CreateRadiologyOrder_1 = require("../../radiology/pages/CreateRadiologyOrder");
var RadiologyOrderDetails_1 = require("../../radiology/pages/RadiologyOrderDetails");
var RadiologyOrdersListPage_1 = require("../../radiology/pages/RadiologyOrdersListPage");
var Allergies_1 = require("../pages/Allergies");
var ERXPage_1 = require("../pages/ERXPage");
var Examination_1 = require("../pages/Examination");
var Hospitalization_1 = require("../pages/Hospitalization");
var InHouseMedication_1 = require("../pages/InHouseMedication");
var InHouseOrderEdit_1 = require("../pages/InHouseOrderEdit");
var InHouseOrderNew_1 = require("../pages/InHouseOrderNew");
var MedicalConditions_1 = require("../pages/MedicalConditions");
var Medications_1 = require("../pages/Medications");
var OttehrAi_1 = require("../pages/OttehrAi");
var PatientInfo_1 = require("../pages/PatientInfo");
var PatientVitals_1 = require("../pages/PatientVitals");
var Plan_1 = require("../pages/Plan");
var Procedures_1 = require("../pages/Procedures");
var ProceduresNew_1 = require("../pages/ProceduresNew");
var ProgressNote_1 = require("../pages/ProgressNote");
var Screening_1 = require("../pages/Screening");
var SurgicalHistory_1 = require("../pages/SurgicalHistory");
var ROUTER_PATH;
(function (ROUTER_PATH) {
    ROUTER_PATH["PROGRESS_NOTE"] = "progress-note";
    ROUTER_PATH["PATIENT_INFO"] = "patient-info";
    ROUTER_PATH["SCREENING"] = "screening-questions";
    ROUTER_PATH["VITALS"] = "vitals";
    ROUTER_PATH["ALLERGIES"] = "allergies";
    ROUTER_PATH["MEDICATIONS"] = "medications";
    ROUTER_PATH["MEDICAL_CONDITIONS"] = "medical-conditions";
    ROUTER_PATH["SURGICAL_HISTORY"] = "surgical-history";
    ROUTER_PATH["HOSPITALIZATION"] = "hospitalization";
    ROUTER_PATH["IN_HOUSE_MEDICATION"] = "in-house-medication/:tabName";
    ROUTER_PATH["IN_HOUSE_ORDER_NEW"] = "in-house-medication/order/new";
    ROUTER_PATH["IN_HOUSE_ORDER_EDIT"] = "in-house-medication/order/edit/:orderId";
    ROUTER_PATH["ASSESSMENT"] = "assessment";
    ROUTER_PATH["EXAMINATION"] = "examination";
    ROUTER_PATH["PLAN"] = "plan";
    ROUTER_PATH["ERX"] = "erx";
    ROUTER_PATH["OTTEHR_AI"] = "ottehr-ai";
    ROUTER_PATH["EXTERNAL_LAB_ORDER"] = "external-lab-orders";
    ROUTER_PATH["EXTERNAL_LAB_ORDER_CREATE"] = "external-lab-orders/create";
    ROUTER_PATH["EXTERNAL_LAB_ORDER_DETAILS"] = "external-lab-orders/:serviceRequestID/order-details";
    ROUTER_PATH["RADIOLOGY_ORDER"] = "radiology";
    ROUTER_PATH["RADIOLOGY_ORDER_CREATE"] = "radiology/create";
    ROUTER_PATH["RADIOLOGY_ORDER_DETAILS"] = "radiology/:serviceRequestID/order-details";
    ROUTER_PATH["PROCEDURES"] = "procedures";
    ROUTER_PATH["PROCEDURES_NEW"] = "procedures/new";
    ROUTER_PATH["PROCEDURES_EDIT"] = "procedures/:procedureId";
    ROUTER_PATH["IN_HOUSE_LAB_ORDERS"] = "in-house-lab-orders";
    ROUTER_PATH["IN_HOUSE_LAB_ORDER_CREATE"] = "in-house-lab-orders/create";
    ROUTER_PATH["IN_HOUSE_LAB_ORDER_DETAILS"] = "in-house-lab-orders/:serviceRequestID/order-details";
    ROUTER_PATH["NURSING_ORDERS"] = "nursing-orders";
    ROUTER_PATH["NURSING_ORDER_CREATE"] = "nursing-orders/create";
    ROUTER_PATH["NURSING_ORDER_DETAILS"] = "nursing-orders/:serviceRequestID/order-details";
})(ROUTER_PATH || (exports.ROUTER_PATH = ROUTER_PATH = {}));
exports.routesCSS = (_a = {},
    _a[ROUTER_PATH.PROGRESS_NOTE] = {
        path: ROUTER_PATH.PROGRESS_NOTE,
        modes: ['provider', 'readonly'],
        element: <ProgressNote_1.ProgressNote />,
        text: 'Progress Note',
        iconKey: 'Progress Note',
    },
    _a[ROUTER_PATH.OTTEHR_AI] = {
        path: ROUTER_PATH.OTTEHR_AI,
        modes: ['intake', 'provider', 'readonly'],
        element: <OttehrAi_1.OttehrAi />,
        text: 'Oystehr AI',
        iconKey: 'Oystehr AI',
    },
    _a[ROUTER_PATH.PATIENT_INFO] = {
        path: ROUTER_PATH.PATIENT_INFO,
        modes: ['intake', 'readonly'],
        element: <PatientInfo_1.PatientInfo />,
        text: 'Patient',
        iconKey: 'Patient',
    },
    _a[ROUTER_PATH.SCREENING] = {
        path: ROUTER_PATH.SCREENING,
        modes: ['provider', 'intake', 'readonly'],
        element: <Screening_1.Screening />,
        text: 'Screening',
        iconKey: 'Screening Questions',
    },
    _a[ROUTER_PATH.VITALS] = {
        path: ROUTER_PATH.VITALS,
        modes: ['provider', 'intake', 'readonly'],
        element: <PatientVitals_1.PatientVitals />,
        text: 'Vitals',
        iconKey: 'Vitals',
    },
    _a[ROUTER_PATH.ALLERGIES] = {
        path: ROUTER_PATH.ALLERGIES,
        modes: ['provider', 'intake', 'readonly'],
        element: <Allergies_1.Allergies />,
        text: 'Allergies',
        iconKey: 'Allergies',
    },
    _a[ROUTER_PATH.MEDICATIONS] = {
        path: ROUTER_PATH.MEDICATIONS,
        modes: ['provider', 'intake', 'readonly'],
        element: <Medications_1.Medications />,
        text: 'Medications',
        iconKey: 'Medications',
    },
    _a[ROUTER_PATH.MEDICAL_CONDITIONS] = {
        path: ROUTER_PATH.MEDICAL_CONDITIONS,
        modes: ['provider', 'intake', 'readonly'],
        element: <MedicalConditions_1.MedicalConditions />,
        text: 'Medical Conditions',
        iconKey: 'Medical Conditions',
    },
    _a[ROUTER_PATH.SURGICAL_HISTORY] = {
        path: ROUTER_PATH.SURGICAL_HISTORY,
        modes: ['provider', 'intake', 'readonly'],
        element: <SurgicalHistory_1.SurgicalHistory />,
        text: 'Surgical History',
        iconKey: 'Surgical History',
    },
    _a[ROUTER_PATH.HOSPITALIZATION] = {
        path: ROUTER_PATH.HOSPITALIZATION,
        modes: ['provider', 'intake', 'readonly'],
        element: <Hospitalization_1.Hospitalization />,
        text: 'Hospitalization',
        iconKey: 'Hospitalization',
    },
    _a[ROUTER_PATH.IN_HOUSE_MEDICATION] = {
        path: ROUTER_PATH.IN_HOUSE_MEDICATION,
        sidebarPath: 'in-house-medication/mar',
        activeCheckPath: 'in-house-medication',
        modes: ['provider', 'readonly'],
        element: <InHouseMedication_1.InHouseMedication />,
        text: 'In-house Medications',
        iconKey: 'Med. Administration',
    },
    _a[ROUTER_PATH.IN_HOUSE_ORDER_NEW] = {
        path: ROUTER_PATH.IN_HOUSE_ORDER_NEW,
        modes: ['provider', 'readonly'],
        isSkippedInNavigation: true,
        activeCheckPath: 'order/new',
        element: <InHouseOrderNew_1.InHouseOrderNew />,
        text: 'In-house Medications',
        iconKey: 'Med. Administration',
    },
    _a[ROUTER_PATH.IN_HOUSE_ORDER_EDIT] = {
        path: ROUTER_PATH.IN_HOUSE_ORDER_EDIT,
        modes: ['provider', 'readonly'],
        isSkippedInNavigation: true,
        activeCheckPath: 'order/edit',
        element: <InHouseOrderEdit_1.InHouseOrderEdit />,
        text: 'In-house Medications',
        iconKey: 'Med. Administration',
    },
    _a[ROUTER_PATH.EXTERNAL_LAB_ORDER] = {
        path: ROUTER_PATH.EXTERNAL_LAB_ORDER,
        modes: feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly'] : [],
        element: feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <ExternalLabOrdersListPage_1.ExternalLabOrdersListPage /> : null,
        text: 'External Labs',
        iconKey: 'External Labs',
    },
    _a[ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE] = {
        path: ROUTER_PATH.EXTERNAL_LAB_ORDER_CREATE,
        modes: feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <CreateExternalLabOrder_1.CreateExternalLabOrder /> : null,
        text: 'Order External Lab',
        iconKey: 'External Labs',
    },
    _a[ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS] = {
        path: ROUTER_PATH.EXTERNAL_LAB_ORDER_DETAILS,
        modes: feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED ? ['provider', 'readonly'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED ? <OrderDetails_1.OrderDetailsPage /> : null,
        text: 'Order Details',
        iconKey: 'External Labs',
    },
    _a[ROUTER_PATH.RADIOLOGY_ORDER] = {
        path: ROUTER_PATH.RADIOLOGY_ORDER,
        modes: feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly'] : [],
        element: feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED ? <RadiologyOrdersListPage_1.RadiologyOrdersListPage /> : null,
        text: 'Radiology',
        iconKey: 'Radiology',
    },
    _a[ROUTER_PATH.RADIOLOGY_ORDER_CREATE] = {
        path: ROUTER_PATH.RADIOLOGY_ORDER_CREATE,
        modes: feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED ? <CreateRadiologyOrder_1.CreateRadiologyOrder /> : null,
        text: 'Radiology',
        iconKey: 'Radiology',
    },
    _a[ROUTER_PATH.RADIOLOGY_ORDER_DETAILS] = {
        path: ROUTER_PATH.RADIOLOGY_ORDER_DETAILS,
        modes: feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED ? ['provider', 'readonly'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED ? <RadiologyOrderDetails_1.RadiologyOrderDetailsPage /> : null,
        text: 'Radiology',
        iconKey: 'Radiology',
    },
    _a[ROUTER_PATH.ERX] = {
        path: ROUTER_PATH.ERX,
        modes: ['provider', 'readonly'],
        element: <ERXPage_1.ERXPage />,
        text: 'eRX',
        iconKey: 'eRX',
    },
    _a[ROUTER_PATH.PROCEDURES] = {
        path: ROUTER_PATH.PROCEDURES,
        modes: ['provider'],
        element: <Procedures_1.default />,
        text: 'Procedures',
        iconKey: 'Procedures',
    },
    _a[ROUTER_PATH.PROCEDURES_NEW] = {
        path: ROUTER_PATH.PROCEDURES_NEW,
        modes: ['provider'],
        isSkippedInNavigation: true,
        element: <ProceduresNew_1.default />,
        text: 'Document Procedure ',
        iconKey: 'Procedures',
    },
    _a[ROUTER_PATH.PROCEDURES_EDIT] = {
        path: ROUTER_PATH.PROCEDURES_EDIT,
        modes: ['provider'],
        isSkippedInNavigation: true,
        element: <ProceduresNew_1.default />,
        text: 'Edit Procedure ',
        iconKey: 'Procedures',
    },
    _a[ROUTER_PATH.IN_HOUSE_LAB_ORDERS] = {
        path: ROUTER_PATH.IN_HOUSE_LAB_ORDERS,
        modes: feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly'] : [],
        element: feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabsPage_1.InHouseLabsPage /> : null,
        text: 'In-House Labs',
        iconKey: 'In-House Labs',
    },
    _a[ROUTER_PATH.IN_HOUSE_LAB_ORDER_CREATE] = {
        path: ROUTER_PATH.IN_HOUSE_LAB_ORDER_CREATE,
        modes: feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabOrderCreatePage_1.InHouseLabOrderCreatePage /> : null,
        text: 'In-House Labs',
        iconKey: 'In-House Labs',
    },
    _a[ROUTER_PATH.IN_HOUSE_LAB_ORDER_DETAILS] = {
        path: ROUTER_PATH.IN_HOUSE_LAB_ORDER_DETAILS,
        modes: feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? ['provider', 'readonly'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED ? <InHouseLabOrderDetailsPage_1.InHouseLabTestDetailsPage /> : null,
        text: 'In-House Labs',
        iconKey: 'In-House Labs',
    },
    _a[ROUTER_PATH.NURSING_ORDERS] = {
        path: ROUTER_PATH.NURSING_ORDERS,
        modes: feature_flags_1.FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider'] : [],
        element: feature_flags_1.FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrdersPage_1.NursingOrdersPage /> : null,
        text: 'Nursing Orders',
        iconKey: 'Nursing Orders',
    },
    _a[ROUTER_PATH.NURSING_ORDER_CREATE] = {
        path: ROUTER_PATH.NURSING_ORDER_CREATE,
        modes: feature_flags_1.FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrderCreatePage_1.NursingOrderCreatePage /> : null,
        text: 'Nursing Orders',
        iconKey: 'Nursing Orders',
    },
    _a[ROUTER_PATH.NURSING_ORDER_DETAILS] = {
        path: ROUTER_PATH.NURSING_ORDER_DETAILS,
        modes: feature_flags_1.FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? ['provider'] : [],
        isSkippedInNavigation: true,
        element: feature_flags_1.FEATURE_FLAGS.NURSING_ORDERS_ENABLED ? <NursingOrderDetailsPage_1.NursingOrderDetailsPage /> : null,
        text: 'Nursing Orders',
        iconKey: 'Nursing Orders',
    },
    _a[ROUTER_PATH.EXAMINATION] = {
        path: ROUTER_PATH.EXAMINATION,
        modes: ['provider', 'readonly'],
        element: <Examination_1.Examination />,
        text: 'Exam',
        iconKey: 'Stethoscope',
    },
    _a[ROUTER_PATH.ASSESSMENT] = {
        path: ROUTER_PATH.ASSESSMENT,
        modes: ['provider', 'readonly'],
        element: <AssessmentTab_1.AssessmentCard />,
        text: 'Assessment',
        iconKey: 'Prescription',
    },
    _a[ROUTER_PATH.PLAN] = {
        path: ROUTER_PATH.PLAN,
        modes: ['provider', 'readonly'],
        element: <Plan_1.Plan />,
        text: 'Plan',
        iconKey: 'Lab profile',
    },
    _a);
//# sourceMappingURL=routesCSS.js.map