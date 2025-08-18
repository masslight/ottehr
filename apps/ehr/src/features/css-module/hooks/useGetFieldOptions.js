"use strict";
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
exports.useFieldsSelectsOptions = void 0;
var react_1 = require("react");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var getRoutesArray = function (routes) {
    return Object.entries(routes).map(function (_a) {
        var _ = _a[0], value = _a[1];
        return ({
            value: value.code,
            label: value.display,
        });
    });
};
// fast fix to prevent multiple requests to get locations
var cacheLocations = {};
var useFieldsSelectsOptions = function () {
    var _a, _b, _c;
    var _d = (0, telemed_1.useGetMedicationList)(), medicationList = _d.data, isMedicationLoading = _d.isLoading;
    var _e = (0, react_1.useState)([]), locationsOptions = _e[0], setLocationsOptions = _e[1];
    var _f = (0, react_1.useState)(true), isLocationLoading = _f[0], setIsLocationLoading = _f[1];
    var _g = (0, react_1.useState)([]), providersOptions = _g[0], setProvidersOptions = _g[1];
    var _h = (0, react_1.useState)(true), isProvidersLoading = _h[0], setIsProvidersLoading = _h[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var currentUser = (0, useEvolveUser_1.default)();
    var _j = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'isChartDataLoading',
        'encounter',
    ]), chartData = _j.chartData, isChartDataLoading = _j.isChartDataLoading, encounter = _j.encounter;
    var encounterId = encounter === null || encounter === void 0 ? void 0 : encounter.id;
    var diagnosis = chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis;
    var diagnosisSelectOptions = (diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.map(function (item) { return ({
        value: item.resourceId || '',
        label: "".concat(item.code, " - ").concat(item.display),
    }); })) || [];
    var primaryDiagnosis = diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.find(function (item) { return item.isPrimary; });
    var diagnosisDefaultOption = primaryDiagnosis && {
        value: primaryDiagnosis.resourceId || '',
        label: "".concat(primaryDiagnosis.code, " - ").concat(primaryDiagnosis.display),
    };
    (0, react_1.useEffect)(function () {
        if (!oystehrZambda) {
            return;
        }
        function getLocationsResults(oystehr) {
            return __awaiter(this, void 0, void 0, function () {
                var locationsBundle, locationsResults, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, 3, 4]);
                            setIsLocationLoading(true);
                            cacheLocations[encounterId || 'default'] =
                                cacheLocations[encounterId || 'default'] ||
                                    oystehr.fhir.search({
                                        resourceType: 'Location',
                                        params: [{ name: '_count', value: '1000' }],
                                    });
                            return [4 /*yield*/, cacheLocations[encounterId || 'default']];
                        case 1:
                            locationsBundle = _a.sent();
                            locationsResults = locationsBundle.unbundle().filter(function (loc) { return !(0, utils_1.isLocationVirtual)(loc); });
                            setLocationsOptions(locationsResults.map(function (loc) { return ({
                                value: loc.id,
                                label: loc.name,
                            }); }));
                            return [3 /*break*/, 4];
                        case 2:
                            e_1 = _a.sent();
                            console.error('error loading locations', e_1);
                            return [3 /*break*/, 4];
                        case 3:
                            setIsLocationLoading(false);
                            return [7 /*endfinally*/];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }
        void getLocationsResults(oystehrZambda);
    }, [encounterId, oystehrZambda]);
    (0, react_1.useEffect)(function () {
        if (!oystehrZambda || !encounterId) {
            return;
        }
        function getProvidersResults() {
            return __awaiter(this, void 0, void 0, function () {
                var data, activeProviders, providerOptions, e_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, 3, 4]);
                            if (!oystehrZambda) {
                                return [2 /*return*/];
                            }
                            setIsProvidersLoading(true);
                            return [4 /*yield*/, (0, api_1.getEmployees)(oystehrZambda)];
                        case 1:
                            data = _a.sent();
                            if (data.employees) {
                                activeProviders = data.employees.filter(function (employee) { return employee.status === 'Active' && employee.isProvider; });
                                providerOptions = activeProviders.map(function (employee) { return ({
                                    value: employee.profile.split('/')[1],
                                    label: "".concat(employee.firstName, " ").concat(employee.lastName).trim() || employee.name,
                                }); });
                                providerOptions.sort(function (a, b) { return a.label.toLowerCase().localeCompare(b.label.toLowerCase()); });
                                setProvidersOptions(providerOptions);
                            }
                            return [3 /*break*/, 4];
                        case 2:
                            e_2 = _a.sent();
                            console.error('error loading provided by field', e_2);
                            return [3 /*break*/, 4];
                        case 3:
                            setIsProvidersLoading(false);
                            return [7 /*endfinally*/];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        }
        void getProvidersResults();
    }, [oystehrZambda, encounterId]);
    var medicationListOptions = Object.entries(medicationList || {})
        .map(function (_a) {
        var id = _a[0], value = _a[1];
        return ({
            value: id,
            label: value,
        });
    })
        .sort(function (a, b) { return a.label.toLowerCase().localeCompare(b.label.toLowerCase()); });
    medicationListOptions.unshift({ value: '', label: 'Select Medication' });
    // Determine default provider (current user for Provider role)
    var currentUserProviderId = (_a = currentUser === null || currentUser === void 0 ? void 0 : currentUser.profile) === null || _a === void 0 ? void 0 : _a.replace('Practitioner/', '');
    var currentUserHasProviderRole = (_b = currentUser === null || currentUser === void 0 ? void 0 : currentUser.hasRole) === null || _b === void 0 ? void 0 : _b.call(currentUser, [utils_1.RoleType.Provider]);
    var defaultProvider = currentUserHasProviderRole && currentUserProviderId
        ? providersOptions.find(function (option) { return option.value === currentUserProviderId; })
        : undefined;
    return {
        medicationId: {
            options: medicationListOptions,
            status: isMedicationLoading ? 'loading' : 'loaded',
        },
        location: {
            options: locationsOptions,
            status: isLocationLoading ? 'loading' : 'loaded',
        },
        route: {
            options: (_c = getRoutesArray(utils_1.medicationApplianceRoutes)) === null || _c === void 0 ? void 0 : _c.sort(function (a, b) {
                return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
            }),
            status: 'loaded',
        },
        units: {
            options: [
                { value: 'mg', label: 'mg' },
                { value: 'ml', label: 'mL' },
                { value: 'g', label: 'g' },
                { value: 'cc', label: 'cc' },
                { value: 'unit', label: 'unit' },
                { value: 'application', label: 'application' },
            ],
            status: 'loaded',
        },
        associatedDx: {
            options: diagnosisSelectOptions,
            status: isChartDataLoading ? 'loading' : 'loaded',
            defaultOption: diagnosisDefaultOption,
        },
        providerId: {
            options: providersOptions,
            status: isProvidersLoading ? 'loading' : 'loaded',
            defaultOption: defaultProvider,
        },
    };
};
exports.useFieldsSelectsOptions = useFieldsSelectsOptions;
//# sourceMappingURL=useGetFieldOptions.js.map