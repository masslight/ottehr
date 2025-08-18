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
exports.useGetPatientById = exports.useGetPatientForUpdate = exports.useGetPatientsForMerge = void 0;
var notistack_1 = require("notistack");
var react_query_1 = require("react-query");
var useAppClients_1 = require("../../hooks/useAppClients");
var useGetPatientsForMerge = function (_a, onSuccess) {
    var patientIds = _a.patientIds;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['get-patients-for-merge', { patientIds: patientIds }], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehr && patientIds)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Patient',
                            params: [{ name: '_id', value: patientIds.join(',') }],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('fhir client not defined or patientIds not provided');
            }
        });
    }); }, {
        enabled: Boolean(oystehr) && patientIds !== undefined,
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get patients for merge: ', err);
        },
    });
};
exports.useGetPatientsForMerge = useGetPatientsForMerge;
var useGetPatientForUpdate = function (_a, onSuccess) {
    var patientId = _a.patientId;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['get-patient-for-update', patientId], function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehr && patientId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Patient',
                            params: [
                                { name: '_id', value: patientId },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'QuestionnaireResponse:patient',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Task:requester',
                                },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                case 2: throw new Error('fhir client not defined or patientId not provided');
            }
        });
    }); }, {
        enabled: Boolean(patientId) && Boolean(oystehr),
        onSuccess: onSuccess,
        onError: function (err) {
            console.error('Error during fetching get patient for update: ', err);
        },
    });
};
exports.useGetPatientForUpdate = useGetPatientForUpdate;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetPatientById = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)({
        mutationFn: function (id) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(oystehr && id)) return [3 /*break*/, 2];
                        return [4 /*yield*/, oystehr.fhir.search({
                                resourceType: 'Patient',
                                params: [{ name: '_id', value: id }],
                            })];
                    case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                    case 2: throw new Error('fhir client not defined or patient id not provided');
                }
            });
        }); },
        onError: function () {
            (0, notistack_1.enqueueSnackbar)('Patient not found. Please try again', { variant: 'error' });
        },
    });
};
exports.useGetPatientById = useGetPatientById;
//# sourceMappingURL=queries.js.map