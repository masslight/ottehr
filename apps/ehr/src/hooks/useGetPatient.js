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
exports.useGetPatientDetailsUpdateForm = exports.useGetInsurancePlans = exports.useUpdatePatientAccount = exports.useRemovePatientCoverage = exports.useGetPatientAccount = exports.useGetPatient = void 0;
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var types_1 = require("src/types/types");
var utils_1 = require("utils");
var formatDateTime_1 = require("../helpers/formatDateTime");
var patientSearch_1 = require("../helpers/patientSearch");
var useOystehrAPIClient_1 = require("../telemed/hooks/useOystehrAPIClient");
var useAppClients_1 = require("./useAppClients");
var updateQRUrl = import.meta.env.VITE_APP_EHR_ACCOUNT_UPDATE_FORM;
var getTelemedLength = function (history) {
    var value = history === null || history === void 0 ? void 0 : history.find(function (item) { return item.status === 'in-progress'; });
    if (!value || !value.period.start) {
        return 0;
    }
    var _a = value.period, start = _a.start, end = _a.end;
    var duration = luxon_1.DateTime.fromISO(start).diff(end ? luxon_1.DateTime.fromISO(end) : luxon_1.DateTime.now(), ['minute']);
    return Math.abs(duration.minutes);
};
var useGetPatient = function (id) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _a = (0, react_1.useState)(true), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)(false), otherPatientsWithSameName = _b[0], setOtherPatientsWithSameName = _b[1];
    var _c = (0, react_1.useState)(), patient = _c[0], setPatient = _c[1];
    var _d = (0, react_1.useState)(), appointments = _d[0], setAppointments = _d[1];
    var _e = (0, react_1.useState)(), relatedPerson = _e[0], setRelatedPerson = _e[1];
    var patientResources = (0, react_query_1.useQuery)({
        queryKey: ['useGetPatientPatientResources', id],
        queryFn: function () {
            return oystehr && id
                ? oystehr.fhir
                    .search({
                    resourceType: 'Patient',
                    params: [
                        { name: '_id', value: id },
                        {
                            name: '_revinclude',
                            value: 'Appointment:patient',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:location',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'RelatedPerson:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Encounter:appointment',
                        },
                    ],
                })
                    .then(function (bundle) { return bundle.unbundle(); })
                : undefined;
        },
        cacheTime: 10000,
        enabled: oystehr != null && id != null,
    }).data;
    var patientResource = patientResources === null || patientResources === void 0 ? void 0 : patientResources.find(function (resource) { return resource.resourceType === 'Patient'; });
    var otherPatientsWithSameNameResources = (0, react_query_1.useQuery)({
        queryKey: ['otherPatientsWithSameNameResources', id],
        queryFn: function () {
            return oystehr && patientResource
                ? oystehr.fhir
                    .search({
                    resourceType: 'Patient',
                    params: (0, patientSearch_1.getPatientNameSearchParams)({
                        firstLast: { first: (0, utils_1.getFirstName)(patientResource), last: (0, utils_1.getLastName)(patientResource) },
                        narrowByRelatedPersonAndAppointment: false,
                        maxResultOverride: 2,
                    }),
                })
                    .then(function (bundle) { return bundle.unbundle(); })
                : undefined;
        },
        cacheTime: 10000,
        enabled: oystehr != null && patientResource != null,
    }).data;
    (0, react_1.useEffect)(function () {
        function getPatient() {
            return __awaiter(this, void 0, void 0, function () {
                var patientTemp, appointmentsTemp, locations, relatedPersonTemp, encounters, appointmentRows;
                return __generator(this, function (_a) {
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    setLoading(true);
                    if (!patientResources || !otherPatientsWithSameNameResources) {
                        return [2 /*return*/];
                    }
                    patientTemp = patientResources.find(function (resource) { return resource.resourceType === 'Patient'; });
                    appointmentsTemp = patientResources.filter(function (resource) {
                        var _a, _b;
                        return resource.resourceType === 'Appointment' &&
                            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === utils_1.OTTEHR_MODULE.IP || tag.code === utils_1.OTTEHR_MODULE.TM; }));
                    } // this is unnecessary now; there are no BH patients to worry about
                    );
                    locations = patientResources.filter(function (resource) { return resource.resourceType === 'Location'; });
                    relatedPersonTemp = patientResources.find(function (resource) { return resource.resourceType === 'RelatedPerson'; });
                    encounters = patientResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
                    appointmentsTemp.sort(function (a, b) {
                        var _a, _b;
                        var createdA = luxon_1.DateTime.fromISO((_a = a.start) !== null && _a !== void 0 ? _a : '');
                        var createdB = luxon_1.DateTime.fromISO((_b = b.start) !== null && _b !== void 0 ? _b : '');
                        return createdB.diff(createdA).milliseconds;
                    });
                    if (otherPatientsWithSameNameResources.length > 1) {
                        setOtherPatientsWithSameName(true);
                    }
                    else {
                        setOtherPatientsWithSameName(false);
                    }
                    appointmentRows = appointmentsTemp.map(function (appointment) {
                        var _a, _b, _c, _d, _e, _f;
                        var appointmentLocationID = (_c = (_b = (_a = appointment.participant
                            .find(function (participant) { var _a, _b; return (_b = (_a = participant.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Location/', '');
                        var location = locations.find(function (location) { return location.id === appointmentLocationID; });
                        var encounter = appointment.id
                            ? encounters.find(function (encounter) { var _a, _b, _c; return (_c = (_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.endsWith(appointment.id); })
                            : undefined;
                        var typeLabel = (0, types_1.getVisitTypeLabelForAppointment)(appointment);
                        var serviceMode = (0, utils_1.isAppointmentVirtual)(appointment) ? utils_1.ServiceMode.virtual : utils_1.ServiceMode['in-person'];
                        return {
                            id: appointment.id,
                            typeLabel: typeLabel,
                            office: ((_d = location === null || location === void 0 ? void 0 : location.address) === null || _d === void 0 ? void 0 : _d.state) &&
                                (location === null || location === void 0 ? void 0 : location.name) &&
                                "".concat((_f = (_e = location === null || location === void 0 ? void 0 : location.address) === null || _e === void 0 ? void 0 : _e.state) === null || _f === void 0 ? void 0 : _f.toUpperCase(), " - ").concat(location === null || location === void 0 ? void 0 : location.name),
                            officeTimeZone: (0, formatDateTime_1.getTimezone)(location),
                            dateTime: appointment.start,
                            serviceMode: serviceMode,
                            length: serviceMode === utils_1.ServiceMode.virtual
                                ? getTelemedLength(encounter === null || encounter === void 0 ? void 0 : encounter.statusHistory)
                                : (encounter && (0, utils_1.getVisitTotalTime)(appointment, (0, utils_1.getVisitStatusHistory)(encounter), luxon_1.DateTime.now())) || 0,
                            appointment: appointment,
                            encounter: encounter,
                        };
                    });
                    setAppointments(appointmentRows);
                    setPatient(patientTemp);
                    setRelatedPerson(relatedPersonTemp);
                    setLoading(false);
                    return [2 /*return*/];
                });
            });
        }
        getPatient().catch(function (error) { return console.log(error); });
    }, [oystehr, patientResources, otherPatientsWithSameNameResources]);
    return {
        loading: loading,
        appointments: appointments,
        otherPatientsWithSameName: otherPatientsWithSameName,
        setOtherPatientsWithSameName: setOtherPatientsWithSameName,
        patient: patient,
        relatedPerson: relatedPerson,
        setPatient: setPatient,
    };
};
exports.useGetPatient = useGetPatient;
var useGetPatientAccount = function (_a, onSuccess) {
    var apiClient = _a.apiClient, patientId = _a.patientId;
    return (0, react_query_1.useQuery)(['patient-account-get', { apiClient: apiClient, patientId: patientId }], function () {
        return apiClient.getPatientAccount({
            patientId: patientId,
        });
    }, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error fetching patient account: ', err);
        },
        enabled: apiClient != null && patientId != null,
    });
};
exports.useGetPatientAccount = useGetPatientAccount;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useRemovePatientCoverage = function () {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useMutation)(['remove-patient-coverage'], function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!apiClient || !input)
                        return [2 /*return*/];
                    return [4 /*yield*/, apiClient.removePatientCoverage(input)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error(error_1);
                    throw error_1;
                case 3: return [2 /*return*/];
            }
        });
    }); });
};
exports.useRemovePatientCoverage = useRemovePatientCoverage;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useUpdatePatientAccount = function (onSuccess) {
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    return (0, react_query_1.useMutation)(['update-patient-account'], function (questionnaireResponse) { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!apiClient || !questionnaireResponse)
                        return [2 /*return*/];
                    return [4 /*yield*/, apiClient.updatePatientAccount({
                            questionnaireResponse: questionnaireResponse,
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error(error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    }); }, {
        onSuccess: function () {
            (0, notistack_1.enqueueSnackbar)('Patient information updated successfully', {
                variant: 'success',
            });
            if (onSuccess) {
                onSuccess();
            }
        },
        onError: function () {
            (0, notistack_1.enqueueSnackbar)('Save operation failed. The server encountered an error while processing your request.', {
                variant: 'error',
            });
        },
    });
};
exports.useUpdatePatientAccount = useUpdatePatientAccount;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetInsurancePlans = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var fetchAllInsurancePlans = function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchParams, offset, allEntries, bundle, serverTotal;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('FHIR client not defined');
                    }
                    searchParams = [
                        { name: 'type', value: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM, "|").concat(utils_1.ORG_TYPE_PAYER_CODE) },
                        { name: 'active:not', value: 'false' },
                        { name: '_count', value: '1000' },
                    ];
                    offset = 0;
                    allEntries = [];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: __spreadArray(__spreadArray([], searchParams, true), [{ name: '_offset', value: offset }], false),
                        })];
                case 1:
                    bundle = _b.sent();
                    allEntries = allEntries.concat(bundle.entry || []);
                    serverTotal = bundle.total;
                    _b.label = 2;
                case 2:
                    if (!((_a = bundle.link) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 4];
                    offset += 1000;
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: __spreadArray(__spreadArray([], searchParams.filter(function (param) { return param.name !== '_offset'; }), true), [{ name: '_offset', value: offset }], false),
                        })];
                case 3:
                    bundle = _b.sent();
                    allEntries = allEntries.concat(bundle.entry || []);
                    return [3 /*break*/, 2];
                case 4: return [2 /*return*/, __assign(__assign({}, bundle), { entry: allEntries, total: serverTotal !== undefined ? serverTotal : allEntries.length })];
            }
        });
    }); };
    return (0, react_query_1.useQuery)(['insurance-plans'], fetchAllInsurancePlans, {
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching insurance plans: ', err);
        },
    });
};
exports.useGetInsurancePlans = useGetInsurancePlans;
var useGetPatientDetailsUpdateForm = function (onSuccess) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _a = updateQRUrl.split('|'), url = _a[0], version = _a[1];
    return (0, react_query_1.useQuery)(['patient-update-form'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchResults, form;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Questionnaire',
                            params: [
                                {
                                    name: 'url',
                                    value: url,
                                },
                                {
                                    name: 'version',
                                    value: version,
                                },
                            ],
                        })];
                case 1:
                    searchResults = (_a.sent()).unbundle();
                    form = searchResults[0];
                    if (!form) {
                        throw new Error('Form not found');
                    }
                    return [2 /*return*/, form];
                case 2: throw new Error('FHIR client not defined');
            }
        });
    }); }, {
        enabled: Boolean(oystehr) && Boolean(updateQRUrl),
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during patient update form: ', err);
        },
    });
};
exports.useGetPatientDetailsUpdateForm = useGetPatientDetailsUpdateForm;
//# sourceMappingURL=useGetPatient.js.map