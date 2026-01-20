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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('get-lab-orders', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, searchBy, oystehr, drDrivenResults, drResources, drDrivenResults_1, _a, serviceRequests, tasks, diagnosticReports, diagnosticReportDrivenResultResources, practitioners, pagination, encounters, locations, appointments, provenances, organizations, questionnaires, labDocuments, specimens, patientLabItems, appointmentScheduleMap, communications, ENVIRONMENT, labOrders, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets, searchBy = validatedParameters.searchBy;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('searchBy:', JSON.stringify(searchBy));
                drDrivenResults = [];
                if (!(searchBy.field === 'diagnosticReportId')) return [3 /*break*/, 4];
                return [4 /*yield*/, (0, helpers_1.checkForDiagnosticReportDrivenResults)({
                        oystehr: oystehr,
                        searchBy: { search: 'detail', drId: searchBy.value },
                        environment: secrets.ENVIRONMENT,
                    })];
            case 2:
                drResources = _b.sent();
                if (!drResources)
                    throw Error("could not find resources for ".concat(JSON.stringify(searchBy)));
                return [4 /*yield*/, (0, helpers_1.mapResourcesToDrLabDTO)(drResources, m2mToken)];
            case 3:
                drDrivenResults_1 = _b.sent();
                console.log('search param is diagnosticReportId, returning drDrivenResults only');
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            data: [],
                            drDrivenResults: drDrivenResults_1,
                            pagination: utils_1.EMPTY_PAGINATION,
                        }),
                    }];
            case 4: return [4 /*yield*/, (0, helpers_1.getLabResources)(oystehr, validatedParameters, m2mToken, {
                    searchBy: validatedParameters.searchBy,
                })];
            case 5:
                _a = _b.sent(), serviceRequests = _a.serviceRequests, tasks = _a.tasks, diagnosticReports = _a.diagnosticReports, diagnosticReportDrivenResultResources = _a.diagnosticReportDrivenResultResources, practitioners = _a.practitioners, pagination = _a.pagination, encounters = _a.encounters, locations = _a.locations, appointments = _a.appointments, provenances = _a.provenances, organizations = _a.organizations, questionnaires = _a.questionnaires, labDocuments = _a.labDocuments, specimens = _a.specimens, patientLabItems = _a.patientLabItems, appointmentScheduleMap = _a.appointmentScheduleMap, communications = _a.communications;
                if (!serviceRequests.length) {
                    console.log('no serviceRequests found, returning empty data array');
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify({
                                data: [],
                                pagination: utils_1.EMPTY_PAGINATION,
                            }),
                        }];
                }
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                labOrders = (0, helpers_1.mapResourcesToLabOrderDTOs)({ searchBy: searchBy }, serviceRequests, tasks, diagnosticReports, practitioners, encounters, locations, appointments, provenances, organizations, questionnaires, labDocuments, specimens, appointmentScheduleMap, communications, ENVIRONMENT);
                if (!diagnosticReportDrivenResultResources) return [3 /*break*/, 7];
                return [4 /*yield*/, (0, helpers_1.mapResourcesToDrLabDTO)(diagnosticReportDrivenResultResources, m2mToken)];
            case 6:
                drDrivenResults = _b.sent();
                _b.label = 7;
            case 7: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify(__assign({ data: labOrders, drDrivenResults: drDrivenResults, pagination: pagination }, (patientLabItems && { patientLabItems: patientLabItems }))),
                }];
            case 8:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-lab-orders', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
