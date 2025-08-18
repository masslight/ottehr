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
exports.usePractitionerActions = void 0;
var react_query_1 = require("react-query");
var api_1 = require("src/api/api");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useAppointment_1 = require("./useAppointment");
var usePractitionerActions = function (encounter, action, practitionerType) {
    var _a, _b, _c;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var refetchAppointment = (0, useAppointment_1.useAppointment)((_c = (_b = (_a = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Appointment/', '')).refetch;
    var mutation = (0, react_query_1.useMutation)(function (practitionerId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, updateAssignment(oystehrZambda, encounter, practitionerId, action, practitionerType)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, refetchAppointment()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    throw new Error(error_1.message);
                case 4: return [2 /*return*/];
            }
        });
    }); });
    return {
        isEncounterUpdatePending: mutation.isLoading,
        handleUpdatePractitioner: mutation.mutateAsync,
    };
};
exports.usePractitionerActions = usePractitionerActions;
var updateAssignment = function (oystehrZambda, encounter, practitionerId, action, practitionerType) { return __awaiter(void 0, void 0, void 0, function () {
    var error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!oystehrZambda || !encounter || !practitionerId) {
                    console.warn('Missing required data:', { oystehrZambda: oystehrZambda, encounter: encounter, practitionerId: practitionerId });
                    return [2 /*return*/];
                }
                if (!encounter.id) {
                    throw new Error('Encounter ID is required');
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 6, , 7]);
                if (!(action === 'start')) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, api_1.assignPractitioner)(oystehrZambda, {
                        encounterId: encounter.id,
                        practitionerId: practitionerId,
                        userRole: practitionerType,
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, (0, api_1.unassignPractitioner)(oystehrZambda, {
                    encounterId: encounter.id,
                    practitionerId: practitionerId,
                    userRole: practitionerType,
                })];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                error_2 = _a.sent();
                throw new Error("Failed to ".concat(action, " practitioner: ").concat(error_2));
            case 7: return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=usePractitioner.js.map