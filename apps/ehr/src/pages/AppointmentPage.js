"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppointmentPage;
var auth0_react_1 = require("@auth0/auth0-react");
var colors_1 = require("@ehrTheme/colors");
var Circle_1 = require("@mui/icons-material/Circle");
var ContentPasteOff_1 = require("@mui/icons-material/ContentPasteOff");
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var WarningAmber_1 = require("@mui/icons-material/WarningAmber");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var Alert_1 = require("@mui/material/Alert");
var Snackbar_1 = require("@mui/material/Snackbar");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("src/api/api");
var useGetPatientDocs_1 = require("src/hooks/useGetPatientDocs");
var utils_1 = require("utils");
var AppointmentNotesHistory_1 = require("../components/AppointmentNotesHistory");
var AppointmentTableRow_1 = require("../components/AppointmentTableRow");
var CardGridItem_1 = require("../components/CardGridItem");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var DateSearch_1 = require("../components/DateSearch");
var dialogs_1 = require("../components/dialogs");
var ImageCarousel_1 = require("../components/ImageCarousel");
var PaperworkFlagIndicator_1 = require("../components/PaperworkFlagIndicator");
var PatientInformation_1 = require("../components/PatientInformation");
var PatientPaymentsList_1 = require("../components/PatientPaymentsList");
var PriorityIconWithBorder_1 = require("../components/PriorityIconWithBorder");
var constants_1 = require("../constants");
var data_test_ids_1 = require("../constants/data-test-ids");
var ChangeStatusDropdown_1 = require("../features/css-module/components/ChangeStatusDropdown");
var helpers_1 = require("../helpers");
var activityLogsUtils_1 = require("../helpers/activityLogsUtils");
var fhir_1 = require("../helpers/fhir");
var files_helper_1 = require("../helpers/files.helper");
var formatDateTime_1 = require("../helpers/formatDateTime");
var useAppClients_1 = require("../hooks/useAppClients");
var useEvolveUser_1 = require("../hooks/useEvolveUser");
var PageContainer_1 = require("../layout/PageContainer");
var telemed_1 = require("../telemed");
var types_1 = require("../types/types");
function getMinutesSinceLastActive(lastActive) {
    return luxon_1.DateTime.now().toUTC().diff(luxon_1.DateTime.fromISO(lastActive).toUTC()).as('minutes');
}
function compareCards(cardBackType) {
    return function (a, b) {
        if (a && b) {
            return a.type === cardBackType ? 1 : -1;
        }
        return 0;
    };
}
var getAnswerStringFor = function (linkId, flattenedItems) {
    var _a, _b, _c;
    var answer = (_c = (_b = (_a = flattenedItems === null || flattenedItems === void 0 ? void 0 : flattenedItems.find(function (response) { return response.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    return answer;
};
var getValueReferenceDisplay = function (linkId, flattenedItems) {
    var _a, _b, _c, _d;
    var answer = (_d = (_c = (_b = (_a = flattenedItems === null || flattenedItems === void 0 ? void 0 : flattenedItems.find(function (response) { return response.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueReference) === null || _d === void 0 ? void 0 : _d.display;
    return answer;
};
var getAnswerBooleanFor = function (linkId, flattenedItems) {
    var _a, _b, _c;
    var answer = (_c = (_b = (_a = flattenedItems === null || flattenedItems === void 0 ? void 0 : flattenedItems.find(function (response) { return response.linkId === linkId; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueBoolean;
    return answer;
};
var LAST_ACTIVE_THRESHOLD = 2; // minutes
var patientPronounsNotListedValues = ['My pronounces are not listed', 'My pronouns are not listed'];
var hipaaPatientDetailsKey = 'I have reviewed and accept HIPAA Acknowledgement';
var consentToTreatPatientDetailsKey = 'I have reviewed and accept Consent to Treat, Guarantee of Payment & Card on File Agreement';
var consentToTreatPatientDetailsKeyOld = 'I have reviewed and accept Consent to Treat and Guarantee of Payment';
function AppointmentPage() {
    var _a;
    var _this = this;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    // variables
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var theme = (0, material_1.useTheme)();
    // state variables
    var _x = (0, react_1.useState)(undefined), resourceBundle = _x[0], setResourceBundle = _x[1];
    var _y = (0, react_1.useState)(undefined), patient = _y[0], setPatient = _y[1];
    var _z = (0, react_1.useState)(undefined), appointment = _z[0], setAppointment = _z[1];
    var _0 = (0, react_1.useState)(undefined), paperworkModifiedFlag = _0[0], setPaperworkModifiedFlag = _0[1];
    var _1 = (0, react_1.useState)(undefined), paperworkInProgressFlag = _1[0], setPaperworkInProgressFlag = _1[1];
    var _2 = (0, react_1.useState)(undefined), paperworkStartedFlag = _2[0], setPaperworkStartedFlag = _2[1];
    var _3 = (0, react_1.useState)(undefined), status = _3[0], setStatus = _3[1];
    var _4 = (0, react_1.useState)({
        editName: false,
        editDOB: false,
    }), errors = _4[0], setErrors = _4[1];
    var _5 = react_1.default.useState(undefined), toastMessage = _5[0], setToastMessage = _5[1];
    var _6 = react_1.default.useState(undefined), toastType = _6[0], setToastType = _6[1];
    var _7 = react_1.default.useState(false), snackbarOpen = _7[0], setSnackbarOpen = _7[1];
    var _8 = react_1.default.useState(false), paperworkPdfLoading = _8[0], setPaperworkPdfLoading = _8[1];
    // Update date of birth modal variables
    var _9 = (0, react_1.useState)(false), confirmDOBModalOpen = _9[0], setConfirmDOBModalOpen = _9[1];
    var _10 = (0, react_1.useState)(null), DOBConfirmed = _10[0], setDOBConfirmed = _10[1];
    var _11 = (0, react_1.useState)(false), updatingDOB = _11[0], setUpdatingDOB = _11[1];
    var _12 = (0, react_1.useState)(true), validDate = _12[0], setValidDate = _12[1];
    // Update patient name modal variables
    var _13 = (0, react_1.useState)(false), updateNameModalOpen = _13[0], setUpdateNameModalOpen = _13[1];
    var _14 = (0, react_1.useState)(false), updatingName = _14[0], setUpdatingName = _14[1];
    var _15 = (0, react_1.useState)(undefined), patientFirstName = _15[0], setPatientFirstName = _15[1];
    var _16 = (0, react_1.useState)(undefined), patientMiddleName = _16[0], setPatientMiddleName = _16[1];
    var _17 = (0, react_1.useState)(undefined), patientLastName = _17[0], setPatientLastName = _17[1];
    var _18 = (0, react_1.useState)(undefined), patientSuffix = _18[0], setPatientSuffix = _18[1];
    // File variables
    var _19 = (0, react_1.useState)(), z3Documents = _19[0], setZ3Documents = _19[1];
    var _20 = (0, react_1.useState)(true), imagesLoading = _20[0], setImagesLoading = _20[1];
    var _21 = (0, react_1.useState)(false), cancelDialogOpen = _21[0], setCancelDialogOpen = _21[1];
    var _22 = (0, react_1.useState)(false), hopQueueDialogOpen = _22[0], setHopQueueDialogOpen = _22[1];
    var _23 = (0, react_1.useState)(false), hopLoading = _23[0], setHopLoading = _23[1];
    var _24 = (0, react_1.useState)(false), photoZoom = _24[0], setPhotoZoom = _24[1];
    var _25 = (0, react_1.useState)(0), zoomedIdx = _25[0], setZoomedIdx = _25[1];
    var _26 = (0, react_1.useState)(true), loading = _26[0], setLoading = _26[1];
    var _27 = (0, react_1.useState)(false), issueDialogOpen = _27[0], setIssueDialogOpen = _27[1];
    var _28 = (0, react_1.useState)(false), activityLogDialogOpen = _28[0], setActivityLogDialogOpen = _28[1];
    var _29 = (0, react_1.useState)(true), activityLogsLoading = _29[0], setActivityLogsLoading = _29[1];
    var _30 = (0, react_1.useState)(undefined), activityLogs = _30[0], setActivityLogs = _30[1];
    var _31 = (0, react_1.useState)(undefined), notesHistory = _31[0], setNotesHistory = _31[1];
    var user = (0, useEvolveUser_1.default)();
    var _32 = (0, useGetPatientDocs_1.useGetPatientDocs)((_b = patient === null || patient === void 0 ? void 0 : patient.id) !== null && _b !== void 0 ? _b : ''), documents = _32.documents, isLoadingDocuments = _32.isLoadingDocuments, downloadDocument = _32.downloadDocument;
    var _33 = (0, react_1.useMemo)(function () {
        var _a;
        var location = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'Location'; });
        var encounter = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'Encounter'; });
        var questionnaireResponse = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; });
        var relatedPerson;
        var fhirRelatedPerson = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'RelatedPerson'; });
        if (fhirRelatedPerson) {
            var isUserRelatedPerson = (_a = fhirRelatedPerson.relationship) === null || _a === void 0 ? void 0 : _a.find(function (relationship) { var _a; return (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.find(function (code) { return code.code === 'user-relatedperson'; }); });
            if (isUserRelatedPerson) {
                relatedPerson = fhirRelatedPerson;
            }
        }
        return { location: location, encounter: encounter, questionnaireResponse: questionnaireResponse, relatedPerson: relatedPerson };
    }, [resourceBundle]), location = _33.location, encounter = _33.encounter, questionnaireResponse = _33.questionnaireResponse, relatedPerson = _33.relatedPerson;
    var appointmentMadeBy = (0, react_1.useMemo)(function () {
        var _a, _b;
        if (!relatedPerson)
            return;
        var telecom = relatedPerson.telecom;
        return (_b = (_a = (telecom !== null && telecom !== void 0 ? telecom : [])
            .find(function (cp) {
            var _a;
            // format starts with +1; this is some lazy but probably good enough validation
            return cp.system === 'sms' && ((_a = cp.value) === null || _a === void 0 ? void 0 : _a.startsWith('+'));
        })) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.replace('+1', '');
    }, [relatedPerson]);
    var fullName = (0, react_1.useMemo)(function () {
        if (patient) {
            return (0, utils_1.getFullName)(patient);
        }
        return '';
    }, [patient]);
    var _34 = (0, react_1.useMemo)(function () {
        var _a, _b, _c, _d;
        var items = (_a = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item) !== null && _a !== void 0 ? _a : [];
        var flattenedItems = (0, utils_1.flattenItems)(items);
        var paymentOption = (_d = (_c = (_b = flattenedItems.find(function (response) { return response.linkId === 'payment-option'; })) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString;
        var selfPay = paymentOption === 'I will pay without insurance';
        var secondaryInsurance = !!flattenedItems.find(function (response) { return response.linkId === 'insurance-carrier-2'; });
        return { flattenedItems: flattenedItems, selfPay: selfPay, secondaryInsurance: secondaryInsurance };
    }, [questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item]), flattenedItems = _34.flattenedItems, selfPay = _34.selfPay, secondaryInsurance = _34.secondaryInsurance;
    var getResourceBundle = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var searchResults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!appointmentID || !oystehr) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                { name: '_id', value: appointmentID },
                                {
                                    name: '_include',
                                    value: 'Appointment:patient',
                                },
                                {
                                    name: '_include',
                                    value: 'Appointment:location',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Encounter:appointment',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'QuestionnaireResponse:encounter',
                                },
                                { name: '_revinclude:iterate', value: 'Flag:encounter' },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'RelatedPerson:patient',
                                },
                            ],
                        })];
                case 1:
                    searchResults = (_a.sent())
                        .unbundle()
                        .filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; });
                    if (!searchResults) {
                        throw new Error('Could not get appointment, patient, location, and encounter resources from Zap DB');
                    }
                    setResourceBundle(searchResults || undefined);
                    setLoading(false);
                    return [2 /*return*/];
            }
        });
    }); }, [appointmentID, oystehr]);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        // Update fields in edit patient name dialog
        if (patient) {
            setPatientFirstName((_c = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[0]);
            setPatientMiddleName((_f = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.name) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.given) === null || _f === void 0 ? void 0 : _f[1]);
            setPatientLastName((_h = (_g = patient === null || patient === void 0 ? void 0 : patient.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.family);
            setPatientSuffix((_l = (_k = (_j = patient === null || patient === void 0 ? void 0 : patient.name) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.suffix) === null || _l === void 0 ? void 0 : _l[0]);
        }
    }, [patient]);
    function handleUpdatePatientName(e) {
        return __awaiter(this, void 0, void 0, function () {
            var patientPatchOps, storedMiddleName, updateTag, storedSuffix, removeStaffUpdateTagOp, updatedPatient, error_1;
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        e.preventDefault();
                        setUpdatingName(true);
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 3, , 4]);
                        if (!(patient === null || patient === void 0 ? void 0 : patient.id)) {
                            throw new Error('Patient ID not found.');
                        }
                        if (!oystehr) {
                            throw new Error('Oystehr client not found.');
                        }
                        patientPatchOps = [
                            {
                                op: 'replace',
                                path: '/name/0/given/0',
                                value: patientFirstName === null || patientFirstName === void 0 ? void 0 : patientFirstName.trim(),
                            },
                            {
                                op: 'replace',
                                path: '/name/0/family',
                                value: patientLastName === null || patientLastName === void 0 ? void 0 : patientLastName.trim(),
                            },
                        ];
                        storedMiddleName = (_c = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[1];
                        if (patientMiddleName && !storedMiddleName) {
                            patientPatchOps.push({
                                op: 'add',
                                path: '/name/0/given/1',
                                value: patientMiddleName === null || patientMiddleName === void 0 ? void 0 : patientMiddleName.trim(),
                            });
                        }
                        else if (!patientMiddleName && storedMiddleName) {
                            patientPatchOps.push({
                                op: 'remove',
                                path: '/name/0/given/1',
                            });
                        }
                        else if (patientMiddleName && storedMiddleName) {
                            patientPatchOps.push({
                                op: 'replace',
                                path: '/name/0/given/1',
                                value: patientMiddleName === null || patientMiddleName === void 0 ? void 0 : patientMiddleName.trim(),
                            });
                        }
                        updateTag = (0, activityLogsUtils_1.getCriticalUpdateTagOp)(patient, "Staff ".concat((user === null || user === void 0 ? void 0 : user.email) ? user.email : "(".concat(user === null || user === void 0 ? void 0 : user.id, ")")));
                        patientPatchOps.push(updateTag);
                        storedSuffix = (_f = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.name) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.suffix) === null || _f === void 0 ? void 0 : _f[0];
                        if (patientSuffix && !storedSuffix) {
                            patientPatchOps.push({
                                op: 'add',
                                path: '/name/0/suffix',
                                value: [patientSuffix],
                            });
                        }
                        else if (!patientSuffix && storedSuffix) {
                            patientPatchOps.push({
                                op: 'remove',
                                path: '/name/0/suffix',
                            });
                        }
                        else if (patientSuffix && storedSuffix) {
                            patientPatchOps.push({
                                op: 'replace',
                                path: '/name/0/suffix',
                                value: [patientSuffix],
                            });
                        }
                        removeStaffUpdateTagOp = (0, activityLogsUtils_1.cleanUpStaffHistoryTag)(patient, 'name');
                        if (removeStaffUpdateTagOp)
                            patientPatchOps.push(removeStaffUpdateTagOp);
                        return [4 /*yield*/, oystehr.fhir.patch({
                                resourceType: 'Patient',
                                id: patient.id,
                                operations: patientPatchOps,
                            })];
                    case 2:
                        updatedPatient = _g.sent();
                        setPatient(updatedPatient);
                        getAndSetHistoricResources({ logs: true }).catch(function (error) {
                            console.log('error getting activity logs after name update', error);
                        });
                        setUpdateNameModalOpen(false);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _g.sent();
                        setErrors({ editName: true });
                        console.log('Failed to update patient name: ', error_1);
                        return [3 /*break*/, 4];
                    case 4:
                        setUpdatingName(false);
                        return [2 /*return*/];
                }
            });
        });
    }
    function handleUpdateDOB(e) {
        return __awaiter(this, void 0, void 0, function () {
            var patchRequests, patientPatchOps, updateTag, removeStaffUpdateTagOp, patientPatch, appointmentExt, dobNotConfirmedIdx, appointmentPatch, bundle, error_2;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        e.preventDefault();
                        setUpdatingDOB(true);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        if (!validDate) {
                            throw new Error('Invalid date.');
                        }
                        if (!(appointment === null || appointment === void 0 ? void 0 : appointment.id) || !(patient === null || patient === void 0 ? void 0 : patient.id)) {
                            throw new Error('Appointment ID or patient ID not found.');
                        }
                        if (!oystehr) {
                            throw new Error('Oystehr client not found.');
                        }
                        patchRequests = [];
                        patientPatchOps = [
                            {
                                op: 'replace',
                                path: '/birthDate',
                                value: DOBConfirmed === null || DOBConfirmed === void 0 ? void 0 : DOBConfirmed.toISODate(),
                            },
                        ];
                        updateTag = (0, activityLogsUtils_1.getCriticalUpdateTagOp)(patient, "Staff ".concat((user === null || user === void 0 ? void 0 : user.email) ? user.email : "(".concat(user === null || user === void 0 ? void 0 : user.id, ")")));
                        patientPatchOps.push(updateTag);
                        removeStaffUpdateTagOp = (0, activityLogsUtils_1.cleanUpStaffHistoryTag)(patient, 'dob');
                        if (removeStaffUpdateTagOp)
                            patientPatchOps.push(removeStaffUpdateTagOp);
                        patientPatch = (0, fhir_1.getPatchBinary)({
                            resourceType: 'Patient',
                            resourceId: patient === null || patient === void 0 ? void 0 : patient.id,
                            patchOperations: patientPatchOps,
                        });
                        patchRequests.push(patientPatch);
                        appointmentExt = appointment === null || appointment === void 0 ? void 0 : appointment.extension;
                        dobNotConfirmedIdx = (0, utils_1.getUnconfirmedDOBIdx)(appointment);
                        if (dobNotConfirmedIdx && dobNotConfirmedIdx >= 0) {
                            appointmentExt === null || appointmentExt === void 0 ? void 0 : appointmentExt.splice(dobNotConfirmedIdx, 1);
                            appointmentPatch = (0, fhir_1.getPatchBinary)({
                                resourceType: 'Appointment',
                                resourceId: appointment === null || appointment === void 0 ? void 0 : appointment.id,
                                patchOperations: [
                                    {
                                        op: 'replace',
                                        path: '/extension',
                                        value: appointmentExt,
                                    },
                                ],
                            });
                            patchRequests.push(appointmentPatch);
                        }
                        return [4 /*yield*/, oystehr.fhir.transaction({
                                requests: patchRequests,
                            })];
                    case 2:
                        bundle = _c.sent();
                        setPatient((_b = (_a = bundle === null || bundle === void 0 ? void 0 : bundle.entry) === null || _a === void 0 ? void 0 : _a.find(function (entry) { return entry.resource.resourceType === 'Patient'; })) === null || _b === void 0 ? void 0 : _b.resource);
                        getAndSetHistoricResources({ logs: true }).catch(function (error) {
                            console.log('error getting activity logs after dob update', error);
                        });
                        setConfirmDOBModalOpen(false);
                        setDOBConfirmed(null);
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _c.sent();
                        setErrors({ editDOB: true });
                        console.log('Failed to update patient DOB: ', error_2);
                        return [3 /*break*/, 4];
                    case 4:
                        setUpdatingDOB(false);
                        return [2 /*return*/];
                }
            });
        });
    }
    function dismissPaperworkModifiedFlag() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!oystehr) {
                            throw new Error('Oystehr client not found.');
                        }
                        return [4 /*yield*/, oystehr.fhir.patch({
                                resourceType: 'Flag',
                                id: (paperworkModifiedFlag === null || paperworkModifiedFlag === void 0 ? void 0 : paperworkModifiedFlag.id) || '',
                                operations: [
                                    {
                                        op: 'replace',
                                        path: '/status',
                                        value: 'inactive',
                                    },
                                ],
                            })];
                    case 1:
                        _a.sent();
                        setPaperworkModifiedFlag(undefined);
                        return [2 /*return*/];
                }
            });
        });
    }
    var hopInQueue = function () { return __awaiter(_this, void 0, void 0, function () {
        var now, operation, updateTag, updatedAppt, errorsCopy, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setHopLoading(true);
                    now = luxon_1.DateTime.now().toISO();
                    if (!((appointment === null || appointment === void 0 ? void 0 : appointment.id) && now)) return [3 /*break*/, 5];
                    operation = (0, utils_1.getPatchOperationForNewMetaTag)(appointment, {
                        system: constants_1.HOP_QUEUE_URI,
                        code: now,
                    });
                    updateTag = (0, activityLogsUtils_1.getCriticalUpdateTagOp)(appointment, "Staff ".concat((user === null || user === void 0 ? void 0 : user.email) ? user.email : "(".concat(user === null || user === void 0 ? void 0 : user.id, ")")));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.patch({
                            resourceType: 'Appointment',
                            id: appointment.id,
                            operations: [operation, updateTag],
                        }))];
                case 2:
                    updatedAppt = _a.sent();
                    setAppointment(updatedAppt);
                    errorsCopy = errors;
                    delete errorsCopy.hopError;
                    setErrors(errorsCopy);
                    setHopQueueDialogOpen(false);
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.log('error hopping queue', e_1);
                    setErrors(__assign(__assign({}, errors), { hopError: 'There was an error moving this appointment to next' }));
                    return [3 /*break*/, 4];
                case 4:
                    setHopLoading(false);
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        // set appointment, patient, and flags
        function setPrimaryResources() {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    setPatient(resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'Patient'; }));
                    setAppointment(resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'Appointment'; }));
                    setPaperworkModifiedFlag(resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) {
                        var _a, _b;
                        return resource.resourceType === 'Flag' &&
                            resource.status === 'active' &&
                            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === 'paperwork-edit'; }));
                    }));
                    setPaperworkInProgressFlag(resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) {
                        var _a, _b, _c;
                        return resource.resourceType === 'Flag' &&
                            resource.status === 'active' &&
                            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === 'paperwork-in-progress'; })) &&
                            ((_c = resource.period) === null || _c === void 0 ? void 0 : _c.start) &&
                            getMinutesSinceLastActive(resource.period.start) <= LAST_ACTIVE_THRESHOLD;
                    }));
                    setPaperworkStartedFlag(resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) {
                        var _a, _b;
                        return resource.resourceType === 'Flag' &&
                            resource.status === 'active' &&
                            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === 'paperwork-in-progress'; }));
                    }));
                    return [2 /*return*/];
                });
            });
        }
        // call the functions
        // add checks to make sure functions only run if values are not set
        if (!resourceBundle && appointmentID && oystehr) {
            getResourceBundle().catch(function (error) {
                console.log(error);
            });
        }
        if (resourceBundle) {
            setPrimaryResources().catch(function (error) {
                console.log(error);
            });
        }
    }, [appointmentID, oystehr, getResourceBundle, resourceBundle]);
    (0, react_1.useEffect)(function () {
        function checkInProgressFlag(encounterID, oystehr) {
            return __awaiter(this, void 0, void 0, function () {
                var flags, inProgressFlag, startedFlag;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, oystehr.fhir.search({
                                resourceType: 'Flag',
                                params: [
                                    {
                                        name: 'encounter',
                                        value: "Encounter/".concat(encounterID),
                                    },
                                    {
                                        name: '_tag',
                                        value: 'paperwork-in-progress',
                                    },
                                    {
                                        name: '_sort',
                                        value: '-date',
                                    },
                                ],
                            })];
                        case 1:
                            flags = (_a.sent()).unbundle();
                            inProgressFlag = flags === null || flags === void 0 ? void 0 : flags.find(function (flag) { var _a; return ((_a = flag.period) === null || _a === void 0 ? void 0 : _a.start) && getMinutesSinceLastActive(flag.period.start) <= LAST_ACTIVE_THRESHOLD; });
                            startedFlag = flags[0];
                            return [2 /*return*/, { startedFlag: startedFlag, inProgressFlag: inProgressFlag }];
                    }
                });
            });
        }
        var interval;
        try {
            interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                var _a, startedFlag, inProgressFlag;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!((encounter === null || encounter === void 0 ? void 0 : encounter.id) && oystehr)) return [3 /*break*/, 2];
                            return [4 /*yield*/, checkInProgressFlag(encounter === null || encounter === void 0 ? void 0 : encounter.id, oystehr)];
                        case 1:
                            _a = _b.sent(), startedFlag = _a.startedFlag, inProgressFlag = _a.inProgressFlag;
                            setPaperworkInProgressFlag(inProgressFlag);
                            if (!paperworkStartedFlag)
                                setPaperworkStartedFlag(startedFlag);
                            _b.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            }); }, 120000);
        }
        catch (err) {
            console.error(err);
        }
        return function () { return clearInterval(interval); };
    }, [encounter === null || encounter === void 0 ? void 0 : encounter.id, oystehr, paperworkStartedFlag]);
    (0, react_1.useEffect)(function () {
        function getFileResources(patientID, appointmentID) {
            return __awaiter(this, void 0, void 0, function () {
                var documentReferenceResources_2, authToken, docRefBundle, bundleEntries, allZ3Documents, _i, documentReferenceResources_1, docRef, docRefCode, _a, _b, content, title, z3Url, presignedUrl, error_3;
                var _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            if (!oystehr) {
                                return [2 /*return*/];
                            }
                            _e.label = 1;
                        case 1:
                            _e.trys.push([1, 10, 11, 12]);
                            setImagesLoading(true);
                            documentReferenceResources_2 = [];
                            return [4 /*yield*/, getAccessTokenSilently()];
                        case 2:
                            authToken = _e.sent();
                            return [4 /*yield*/, oystehr.fhir.batch({
                                    requests: [
                                        {
                                            // Consent
                                            method: 'GET',
                                            url: "/DocumentReference?_sort=-_lastUpdated&subject=Patient/".concat(patientID, "&related=Appointment/").concat(appointmentID),
                                        },
                                        {
                                            // Photo ID & Insurance Cards
                                            method: 'GET',
                                            url: "/DocumentReference?status=current&related=Patient/".concat(patientID),
                                        },
                                    ],
                                })];
                        case 3:
                            docRefBundle = _e.sent();
                            bundleEntries = docRefBundle === null || docRefBundle === void 0 ? void 0 : docRefBundle.entry;
                            bundleEntries === null || bundleEntries === void 0 ? void 0 : bundleEntries.forEach(function (bundleEntry) {
                                var _a;
                                var bundleResource = bundleEntry.resource;
                                (_a = bundleResource.entry) === null || _a === void 0 ? void 0 : _a.forEach(function (entry) {
                                    var docRefResource = entry.resource;
                                    if (docRefResource) {
                                        documentReferenceResources_2.push(docRefResource);
                                    }
                                });
                            });
                            allZ3Documents = [];
                            _i = 0, documentReferenceResources_1 = documentReferenceResources_2;
                            _e.label = 4;
                        case 4:
                            if (!(_i < documentReferenceResources_1.length)) return [3 /*break*/, 9];
                            docRef = documentReferenceResources_1[_i];
                            docRefCode = (_d = (_c = docRef.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code;
                            if (!(docRefCode &&
                                ([utils_1.PHOTO_ID_CARD_CODE, utils_1.CONSENT_CODE, utils_1.PRIVACY_POLICY_CODE].includes(docRefCode) ||
                                    (docRefCode === utils_1.INSURANCE_CARD_CODE && !selfPay)))) return [3 /*break*/, 8];
                            _a = 0, _b = docRef.content;
                            _e.label = 5;
                        case 5:
                            if (!(_a < _b.length)) return [3 /*break*/, 8];
                            content = _b[_a];
                            title = content.attachment.title;
                            z3Url = content.attachment.url;
                            if (!(z3Url && title && Object.values(types_1.DocumentType).includes(title))) return [3 /*break*/, 7];
                            return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(z3Url, authToken)];
                        case 6:
                            presignedUrl = _e.sent();
                            if (presignedUrl) {
                                allZ3Documents.push({
                                    z3Url: z3Url,
                                    presignedUrl: presignedUrl,
                                    type: title,
                                });
                            }
                            _e.label = 7;
                        case 7:
                            _a++;
                            return [3 /*break*/, 5];
                        case 8:
                            _i++;
                            return [3 /*break*/, 4];
                        case 9:
                            setZ3Documents(allZ3Documents);
                            return [3 /*break*/, 12];
                        case 10:
                            error_3 = _e.sent();
                            throw new Error("Failed to get DocumentReferences resources: ".concat(error_3, ". Stringified error: ").concat(JSON.stringify(error_3), " "));
                        case 11:
                            setImagesLoading(false);
                            return [7 /*endfinally*/];
                        case 12: return [2 /*return*/];
                    }
                });
            });
        }
        if ((patient === null || patient === void 0 ? void 0 : patient.id) && appointmentID && oystehr) {
            getFileResources(patient.id, appointmentID).catch(function (error) { return console.log(error); });
        }
    }, [appointmentID, oystehr, getAccessTokenSilently, patient === null || patient === void 0 ? void 0 : patient.id, selfPay]);
    var _35 = (0, react_1.useMemo)(function () {
        var _a, _b, _c;
        var documents = {
            photoIdCards: [],
            insuranceCards: [],
            insuranceCardsSecondary: [],
            fullCardPdfs: [],
            consentPdfUrl: undefined,
            consentPdfUrlOld: undefined,
            hipaaPdfUrl: undefined,
        };
        if (!z3Documents) {
            return documents;
        }
        if (z3Documents.length) {
            documents.photoIdCards = z3Documents
                .filter(function (doc) { return [types_1.DocumentType.PhotoIdFront, types_1.DocumentType.PhotoIdBack].includes(doc.type); })
                .sort(compareCards(types_1.DocumentType.PhotoIdBack));
            documents.insuranceCards = z3Documents
                .filter(function (doc) { return [types_1.DocumentType.InsuranceFront, types_1.DocumentType.InsuranceBack].includes(doc.type); })
                .sort(compareCards(types_1.DocumentType.InsuranceBack));
            documents.insuranceCardsSecondary = z3Documents
                .filter(function (doc) { return [types_1.DocumentType.InsuranceFrontSecondary, types_1.DocumentType.InsuranceBackSecondary].includes(doc.type); })
                .sort(compareCards(types_1.DocumentType.InsuranceBackSecondary));
            documents.fullCardPdfs = z3Documents.filter(function (doc) {
                return [types_1.DocumentType.FullInsurance, types_1.DocumentType.FullInsuranceSecondary, types_1.DocumentType.FullPhotoId].includes(doc.type);
            });
            documents.consentPdfUrl = (_a = z3Documents.find(function (doc) { return doc.type === types_1.DocumentType.CttConsent; })) === null || _a === void 0 ? void 0 : _a.presignedUrl;
            if (!documents.consentPdfUrl) {
                documents.consentPdfUrlOld = (_b = z3Documents.find(function (doc) { return doc.type === types_1.DocumentType.CttConsentOld; })) === null || _b === void 0 ? void 0 : _b.presignedUrl;
            }
            documents.hipaaPdfUrl = (_c = z3Documents.find(function (doc) { return doc.type === types_1.DocumentType.HipaaConsent; })) === null || _c === void 0 ? void 0 : _c.presignedUrl;
        }
        return documents;
    }, [z3Documents]), photoIdCards = _35.photoIdCards, insuranceCards = _35.insuranceCards, insuranceCardsSecondary = _35.insuranceCardsSecondary, fullCardPdfs = _35.fullCardPdfs, consentPdfUrl = _35.consentPdfUrl, consentPdfUrlOld = _35.consentPdfUrlOld, hipaaPdfUrl = _35.hipaaPdfUrl;
    // variables for displaying the page
    var appointmentType = ((_c = appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === null || _c === void 0 ? void 0 : _c.text) || '';
    var locationTimeZone = (0, formatDateTime_1.getTimezone)(location || '');
    var appointmentStartTime = luxon_1.DateTime.fromISO((_d = appointment === null || appointment === void 0 ? void 0 : appointment.start) !== null && _d !== void 0 ? _d : '').setZone(locationTimeZone);
    var appointmentTime = appointmentStartTime.toLocaleString(luxon_1.DateTime.TIME_SIMPLE);
    var appointmentDate = (0, formatDateTime_1.formatDateUsingSlashes)(appointmentStartTime.toISO() || '', locationTimeZone);
    var cityStateZipString = getAnswerStringFor('patient-city', flattenedItems)
        ? "".concat(getAnswerStringFor('patient-city', flattenedItems) || '', ", ").concat(getAnswerStringFor('patient-state', flattenedItems) || '', ", ").concat(getAnswerStringFor('patient-zip', flattenedItems) || '')
        : '';
    var policyHolderCityStateZipString = getAnswerStringFor('patient-city', flattenedItems)
        ? "".concat(getAnswerStringFor('policy-holder-city', flattenedItems) || '', ", ").concat(getAnswerStringFor('policy-holder-state', flattenedItems) || '', ", ").concat(getAnswerStringFor('policy-holder-zip', flattenedItems) || '')
        : '';
    var secondaryPolicyHolderCityStateZipString = getAnswerStringFor('patient-city', flattenedItems)
        ? "".concat(getAnswerStringFor('policy-holder-city-2', flattenedItems) || '', ", ").concat(getAnswerStringFor('policy-holder-state-2', flattenedItems) || '', ", ").concat(getAnswerStringFor('policy-holder-zip-2', flattenedItems) || '')
        : '';
    var nameLastModifiedOld = (0, helpers_1.formatLastModifiedTag)('name', patient, location);
    var dobLastModifiedOld = (0, helpers_1.formatLastModifiedTag)('dob', patient, location);
    var getFullNameString = function (firstNameFieldName, lastNameFieldName, middleNameFieldName
    // suffixFieldName?: string
    ) {
        var firstName = getAnswerStringFor(firstNameFieldName, flattenedItems);
        var lastName = getAnswerStringFor(lastNameFieldName, flattenedItems);
        var middleName = middleNameFieldName ? getAnswerStringFor(middleNameFieldName, flattenedItems) : undefined;
        // const suffix = suffixFieldName ? getAnswerStringFor(suffixFieldName, flattenedItems) : undefined;
        if (firstName && lastName) {
            return "".concat(lastName, ", ").concat(firstName).concat(middleName ? ", ".concat(middleName) : '');
            // return `${lastName}${suffix ? `, ${suffix}` : ''}, ${firstName}${middleName ? `, ${middleName}` : ''}`;
        }
        else {
            return undefined;
        }
    };
    var fullNameResponsiblePartyString = getFullNameString('responsible-party-first-name', 'responsible-party-last-name');
    var policyHolderFullName = getFullNameString('policy-holder-first-name', 'policy-holder-last-name', 'policy-holder-middle-name');
    var secondaryPolicyHolderFullName = getFullNameString('policy-holder-first-name-2', 'policy-holder-last-name-2', 'policy-holder-middle-name-2');
    var pcpNameString = getAnswerStringFor('pcp-first', flattenedItems) && getAnswerStringFor('pcp-last', flattenedItems)
        ? "".concat(getAnswerStringFor('pcp-first', flattenedItems), " ").concat(getAnswerStringFor('pcp-last', flattenedItems))
        : undefined;
    var unconfirmedDOB = appointment && (0, utils_1.getUnconfirmedDOBForAppointment)(appointment);
    var getAppointmentType = function (appointmentType) {
        return (appointmentType && types_1.appointmentTypeLabels[appointmentType]) || '';
    };
    var _36 = (0, react_1.useMemo)(function () {
        var nameLastModified;
        var dobLastModified;
        if (activityLogs) {
            var nameChangelog = activityLogs.find(function (log) { return log.activityName === activityLogsUtils_1.ActivityName.nameChange; });
            if (nameChangelog)
                nameLastModified = "".concat(nameChangelog.activityDateTime, " by ").concat(nameChangelog.activityBy);
            var dobChangeLog = activityLogs.find(function (log) { return log.activityName === activityLogsUtils_1.ActivityName.dobChange; });
            if (dobChangeLog)
                dobLastModified = "".concat(dobChangeLog.activityDateTime, " by ").concat(dobChangeLog.activityBy);
        }
        return { nameLastModified: nameLastModified, dobLastModified: dobLastModified };
    }, [activityLogs]), nameLastModified = _36.nameLastModified, dobLastModified = _36.dobLastModified;
    var getAndSetHistoricResources = (0, react_1.useCallback)(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var history_1, activityLogs_1, formattedNotes;
        var logs = _b.logs, notes = _b.notes;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!appointment) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, activityLogsUtils_1.getAppointmentAndPatientHistory)(appointment, oystehr)];
                case 1:
                    history_1 = _c.sent();
                    if (history_1) {
                        if (logs) {
                            activityLogs_1 = (0, activityLogsUtils_1.formatActivityLogs)(appointment, history_1.appointmentHistory, history_1.patientHistory, paperworkStartedFlag, locationTimeZone);
                            setActivityLogs(activityLogs_1);
                        }
                        if (notes) {
                            formattedNotes = (0, activityLogsUtils_1.formatNotesHistory)(locationTimeZone, history_1.appointmentHistory);
                            setNotesHistory(formattedNotes);
                        }
                    }
                    setActivityLogsLoading(false);
                    _c.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); }, [appointment, oystehr, locationTimeZone, paperworkStartedFlag]);
    (0, react_1.useEffect)(function () {
        if (paperworkStartedFlag) {
            var paperworkStartedActivityLog_1 = (0, activityLogsUtils_1.formatPaperworkStartedLog)(paperworkStartedFlag, locationTimeZone);
            setActivityLogs(function (prevLogs) {
                var logsContainPaperworkStarted = prevLogs === null || prevLogs === void 0 ? void 0 : prevLogs.find(function (log) { return log.activityName === activityLogsUtils_1.ActivityName.paperworkStarted; });
                if (logsContainPaperworkStarted) {
                    return prevLogs;
                }
                else {
                    var activityLogCopy = prevLogs ? __spreadArray([], prevLogs, true) : [];
                    var updatedActivityLogs = __spreadArray([paperworkStartedActivityLog_1], activityLogCopy, true);
                    return (0, activityLogsUtils_1.sortLogs)(updatedActivityLogs);
                }
            });
        }
    }, [locationTimeZone, paperworkStartedFlag]);
    (0, react_1.useEffect)(function () {
        if (!activityLogs && appointment && locationTimeZone && oystehr) {
            getAndSetHistoricResources({ logs: true, notes: true }).catch(function (error) {
                console.log('error getting activity logs', error);
                setActivityLogsLoading(false);
            });
        }
    }, [activityLogs, setActivityLogs, appointment, locationTimeZone, oystehr, getAndSetHistoricResources]);
    (0, react_1.useEffect)(function () {
        if (appointment) {
            var encounterStatus = (0, utils_1.getVisitStatus)(appointment, encounter);
            setStatus(encounterStatus);
        }
        else {
            setStatus(undefined);
        }
    }, [appointment, encounter]);
    // page HTML
    var handleCancelDialogOpen = function () {
        setCancelDialogOpen(true);
    };
    var handleCancelDialogClose = function () {
        setCancelDialogOpen(false);
    };
    function pdfButton(pdfUrl) {
        return (<material_1.Link href={pdfUrl} target="_blank" style={{ marginRight: '10px' }}>
        <material_1.Button variant="outlined" sx={{
                borderColor: colors_1.otherColors.consentBorder,
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 14,
            }}>
          Get PDF
        </material_1.Button>
      </material_1.Link>);
    }
    var consentEditProp = function () {
        var ret = {};
        if (getAnswerBooleanFor('hipaa-acknowledgement', flattenedItems) && hipaaPdfUrl) {
            ret[hipaaPatientDetailsKey] = pdfButton(hipaaPdfUrl);
        }
        if (getAnswerBooleanFor('consent-to-treat', flattenedItems) && consentPdfUrl) {
            ret[consentToTreatPatientDetailsKey] = pdfButton(consentPdfUrl);
        }
        // don't show the old consent pdf if the new one is present
        if (getAnswerBooleanFor('consent-to-treat', flattenedItems) && !consentPdfUrl && consentPdfUrlOld) {
            ret[consentToTreatPatientDetailsKeyOld] = pdfButton(consentPdfUrlOld);
        }
        return ret;
    };
    var signedConsentForm = {};
    if (consentPdfUrl) {
        signedConsentForm[consentToTreatPatientDetailsKey] = imagesLoading ? 'Loading...' : 'Signed';
    }
    else if (consentPdfUrlOld) {
        signedConsentForm[consentToTreatPatientDetailsKeyOld] = imagesLoading ? 'Loading...' : 'Signed';
    }
    else {
        signedConsentForm[consentToTreatPatientDetailsKey] = imagesLoading ? 'Loading...' : 'Not signed';
    }
    // const suffixOptions = ['II', 'III', 'IV', 'Jr', 'Sr'];
    var imageCarouselObjs = (0, react_1.useMemo)(function () { return __spreadArray(__spreadArray(__spreadArray([], insuranceCards.map(function (card) { return ({ alt: card.type, url: card.presignedUrl || '' }); }), true), insuranceCardsSecondary.map(function (card) { return ({ alt: card.type, url: card.presignedUrl || '' }); }), true), photoIdCards.map(function (card) { return ({ alt: card.type, url: card.presignedUrl || '' }); }), true); }, [insuranceCards, insuranceCardsSecondary, photoIdCards]);
    var policyHolderDetails = (0, react_1.useMemo)(function () {
        return {
            'Insurance Carrier': getValueReferenceDisplay('insurance-carrier', flattenedItems),
            'Member ID': getAnswerStringFor('insurance-member-id', flattenedItems),
            "Policy holder's name": policyHolderFullName,
            "Policy holder's date of birth": (0, formatDateTime_1.formatDateUsingSlashes)(getAnswerStringFor('policy-holder-date-of-birth', flattenedItems)),
            "Policy holder's sex": getAnswerStringFor('policy-holder-birth-sex', flattenedItems),
            'Street address': getAnswerStringFor('policy-holder-address', flattenedItems),
            'Address line 2': getAnswerStringFor('policy-holder-address-additional-line', flattenedItems),
            'City, State, ZIP': policyHolderCityStateZipString,
            "Patient's relationship to the insured": getAnswerStringFor('patient-relationship-to-insured', flattenedItems),
        };
    }, [policyHolderFullName, flattenedItems, policyHolderCityStateZipString]);
    var secondaryPolicyHolderDetails = (0, react_1.useMemo)(function () {
        return {
            'Insurance Carrier': getValueReferenceDisplay('insurance-carrier-2', flattenedItems),
            'Member ID': getAnswerStringFor('insurance-member-id-2', flattenedItems),
            "Policy holder's name": secondaryPolicyHolderFullName,
            "Policy holder's date of birth": (0, formatDateTime_1.formatDateUsingSlashes)(getAnswerStringFor('policy-holder-date-of-birth-2', flattenedItems)),
            "Policy holder's sex": getAnswerStringFor('policy-holder-birth-sex-2', flattenedItems),
            'Street address': getAnswerStringFor('policy-holder-address-2', flattenedItems),
            'Address line 2': getAnswerStringFor('policy-holder-address-additional-line-2', flattenedItems),
            'City, State, ZIP': secondaryPolicyHolderCityStateZipString,
            "Patient's relationship to the insured": getAnswerStringFor('patient-relationship-to-insured-2', flattenedItems),
        };
    }, [flattenedItems, secondaryPolicyHolderFullName, secondaryPolicyHolderCityStateZipString]);
    var reasonForVisit = (0, react_1.useMemo)(function () {
        var _a;
        var complaints = ((_a = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _a !== void 0 ? _a : '').split(',');
        return complaints.map(function (complaint) { return complaint.trim(); }).join(', ');
    }, [appointment === null || appointment === void 0 ? void 0 : appointment.description]);
    var downloadPaperworkPdf = function () { return __awaiter(_this, void 0, void 0, function () {
        var existingPaperworkPdf, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setPaperworkPdfLoading(true);
                    existingPaperworkPdf = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
                        return doc.encounterId === encounter.id &&
                            doc.docName.toLowerCase().includes(utils_1.PAPERWORK_PDF_ATTACHMENT_TITLE.toLowerCase());
                    });
                    if (!existingPaperworkPdf) return [3 /*break*/, 2];
                    return [4 /*yield*/, downloadDocument(existingPaperworkPdf.id)];
                case 1:
                    _a.sent();
                    setPaperworkPdfLoading(false);
                    return [2 /*return*/];
                case 2:
                    if (!oystehr || !questionnaireResponse.id) {
                        (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
                        setPaperworkPdfLoading(false);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, api_1.generatePaperworkPdf)(oystehr, {
                            questionnaireResponseId: questionnaireResponse.id,
                            documentReference: {
                                resourceType: 'DocumentReference',
                                status: 'current',
                            },
                        })];
                case 3:
                    response = _a.sent();
                    return [4 /*yield*/, downloadDocument(response.documentReference.split('/')[1])];
                case 4:
                    _a.sent();
                    setPaperworkPdfLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<PageContainer_1.default>
      <>
        {/* Card image zoom dialog */}
        <ImageCarousel_1.default imagesObj={imageCarouselObjs} imageIndex={zoomedIdx} setImageIndex={setZoomedIdx} open={photoZoom} setOpen={setPhotoZoom}/>

        {/* page */}
        <material_1.Grid container direction="row">
          <material_1.Grid item xs={0.25}></material_1.Grid>
          <material_1.Grid item xs={11.5}>
            <material_1.Grid container direction="row">
              <material_1.Grid item xs={6}>
                <CustomBreadcrumbs_1.default chain={[
            { link: "/patient/".concat(patient === null || patient === void 0 ? void 0 : patient.id), children: 'Visit Details' },
            { link: '#', children: (appointment === null || appointment === void 0 ? void 0 : appointment.id) || <material_1.Skeleton width={150}/> },
        ]}/>
              </material_1.Grid>
              <material_1.Grid container xs={6} justifyContent="flex-end">
                <lab_1.LoadingButton variant="outlined" sx={{
            borderRadius: '20px',
            textTransform: 'none',
        }} loading={paperworkPdfLoading} color="primary" disabled={isLoadingDocuments || !(patient === null || patient === void 0 ? void 0 : patient.id)} onClick={downloadPaperworkPdf}>
                  Paperwork PDF
                </lab_1.LoadingButton>
              </material_1.Grid>
            </material_1.Grid>
            {/* page title row */}
            <material_1.Grid container direction="row" marginTop={1}>
              {loading || activityLogsLoading || !patient ? (<material_1.Skeleton aria-busy="true" width={200} height=""/>) : (<>
                  <telemed_1.PencilIconButton onClick={function () { return setUpdateNameModalOpen(true); }} size="25px" sx={{ mr: '7px', padding: 0, alignSelf: 'center' }}/>
                  <material_1.Typography variant="h2" color="primary.dark" data-testid={data_test_ids_1.dataTestIds.appointmentPage.patientFullName}>
                    {fullName}
                  </material_1.Typography>
                </>)}

              <Circle_1.default sx={{ color: 'primary.main', width: '10px', height: '10px', marginLeft: 2, alignSelf: 'center' }}/>
              {/* appointment start time as AM/PM and then date */}
              {loading || !appointment ? (<material_1.Skeleton sx={{ marginLeft: 2 }} aria-busy="true" width={200}/>) : (<>
                  <material_1.Typography variant="body1" sx={{ alignSelf: 'center', marginLeft: 1 }}>
                    {getAppointmentType(appointmentType !== null && appointmentType !== void 0 ? appointmentType : '')}
                  </material_1.Typography>
                  <material_1.Typography sx={{ alignSelf: 'center', marginLeft: 1 }} fontWeight="bold">
                    {appointmentTime}
                  </material_1.Typography>
                  <material_1.Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>{appointmentDate}</material_1.Typography>
                </>)}

              {loading || !status ? (<material_1.Skeleton sx={{ marginLeft: 2 }} aria-busy="true" width={200}/>) : (<>
                  <material_1.Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>{location === null || location === void 0 ? void 0 : location.name}</material_1.Typography>
                  <span style={{
                marginLeft: 20,
                alignSelf: 'center',
            }}>
                    {(0, AppointmentTableRow_1.getAppointmentStatusChip)(status)}
                  </span>
                  {appointment && appointment.status === 'cancelled' && (<material_1.Typography sx={{ alignSelf: 'center', marginLeft: 2 }}>
                      {(_g = (_f = (_e = appointment === null || appointment === void 0 ? void 0 : appointment.cancelationReason) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.display}
                    </material_1.Typography>)}
                </>)}
              {appointment && (appointment === null || appointment === void 0 ? void 0 : appointment.status) !== 'cancelled' ? (<>
                  <material_1.Button data-testid={data_test_ids_1.dataTestIds.visitDetailsPage.cancelVisitButton} variant="outlined" sx={{
                alignSelf: 'center',
                marginLeft: 'auto',
                // marginRight: 2,
                borderRadius: '20px',
                textTransform: 'none',
            }} color="error" onClick={handleCancelDialogOpen}>
                    Cancel visit
                  </material_1.Button>
                  <dialogs_1.CancellationReasonDialog handleClose={handleCancelDialogClose} getResourceBundle={getResourceBundle} appointment={appointment} encounter={encounter} open={cancelDialogOpen} getAndSetResources={getAndSetHistoricResources}/>
                </>) : null}
              {status === 'arrived' ? (<>
                  <material_1.Button variant="outlined" sx={{
                alignSelf: 'center',
                marginLeft: 1,
                borderRadius: '20px',
                textTransform: 'none',
            }} disabled={!!((_k = (_j = (_h = appointment === null || appointment === void 0 ? void 0 : appointment.meta) === null || _h === void 0 ? void 0 : _h.tag) === null || _j === void 0 ? void 0 : _j.find(function (tag) { return tag.system === 'hop-queue'; })) === null || _k === void 0 ? void 0 : _k.code)} onClick={function () { return setHopQueueDialogOpen(true); }}>
                    Move to next
                  </material_1.Button>
                  <dialogs_1.CustomDialog open={hopQueueDialogOpen} handleClose={function () {
                var errorsCopy = errors;
                delete errorsCopy.hopError;
                setErrors(errorsCopy);
                setHopQueueDialogOpen(false);
            }} closeButton={false} title="Move to next" description={"Are you sure you want to move ".concat((_m = (_l = patient === null || patient === void 0 ? void 0 : patient.name) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.family, ", ").concat((_q = (_p = (_o = patient === null || patient === void 0 ? void 0 : patient.name) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.given) === null || _q === void 0 ? void 0 : _q[0], " to next?")} closeButtonText="Cancel" handleConfirm={function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, hopInQueue()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); }} confirmText="Move to next" confirmLoading={hopLoading} error={errors === null || errors === void 0 ? void 0 : errors.hopError}/>
                </>) : null}
            </material_1.Grid>

            {(nameLastModifiedOld || nameLastModified) && (<material_1.Grid container direction="row">
                <material_1.Typography sx={{ alignSelf: 'center', marginLeft: 4, fontSize: '14px' }}>
                  Name Last Modified {nameLastModifiedOld || nameLastModified}
                </material_1.Typography>
              </material_1.Grid>)}

            {paperworkInProgressFlag && (<material_1.Grid container direction="row" marginTop={2}>
                <PaperworkFlagIndicator_1.default title="Paperwork in progress" color={colors_1.otherColors.infoText} backgroundColor={colors_1.otherColors.infoBackground} icon={<InfoOutlined_1.default sx={{ color: colors_1.otherColors.infoIcon }}/>}/>
              </material_1.Grid>)}

            {paperworkModifiedFlag && (<material_1.Grid container direction="row" marginTop={2}>
                <PaperworkFlagIndicator_1.default title="Paperwork was updated:" dateTime={(_r = paperworkModifiedFlag.period) === null || _r === void 0 ? void 0 : _r.start} timezone={locationTimeZone} onDismiss={dismissPaperworkModifiedFlag} color={colors_1.otherColors.warningText} backgroundColor={colors_1.otherColors.warningBackground} icon={<WarningAmber_1.default sx={{ color: colors_1.otherColors.warningIcon }}/>}/>
              </material_1.Grid>)}

            {/* new insurance card and photo id */}
            <material_1.Grid container direction="row" marginTop={2}>
              <material_1.Paper sx={{ width: '100%' }}>
                <material_1.Box padding={3}>
                  {imagesLoading ? (<material_1.Grid container direction="row" maxHeight="210px" height="210px" spacing={2}>
                      <material_1.Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
                        <material_1.CircularProgress sx={{ justifySelf: 'center' }}/>
                      </material_1.Grid>
                    </material_1.Grid>) : (<material_1.Grid container direction="row" rowGap={2} columnSpacing={2} sx={{ display: 'flex' }} minHeight="210px">
                      <>
                        {!selfPay && insuranceCards.length > 0 && (<material_1.Grid item xs={12} sm={6}>
                            <material_1.Grid item>
                              <material_1.Typography color="primary.dark" variant="body2">
                                Primary Insurance Card
                              </material_1.Typography>
                            </material_1.Grid>
                            <material_1.Grid container direction="row" spacing={2}>
                              {insuranceCards.map(function (card, index) { return (<CardGridItem_1.default key={card.type} card={card} index={index} appointmentID={appointmentID} cards={insuranceCards} fullCardPdf={fullCardPdfs.find(function (pdf) { return pdf.type === types_1.DocumentType.FullInsurance; })} setZoomedIdx={setZoomedIdx} setPhotoZoom={setPhotoZoom} title="Download Insurance Card"/>); })}
                            </material_1.Grid>
                          </material_1.Grid>)}
                        {!selfPay && secondaryInsurance && insuranceCardsSecondary.length > 0 && (<material_1.Grid item xs={12} sm={6}>
                            <material_1.Grid item>
                              <material_1.Typography color="primary.dark" variant="body2">
                                Secondary Insurance Card
                              </material_1.Typography>
                            </material_1.Grid>
                            <material_1.Grid container direction="row" spacing={2}>
                              {insuranceCardsSecondary.map(function (card, index) {
                    var offset = insuranceCards.length;
                    return (<CardGridItem_1.default key={card.type} card={card} index={index} offset={offset} appointmentID={appointmentID} cards={insuranceCardsSecondary} fullCardPdf={fullCardPdfs.find(function (pdf) { return pdf.type === types_1.DocumentType.FullInsuranceSecondary; })} setZoomedIdx={setZoomedIdx} setPhotoZoom={setPhotoZoom} title="Download Insurance Card"/>);
                })}
                            </material_1.Grid>
                          </material_1.Grid>)}
                        {photoIdCards.length > 0 && (<material_1.Grid item xs={12} sm={6}>
                            <material_1.Grid item>
                              <material_1.Typography style={{
                    marginLeft: !selfPay && insuranceCards.length ? 10 : 0,
                }} color="primary.dark" variant="body2">
                                Photo ID
                              </material_1.Typography>
                            </material_1.Grid>
                            <material_1.Grid container direction="row" spacing={2}>
                              {photoIdCards.map(function (card, index) {
                    var offset = insuranceCards.length + insuranceCardsSecondary.length;
                    return (<CardGridItem_1.default key={card.type} card={card} index={index} offset={offset} appointmentID={appointmentID} cards={photoIdCards} fullCardPdf={fullCardPdfs.find(function (pdf) { return pdf.type === types_1.DocumentType.FullPhotoId; })} setZoomedIdx={setZoomedIdx} setPhotoZoom={setPhotoZoom} title="Download Photo ID"/>);
                })}
                            </material_1.Grid>
                          </material_1.Grid>)}
                        {!insuranceCards.length && !photoIdCards.length && !insuranceCardsSecondary.length && (<material_1.Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
                            <material_1.Typography variant="h3" color="primary.dark">
                              No images have been uploaded <ContentPasteOff_1.default />
                            </material_1.Typography>
                          </material_1.Grid>)}
                      </>
                    </material_1.Grid>)}
                </material_1.Box>
              </material_1.Paper>
            </material_1.Grid>

            {/* information sections */}
            <material_1.Grid container direction="row">
              <material_1.Grid item xs={12} sm={6} paddingRight={{ xs: 0, sm: 2 }}>
                {/* About the patient */}
                <PatientInformation_1.default title="About the patient" loading={loading} patientDetails={__assign(__assign({}, (unconfirmedDOB
            ? {
                "Patient's date of birth (Original)": (0, formatDateTime_1.formatDateUsingSlashes)(patient === null || patient === void 0 ? void 0 : patient.birthDate),
                "Patient's date of birth (Unmatched)": (0, formatDateTime_1.formatDateUsingSlashes)(unconfirmedDOB),
            }
            : {
                "Patient's date of birth": (0, formatDateTime_1.formatDateUsingSlashes)(patient === null || patient === void 0 ? void 0 : patient.birthDate),
            })), { "Patient's sex": (patient === null || patient === void 0 ? void 0 : patient.gender) ? (0, material_1.capitalize)(patient === null || patient === void 0 ? void 0 : patient.gender) : '', 'Reason for visit': reasonForVisit })} icon={{
            "Patient's date of birth (Unmatched)": <PriorityIconWithBorder_1.PriorityIconWithBorder fill={theme.palette.warning.main}/>,
        }} editValue={{
            "Patient's date of birth (Original)": (<telemed_1.PencilIconButton onClick={function () { return setConfirmDOBModalOpen(true); }} size="16px" sx={{ mr: '5px', padding: '10px' }}/>),
            "Patient's date of birth": (<telemed_1.PencilIconButton onClick={function () { return setConfirmDOBModalOpen(true); }} size="16px" sx={{ mr: '5px', padding: '10px' }}/>),
        }} lastModifiedBy={{ "Patient's date of birth": dobLastModifiedOld || dobLastModified }}/>
                {/* Contact information */}
                <PatientInformation_1.default title="Contact information" loading={loading} patientDetails={{
            'Street address': getAnswerStringFor('patient-street-address', flattenedItems),
            'Address line 2': getAnswerStringFor('patient-street-address-2', flattenedItems),
            'City, State, ZIP': cityStateZipString,
            'Patient email': getAnswerStringFor('patient-email', flattenedItems),
            'Patient mobile': (0, utils_1.formatPhoneNumber)(getAnswerStringFor('patient-number', flattenedItems) || ''),
            'Visit created with phone number': (0, utils_1.formatPhoneNumber)(appointmentMadeBy || ''),
        }}/>
                {/* Patient details */}
                <PatientInformation_1.default title="Patient details" loading={loading} patientDetails={{
            "Patient's ethnicity": getAnswerStringFor('patient-ethnicity', flattenedItems),
            "Patient's race": getAnswerStringFor('patient-race', flattenedItems),
            "Patient's pronouns": patientPronounsNotListedValues.includes(getAnswerStringFor('patient-pronouns', flattenedItems) || '')
                ? getAnswerStringFor('patient-pronouns-custom', flattenedItems)
                : getAnswerStringFor('patient-pronouns', flattenedItems),
            'PCP name': pcpNameString,
            'PCP phone number': (0, utils_1.formatPhoneNumber)(getAnswerStringFor('pcp-number', flattenedItems) || ''),
            'PCP practice name': getAnswerStringFor('pcp-practice', flattenedItems),
            'PCP practice address': getAnswerStringFor('pcp-address', flattenedItems),
            'Pharmacy name': getAnswerStringFor('pharmacy-name', flattenedItems),
            'Pharmacy address': getAnswerStringFor('pharmacy-address', flattenedItems),
            'Pharmacy phone number': (0, utils_1.formatPhoneNumber)(getAnswerStringFor('pharmacy-phone', flattenedItems) || ''),
            'How did you hear about us?': (_t = (_s = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _s === void 0 ? void 0 : _s.find(function (e) { return e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery'; })) === null || _t === void 0 ? void 0 : _t.valueString,
        }}/>
              </material_1.Grid>
              <material_1.Grid item xs={12} sm={6} paddingLeft={{ xs: 0, sm: 2 }}>
                {/* credit cards and copay */}
                {appointmentID && patient && (<PatientPaymentsList_1.default patient={patient} loading={loading} encounterId={(_u = encounter.id) !== null && _u !== void 0 ? _u : ''}/>)}
                {/* Insurance information */}
                {!selfPay && (<PatientInformation_1.default title="Insurance information" loading={loading} patientDetails={policyHolderDetails}/>)}
                {/* Secondary Insurance information */}
                {secondaryInsurance && (<PatientInformation_1.default title="Secondary Insurance information" loading={loading} patientDetails={secondaryPolicyHolderDetails}/>)}
                {/* Responsible party information */}
                <PatientInformation_1.default title="Responsible party information" loading={loading} patientDetails={{
            Relationship: getAnswerStringFor('responsible-party-relationship', flattenedItems),
            'Full name': fullNameResponsiblePartyString,
            'Date of birth': (0, formatDateTime_1.formatDateUsingSlashes)(getAnswerStringFor('responsible-party-date-of-birth', flattenedItems)),
            'Birth sex': getAnswerStringFor('responsible-party-birth-sex', flattenedItems),
            Phone: (0, utils_1.formatPhoneNumber)(getAnswerStringFor('responsible-party-number', flattenedItems) || ''),
        }}/>

                {/* Completed pre-visit forms */}
                <PatientInformation_1.default title="Completed consent forms" loading={loading} editValue={consentEditProp()} patientDetails={__assign(__assign((_a = {}, _a[hipaaPatientDetailsKey] = imagesLoading
            ? 'Loading...'
            : getAnswerBooleanFor('hipaa-acknowledgement', flattenedItems)
                ? 'Signed'
                : 'Not signed', _a), signedConsentForm), { Signature: getAnswerStringFor('signature', flattenedItems), 'Full name': getAnswerStringFor('full-name', flattenedItems), 'Relationship to patient': getAnswerStringFor('consent-form-signer-relationship', flattenedItems), Date: (0, formatDateTime_1.formatDateUsingSlashes)(questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.authored), IP: (_w = (_v = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.extension) === null || _v === void 0 ? void 0 : _v.find(function (e) { return e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'; })) === null || _w === void 0 ? void 0 : _w.valueString })}/>
                {((appointment === null || appointment === void 0 ? void 0 : appointment.comment) || (notesHistory && notesHistory.length > 0)) && (<AppointmentNotesHistory_1.default appointment={appointment} location={location} curNoteAndHistory={notesHistory} user={user} oystehr={oystehr} setAppointment={setAppointment} getAndSetHistoricResources={getAndSetHistoricResources}></AppointmentNotesHistory_1.default>)}
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.Grid>
        <material_1.Grid container direction="row" justifyContent="space-between">
          <material_1.Grid item>
            {loading || !status ? (<material_1.Skeleton sx={{ marginLeft: { xs: 0, sm: 2 } }} aria-busy="true" width={200}/>) : (<div id="user-set-appointment-status">
                <material_1.FormControl size="small" sx={{ marginTop: 2, marginLeft: { xs: 0, sm: 8 } }}>
                  <ChangeStatusDropdown_1.ChangeStatusDropdown appointmentID={appointmentID} onStatusChange={setStatus} getAndSetResources={getAndSetHistoricResources}/>
                </material_1.FormControl>
                {loading && <material_1.CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }}/>}
              </div>)}
          </material_1.Grid>
          <material_1.Grid item sx={{ paddingTop: 2, paddingRight: 3.5 }}>
            <>
              <material_1.Button variant="outlined" sx={{
            alignSelf: 'center',
            marginLeft: { xs: 0, sm: 1 },
            borderRadius: '20px',
            textTransform: 'none',
        }} color="error" onClick={function () { return setIssueDialogOpen(true); }}>
                Report Issue
              </material_1.Button>
              <dialogs_1.ReportIssueDialog open={issueDialogOpen} handleClose={function () { return setIssueDialogOpen(false); }} oystehr={oystehr} patient={patient} appointment={appointment} encounter={encounter} location={location} setSnackbarOpen={setSnackbarOpen} setToastType={setToastType} setToastMessage={setToastMessage}></dialogs_1.ReportIssueDialog>
            </>
          </material_1.Grid>
        </material_1.Grid>
        <material_1.Grid container direction="row">
          <material_1.Grid item sx={{ marginLeft: { xs: 0, sm: 8 }, marginTop: 2, marginBottom: 50 }}>
            <>
              <lab_1.LoadingButton loading={activityLogsLoading} variant="outlined" sx={{
            alignSelf: 'center',
            marginLeft: 'auto',
            borderRadius: '20px',
            textTransform: 'none',
        }} size="medium" color="primary" onClick={function () { return setActivityLogDialogOpen(true); }}>
                View activity logs
              </lab_1.LoadingButton>
              <dialogs_1.ActivityLogDialog open={activityLogDialogOpen} handleClose={function () { return setActivityLogDialogOpen(false); }} logs={activityLogs || []}/>
            </>
          </material_1.Grid>
        </material_1.Grid>
        {/* Update patient name modal */}
        <dialogs_1.EditPatientInfoDialog title="Please enter patient's name" modalOpen={updateNameModalOpen} onClose={function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            setUpdateNameModalOpen(false);
            // reset errors and patient name
            setPatientFirstName((_c = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[0]);
            setPatientMiddleName((_f = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.name) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.given) === null || _f === void 0 ? void 0 : _f[1]);
            setPatientLastName((_h = (_g = patient === null || patient === void 0 ? void 0 : patient.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.family);
            setPatientSuffix((_l = (_k = (_j = patient === null || patient === void 0 ? void 0 : patient.name) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.suffix) === null || _l === void 0 ? void 0 : _l[0]);
            setErrors({ editName: false });
        }} input={<>
              <material_1.TextField label="Last" required fullWidth value={patientLastName} onChange={function (e) { return setPatientLastName(e.target.value.trimStart()); }}/>
              <material_1.TextField label="First" required fullWidth value={patientFirstName} onChange={function (e) { return setPatientFirstName(e.target.value.trimStart()); }} sx={{ mt: 2 }}/>
              <material_1.TextField label="Middle" fullWidth value={patientMiddleName} onChange={function (e) { return setPatientMiddleName(e.target.value.trimStart()); }} sx={{ mt: 2 }}/>
              {/* <Select
              label="Suffix"
              fullWidth
              value={patientSuffix}
              onChange={(e) => setPatientSuffix(e.target.value)}
              sx={{ mt: 2 }}
              defaultValue="Suffix"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {suffixOptions.map((suffix, index) => (
                <MenuItem key={index} value={suffix}>
                  {suffix}
                </MenuItem>
              ))}
            </Select> */}
            </>} onSubmit={handleUpdatePatientName} submitButtonName="Update Patient Name" loading={updatingName} error={errors.editName} errorMessage="Failed to update patient name"/>
        {/* Update DOB modal */}
        <dialogs_1.EditPatientInfoDialog title="Please enter patient's confirmed date of birth" modalOpen={confirmDOBModalOpen} onClose={function () {
            setConfirmDOBModalOpen(false);
            setDOBConfirmed(null);
            setErrors({ editDOB: false });
        }} input={<DateSearch_1.default date={DOBConfirmed} setDate={setDOBConfirmed} setIsValidDate={setValidDate} defaultValue={null} label="Date of birth" required></DateSearch_1.default>} onSubmit={handleUpdateDOB} submitButtonName="Update Date of Birth" loading={updatingDOB} error={errors.editDOB} errorMessage="Failed to update patient date of birth" modalDetails={<material_1.Grid container spacing={2} sx={{ mt: '24px' }}>
              <material_1.Grid container item>
                <material_1.Grid item width="35%">
                  Original DOB:
                </material_1.Grid>
                <material_1.Grid item>{(0, formatDateTime_1.formatDateUsingSlashes)(patient === null || patient === void 0 ? void 0 : patient.birthDate)}</material_1.Grid>
              </material_1.Grid>

              {unconfirmedDOB && (<material_1.Grid container item>
                  <material_1.Grid item width="35%">
                    Unmatched DOB:
                  </material_1.Grid>
                  <material_1.Grid item>{(0, formatDateTime_1.formatDateUsingSlashes)(unconfirmedDOB)}</material_1.Grid>
                </material_1.Grid>)}
            </material_1.Grid>}/>
        <Snackbar_1.default open={snackbarOpen} autoHideDuration={6000} onClose={function () { return setSnackbarOpen(false); }} message={toastMessage}>
          <Alert_1.default onClose={function () { return setSnackbarOpen(false); }} severity={toastType} sx={{ width: '100%' }}>
            {toastMessage}
          </Alert_1.default>
        </Snackbar_1.default>
      </>
    </PageContainer_1.default>);
}
//# sourceMappingURL=AppointmentPage.js.map