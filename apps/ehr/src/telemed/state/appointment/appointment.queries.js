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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGetMedicationList = exports.useGetMedicationOrders = exports.useCreateUpdateMedicationOrder = exports.useGetInsurancePlan = exports.useCheckPractitionerEnrollment = exports.useEnrollPractitionerToERX = exports.useConnectPractitionerToERX = exports.useSyncERXPatient = exports.useDeletePatientInstruction = exports.useSavePatientInstruction = exports.useGetPatientInstructions = exports.useUpdatePaperwork = exports.useGetIcd10Search = exports.useGetCreateExternalLabResources = exports.useGetAllergiesSearch = exports.useGetMedicationsSearch = exports.useDeleteChartData = exports.useSaveChartData = exports.useGetChartData = exports.CHART_DATA_QUERY_KEY_BASE = exports.useGetMeetingData = exports.useGetTelemedAppointmentWithSMSModel = exports.useGetDocumentReferences = exports.useGetAppointment = exports.useGetTelemedAppointmentPeriodicRefresh = exports.useRefreshableAppointmentData = exports.useGetReviewAndSignData = void 0;
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var constants_1 = require("../../../constants");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var hooks_1 = require("../../hooks");
var useOystehrAPIClient_1 = require("../../hooks/useOystehrAPIClient");
var utils_2 = require("../../utils");
var appointment_store_1 = require("./appointment.store");
var useGetReviewAndSignData = function (_a, onSuccess) {
    var appointmentId = _a.appointmentId, runImmediately = _a.runImmediately;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['telemed-appointment-review-and-sign', { appointmentId: appointmentId }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehr && appointmentId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                { name: '_id', value: appointmentId },
                                { name: '_revinclude:iterate', value: 'Encounter:appointment' },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('Oystehr client not defined or appointmentId not provided');
            }
        });
    }); }, {
        enabled: runImmediately,
        onSuccess: function (data) {
            var reviewAndSignData = (0, utils_2.extractReviewAndSignAppointmentData)(data);
            onSuccess(reviewAndSignData);
        },
        onError: function (err) {
            console.error('Error during fetching get telemed appointment: ', err);
        },
    });
};
exports.useGetReviewAndSignData = useGetReviewAndSignData;
var useRefreshableAppointmentData = function (_a, onSuccess
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var appointmentId = _a.appointmentId, isEnabled = _a.isEnabled;
    return (0, exports.useGetTelemedAppointmentPeriodicRefresh)({
        appointmentId: appointmentId,
        isEnabled: isEnabled,
        refreshIntervalMs: constants_1.APPOINTMENT_REFRESH_INTERVAL,
    }, function (originalData) {
        var refreshedData = (0, utils_2.createRefreshableAppointmentData)(originalData);
        onSuccess(refreshedData);
    });
};
exports.useRefreshableAppointmentData = useRefreshableAppointmentData;
var useGetTelemedAppointmentPeriodicRefresh = function (_a, onSuccess
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var appointmentId = _a.appointmentId, isEnabled = _a.isEnabled, refreshIntervalMs = _a.refreshIntervalMs;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var refetchOptions = refreshIntervalMs ? { refetchInterval: refreshIntervalMs } : {};
    return (0, react_query_1.useQuery)(['telemed-appointment-periodic-refresh', { appointmentId: appointmentId }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehr && appointmentId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                { name: '_id', value: appointmentId },
                                { name: '_revinclude', value: 'DocumentReference:related' },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('fhir client not defined or appointmentId not provided');
            }
        });
    }); }, __assign(__assign({}, refetchOptions), { enabled: isEnabled && Boolean(appointmentId) && Boolean(oystehr), onSuccess: onSuccess, onError: function (err) {
            console.error('Error during fetching get telemed appointment periodic: ', err);
        } }));
};
exports.useGetTelemedAppointmentPeriodicRefresh = useGetTelemedAppointmentPeriodicRefresh;
var useGetAppointment = function (_a, onSuccess) {
    var appointmentId = _a.appointmentId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var query = (0, react_query_1.useQuery)(['telemed-appointment', { appointmentId: appointmentId }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehr && appointmentId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                { name: '_id', value: appointmentId },
                                {
                                    name: '_include',
                                    value: 'Appointment:patient',
                                },
                                {
                                    name: '_include',
                                    value: 'Appointment:location',
                                },
                                {
                                    name: '_include:iterate',
                                    value: 'Encounter:participant:Practitioner',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Encounter:appointment',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'QuestionnaireResponse:encounter',
                                },
                                { name: '_revinclude', value: 'DocumentReference:related' },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent())
                        .unbundle()
                        .filter(function (resource) {
                        var _a, _b;
                        return resource.resourceType !== 'QuestionnaireResponse' ||
                            ((_a = resource.questionnaire) === null || _a === void 0 ? void 0 : _a.includes('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson')) ||
                            ((_b = resource.questionnaire) === null || _b === void 0 ? void 0 : _b.includes('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-virtual'));
                    })];
                case 2: throw new Error('fhir client not defined or appointmentId not provided');
            }
        });
    }); }, {
        enabled: Boolean(oystehr) && Boolean(appointmentId),
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get telemed appointment: ', err);
        },
    });
    var isFetching = query.isFetching;
    (0, react_1.useEffect)(function () {
        appointment_store_1.useAppointmentStore.setState({ isAppointmentLoading: isFetching });
    }, [isFetching]);
    return query;
};
exports.useGetAppointment = useGetAppointment;
var useGetDocumentReferences = function (_a, onSuccess
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var appointmentId = _a.appointmentId, patientId = _a.patientId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['telemed-appointment-documents', { appointmentId: appointmentId }], function () {
        if (oystehr && appointmentId && patientId) {
            return oystehr.fhir.batch({
                requests: [
                    {
                        method: 'GET',
                        url: "/DocumentReference?status=current&subject=Patient/".concat(patientId, "&related=Appointment/").concat(appointmentId),
                    },
                ],
            });
        }
        throw new Error('fhir client not defined or appointmentId and patientId not provided 3');
    }, {
        enabled: Boolean(oystehr) && Boolean(appointmentId),
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get telemed appointment related documents: ', err);
        },
    });
};
exports.useGetDocumentReferences = useGetDocumentReferences;
var useGetTelemedAppointmentWithSMSModel = function (_a, onSuccess) {
    var appointmentId = _a.appointmentId, patientId = _a.patientId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['telemed-appointment-messaging', { appointmentId: appointmentId }], function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointmentResources, appointment, allRelatedPersonMaps, smsModel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehr && appointmentId)) return [3 /*break*/, 3];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                { name: '_id', value: appointmentId },
                                {
                                    name: '_include',
                                    value: 'Appointment:patient',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'RelatedPerson:patient',
                                },
                            ],
                        })];
                case 1:
                    appointmentResources = (_a.sent()).unbundle();
                    appointment = (0, utils_1.filterResources)(appointmentResources, 'Appointment')[0];
                    return [4 /*yield*/, (0, utils_1.relatedPersonAndCommunicationMaps)(oystehr, appointmentResources)];
                case 2:
                    allRelatedPersonMaps = _a.sent();
                    smsModel = (0, utils_1.createSmsModel)(patientId, allRelatedPersonMaps);
                    return [2 /*return*/, __assign(__assign({}, appointment), { smsModel: smsModel })];
                case 3: throw new Error('fhir client is not defined or appointmentId and patientId are not provided');
            }
        });
    }); }, {
        refetchInterval: constants_1.CHAT_REFETCH_INTERVAL,
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching appointment or creating SMS model: ', err);
        },
        enabled: !!oystehr && !!appointmentId,
    });
};
exports.useGetTelemedAppointmentWithSMSModel = useGetTelemedAppointmentWithSMSModel;
var useGetMeetingData = function (getAccessTokenSilently, onSuccess, onError
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    return (0, react_query_1.useQuery)(['meeting-data'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, token, videoTokenResp, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appointment = appointment_store_1.useAppointmentStore.getState();
                    return [4 /*yield*/, getAccessTokenSilently()];
                case 1:
                    token = _a.sent();
                    if (!(appointment.encounter.id && token)) return [3 /*break*/, 4];
                    return [4 /*yield*/, fetch("".concat(import.meta.env.VITE_APP_PROJECT_API_URL, "/telemed/v2/meeting/").concat(appointment.encounter.id, "/join"), {
                            headers: {
                                Authorization: "Bearer ".concat(token),
                            },
                            method: 'GET',
                        })];
                case 2:
                    videoTokenResp = _a.sent();
                    return [4 /*yield*/, videoTokenResp.json()];
                case 3:
                    data = _a.sent();
                    if (!videoTokenResp.ok) {
                        throw new Error('Error trying to get meeting data for appointment: ' + JSON.stringify(data));
                    }
                    return [2 /*return*/, data];
                case 4: throw new Error('token or encounterId not provided');
            }
        });
    }); }, {
        enabled: false,
        onSuccess: onSuccess,
        onError: onError,
    });
};
exports.useGetMeetingData = useGetMeetingData;
exports.CHART_DATA_QUERY_KEY_BASE = 'telemed-get-chart-data';
var useGetChartData = function (_a, onSuccess, onError
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var apiClient = _a.apiClient, encounterId = _a.encounterId, requestedFields = _a.requestedFields, enabled = _a.enabled, refetchInterval = _a.refetchInterval;
    var user = (0, useEvolveUser_1.default)();
    var isAppointmentLoading = (0, getSelectors_1.getSelectors)(appointment_store_1.useAppointmentStore, ['isAppointmentLoading']).isAppointmentLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var key = [
        exports.CHART_DATA_QUERY_KEY_BASE,
        apiClient,
        encounterId,
        user,
        isReadOnly,
        isAppointmentLoading,
        requestedFields,
    ];
    var query = (0, react_query_1.useQuery)(key, function () {
        if (apiClient && encounterId) {
            return apiClient.getChartData({
                encounterId: encounterId,
                requestedFields: requestedFields,
            });
        }
        throw new Error('api client not defined or encounterId not provided');
    }, {
        onSuccess: function (data) {
            onSuccess(data);
        },
        onError: function (err) {
            onError === null || onError === void 0 ? void 0 : onError(err);
            console.error('Error during fetching get telemed appointments: ', err);
        },
        enabled: !!apiClient && !!encounterId && !!user && !isAppointmentLoading && enabled,
        staleTime: 0,
        refetchInterval: refetchInterval || false,
    });
    return __assign(__assign({}, query), { queryKey: key });
};
exports.useGetChartData = useGetChartData;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useSaveChartData = function () {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var encounter = (0, getSelectors_1.getSelectors)(appointment_store_1.useAppointmentStore, ['encounter']).encounter;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (0, react_query_1.useMutation)({
        mutationFn: function (chartDataFields) {
            // disabled saving chart data in read only mode except addendum note
            if (isReadOnly && Object.keys(chartDataFields).some(function (key) { return key !== 'addendumNote'; })) {
                throw new Error('update disabled in read only mode');
            }
            if (apiClient && encounter.id) {
                return apiClient.saveChartData(__assign({ encounterId: encounter.id }, chartDataFields));
            }
            throw new Error('api client not defined or encounterId not provided');
        },
        retry: 2,
    });
};
exports.useSaveChartData = useSaveChartData;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useDeleteChartData = function () {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var encounter = appointment_store_1.useAppointmentStore.getState().encounter;
    return (0, react_query_1.useMutation)({
        mutationFn: function (chartDataFields) {
            if (apiClient && encounter.id) {
                return apiClient.deleteChartData(__assign({ encounterId: encounter.id }, chartDataFields));
            }
            throw new Error('api client not defined or encounterId not provided');
        },
        retry: 2,
    });
};
exports.useDeleteChartData = useDeleteChartData;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetMedicationsSearch = function (medicationSearchTerm) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['medications-search', { medicationSearchTerm: medicationSearchTerm }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (oystehr) {
                return [2 /*return*/, oystehr.erx.searchMedications({ name: medicationSearchTerm })];
            }
            throw new Error('api client not defined');
        });
    }); }, {
        onError: function (_err) {
            (0, notistack_1.enqueueSnackbar)('An error occurred during the search. Please try again in a moment', {
                variant: 'error',
            });
        },
        enabled: Boolean(medicationSearchTerm),
        keepPreviousData: true,
        staleTime: constants_1.QUERY_STALE_TIME,
    });
};
exports.useGetMedicationsSearch = useGetMedicationsSearch;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetAllergiesSearch = function (allergiesSearchTerm) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['allergies-search', { allergiesSearchTerm: allergiesSearchTerm }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (oystehr) {
                return [2 /*return*/, oystehr.erx.searchAllergens({ name: allergiesSearchTerm })];
            }
            throw new Error('api client not defined');
        });
    }); }, {
        onError: function (_err) {
            (0, notistack_1.enqueueSnackbar)('An error occurred during the search. Please try again in a moment', {
                variant: 'error',
            });
        },
        enabled: Boolean(allergiesSearchTerm),
        keepPreviousData: true,
        staleTime: constants_1.QUERY_STALE_TIME,
    });
};
exports.useGetAllergiesSearch = useGetAllergiesSearch;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetCreateExternalLabResources = function (_a) {
    var patientId = _a.patientId, search = _a.search;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useQuery)(['external lab resource search', { patientId: patientId, search: search }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, apiClient === null || apiClient === void 0 ? void 0 : apiClient.getCreateExternalLabResources({ patientId: patientId, search: search })];
        });
    }); }, {
        enabled: Boolean(apiClient && (patientId || search)),
        keepPreviousData: true,
        staleTime: constants_1.QUERY_STALE_TIME,
    });
};
exports.useGetCreateExternalLabResources = useGetCreateExternalLabResources;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetIcd10Search = function (_a) {
    var search = _a.search, sabs = _a.sabs, radiologyOnly = _a.radiologyOnly;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var openError = function () {
        (0, notistack_1.enqueueSnackbar)('An error occurred during the search. Please try again in a moment.', {
            variant: 'error',
        });
    };
    return (0, react_query_1.useQuery)(['icd-search', { search: search, sabs: sabs, radiologyOnly: radiologyOnly }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, apiClient === null || apiClient === void 0 ? void 0 : apiClient.icdSearch({ search: search, sabs: sabs, radiologyOnly: radiologyOnly })];
        });
    }); }, {
        onError: function (error) {
            openError();
            return error;
        },
        enabled: Boolean(apiClient && search),
        keepPreviousData: true,
        staleTime: constants_1.QUERY_STALE_TIME,
    });
};
exports.useGetIcd10Search = useGetIcd10Search;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useUpdatePaperwork = function () {
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    return (0, react_query_1.useMutation)({
        mutationFn: function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var UPDATE_PAPERWORK_ZAMBDA_ID, response;
            var appointmentID = _b.appointmentID, _c = _b.paperwork, paperwork = _c === void 0 ? {} : _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        UPDATE_PAPERWORK_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_PAPERWORK_ZAMBDA_ID;
                        if (!oystehrZambda) {
                            throw new Error('api client not defined');
                        }
                        if (!UPDATE_PAPERWORK_ZAMBDA_ID) {
                            throw new Error('update paperwork zambda id not defined');
                        }
                        return [4 /*yield*/, oystehrZambda.zambda.execute({
                                id: UPDATE_PAPERWORK_ZAMBDA_ID,
                                appointmentID: appointmentID,
                                paperwork: paperwork,
                                timezone: luxon_1.DateTime.now().zoneName,
                            })];
                    case 1:
                        response = _d.sent();
                        return [2 /*return*/, import.meta.env.VITE_APP_IS_LOCAL === 'true' ? response : response.output];
                }
            });
        }); },
    });
};
exports.useUpdatePaperwork = useUpdatePaperwork;
var useGetPatientInstructions = function (_a, onSuccess
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) {
    var type = _a.type;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useQuery)(['telemed-get-patient-instructions', { apiClient: apiClient, type: type }], function () {
        if (apiClient) {
            return apiClient.getPatientInstructions({
                type: type,
            });
        }
        throw new Error('api client not defined');
    }, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get patient instructions: ', err);
        },
        enabled: !!apiClient,
    });
};
exports.useGetPatientInstructions = useGetPatientInstructions;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useSavePatientInstruction = function () {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (instruction) {
            if (apiClient) {
                return apiClient.savePatientInstruction(instruction);
            }
            throw new Error('api client not defined');
        },
    });
};
exports.useSavePatientInstruction = useSavePatientInstruction;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useDeletePatientInstruction = function () {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (instruction) {
            if (apiClient) {
                return apiClient.deletePatientInstruction(instruction);
            }
            throw new Error('api client not defined');
        },
    });
};
exports.useDeletePatientInstruction = useDeletePatientInstruction;
var useSyncERXPatient = function (_a) {
    var patient = _a.patient, enabled = _a.enabled, onError = _a.onError;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['erx-sync-patient', patient], function () { return __awaiter(void 0, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 4];
                    console.log("Start syncing patient with erx patient ".concat(patient.id));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.erx.syncPatient({ patientId: patient.id })];
                case 2:
                    _a.sent();
                    console.log('Successfully synced erx patient');
                    return [2 /*return*/];
                case 3:
                    err_1 = _a.sent();
                    console.error('Error during syncing erx patient: ', err_1);
                    throw err_1;
                case 4: throw new Error('oystehr client is not defined');
            }
        });
    }); }, {
        retry: 2,
        enabled: enabled,
        onError: onError,
        staleTime: 0,
        cacheTime: 0,
        refetchOnMount: true,
    });
};
exports.useSyncERXPatient = useSyncERXPatient;
var useConnectPractitionerToERX = function (_a) {
    var patientId = _a.patientId, encounterId = _a.encounterId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)(['erx-connect-practitioner', { patientId: patientId }], function () { return __awaiter(void 0, void 0, void 0, function () {
        var params, resp, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 4];
                    console.log("Start connecting practitioner to erx");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    params = {};
                    if (patientId) {
                        params.patientId = patientId;
                    }
                    if (encounterId) {
                        params.encounterId = encounterId;
                    }
                    return [4 /*yield*/, oystehr.erx.connectPractitioner(params)];
                case 2:
                    resp = _a.sent();
                    console.log('Successfully connected practitioner to erx');
                    return [2 /*return*/, resp.ssoLink];
                case 3:
                    err_2 = _a.sent();
                    console.error('Error during connecting practitioner to erx: ', err_2);
                    throw err_2;
                case 4: throw new Error('oystehr client is not defined');
            }
        });
    }); }, {
        retry: 2,
    });
};
exports.useConnectPractitionerToERX = useConnectPractitionerToERX;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useEnrollPractitionerToERX = function (_a) {
    var onError = _a.onError;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)(['erx-enroll-practitioner'], function (practitionerId) { return __awaiter(void 0, void 0, void 0, function () {
        var params, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 4];
                    console.log("Start enrolling practitioner to erx");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    params = { practitionerId: practitionerId };
                    return [4 /*yield*/, oystehr.erx.enrollPractitioner(params)];
                case 2:
                    _a.sent();
                    console.log('Successfully enrolled practitioner to erx');
                    return [2 /*return*/];
                case 3:
                    err_3 = _a.sent();
                    if (err_3 && err_3.code === '4006') {
                        // Practitioner is already enrolled to erx
                        return [2 /*return*/];
                    }
                    console.error('Error during enrolling practitioner to erx: ', err_3);
                    throw err_3;
                case 4: throw new Error('oystehr client is not defined');
            }
        });
    }); }, {
        retry: 2,
        onError: onError,
    });
};
exports.useEnrollPractitionerToERX = useEnrollPractitionerToERX;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useCheckPractitionerEnrollment = function (_a) {
    var enabled = _a.enabled;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var user = (0, useEvolveUser_1.default)();
    return (0, react_query_1.useQuery)(['erx-check-practitioner-enrollment'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var resp, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 4];
                    console.log("Start checking practitioner enrollment");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    if (!((_a = user === null || user === void 0 ? void 0 : user.profileResource) === null || _a === void 0 ? void 0 : _a.id)) {
                        throw new Error("Current user doesn't have a profile resource id");
                    }
                    return [4 /*yield*/, oystehr.erx.checkPractitionerEnrollment({
                            practitionerId: (_b = user === null || user === void 0 ? void 0 : user.profileResource) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 2:
                    resp = _c.sent();
                    console.log('Successfully checked practitioner enrollment');
                    return [2 /*return*/, resp];
                case 3:
                    err_4 = _c.sent();
                    console.error('Error during checking practitioner enrollment: ', err_4);
                    throw err_4;
                case 4: throw new Error('oystehr client is not defined');
            }
        });
    }); }, {
        retry: 2,
        enabled: enabled,
        staleTime: 0,
        cacheTime: 0,
        refetchOnMount: true,
    });
};
exports.useCheckPractitionerEnrollment = useCheckPractitionerEnrollment;
/*
 * This should be deletable now but need to verify that ClaimsQueue feature has been mothballed
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetInsurancePlan = function (_a) {
    var id = _a.id;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['telemed-insurance-plan', { id: id }], function () {
        if (oystehr && id) {
            return oystehr.fhir.get({
                resourceType: 'InsurancePlan',
                id: id,
            });
        }
        throw new Error('fhir client not defined or Insurance Plan ID not provided');
    }, {
        enabled: Boolean(oystehr) && Boolean(id),
        onError: function (err) {
            console.error('Error during fetching get Insurance Plan: ', err);
        },
    });
};
exports.useGetInsurancePlan = useGetInsurancePlan;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useCreateUpdateMedicationOrder = function () {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: function (props) {
            if (apiClient) {
                return apiClient.createUpdateMedicationOrder(__assign({}, props));
            }
            throw new Error('error during create update medication order');
        },
        retry: 2,
    });
};
exports.useCreateUpdateMedicationOrder = useCreateUpdateMedicationOrder;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetMedicationOrders = function (searchBy) {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var encounterIdIsDefined = searchBy.field === 'encounterId' && searchBy.value;
    var encounterIdsHasLen = searchBy.field === 'encounterIds' && searchBy.value.length > 0;
    return (0, react_query_1.useQuery)(['telemed-get-medication-orders', JSON.stringify(searchBy), apiClient], function () {
        if (apiClient) {
            return apiClient.getMedicationOrders({ searchBy: searchBy });
        }
        throw new Error('api client not defined');
    }, {
        enabled: !!apiClient && Boolean(encounterIdIsDefined || encounterIdsHasLen),
        retry: 2,
        staleTime: 5 * 60 * 1000,
    });
};
exports.useGetMedicationOrders = useGetMedicationOrders;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetMedicationList = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var openError = function () {
        (0, notistack_1.enqueueSnackbar)('An error occurred while searching medications.', {
            variant: 'error',
        });
    };
    var getMedicationIdentifierNames = function (data) {
        return (data || []).reduce(function (acc, entry) {
            var _a;
            var identifier = (_a = entry.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === utils_1.MEDICATION_IDENTIFIER_NAME_SYSTEM; });
            if ((identifier === null || identifier === void 0 ? void 0 : identifier.value) && entry.id) {
                acc[entry.id] = identifier.value;
            }
            return acc;
        }, {});
    };
    return (0, react_query_1.useQuery)(['medication-list-search'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Medication',
                            params: [{ name: 'identifier', value: utils_1.INVENTORY_MEDICATION_TYPE_CODE }],
                        })];
                case 1:
                    data = _a.sent();
                    return [2 /*return*/, getMedicationIdentifierNames(data.unbundle())];
            }
        });
    }); }, {
        onError: function (_err) {
            openError();
            return {};
        },
        keepPreviousData: true,
        staleTime: constants_1.QUERY_STALE_TIME,
    });
};
exports.useGetMedicationList = useGetMedicationList;
//# sourceMappingURL=appointment.queries.js.map