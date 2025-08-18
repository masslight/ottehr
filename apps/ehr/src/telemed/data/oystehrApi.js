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
exports.getOystehrTelemedAPI = void 0;
var utils_1 = require("utils");
var ZambdaNames;
(function (ZambdaNames) {
    ZambdaNames["get telemed appointments"] = "get telemed appointments";
    ZambdaNames["init telemed session"] = "init telemed session";
    ZambdaNames["get chart data"] = "get chart data";
    ZambdaNames["save chart data"] = "save chart data";
    ZambdaNames["delete chart data"] = "delete chart data";
    ZambdaNames["change telemed appointment status"] = "change telemed appointment status";
    ZambdaNames["change in person visit status"] = "change in person visit status";
    ZambdaNames["assign practitioner"] = "assign practitioner";
    ZambdaNames["unassign practitioner"] = "unassign practitioner";
    ZambdaNames["sign appointment"] = "sign appointment";
    ZambdaNames["sync user"] = "sync user";
    ZambdaNames["get patient instructions"] = "get patient instructions";
    ZambdaNames["save patient instruction"] = "save patient instruction";
    ZambdaNames["delete patient instruction"] = "delete patient instruction";
    ZambdaNames["icd search"] = "icd search";
    ZambdaNames["create update medication order"] = "create update medication order";
    ZambdaNames["get medication orders"] = "get medication orders";
    ZambdaNames["create update patient followup"] = "create update patient followup";
    ZambdaNames["get patient account"] = "get patient account";
    ZambdaNames["update patient account"] = "update patient account";
    ZambdaNames["remove patient coverage"] = "remove patient coverage";
    ZambdaNames["send fax"] = "send fax";
    ZambdaNames["external lab resource search"] = "external lab resource search";
})(ZambdaNames || (ZambdaNames = {}));
var zambdasPublicityMap = {
    'get telemed appointments': false,
    'init telemed session': false,
    'get chart data': false,
    'save chart data': false,
    'delete chart data': false,
    'change telemed appointment status': false,
    'change in person visit status': false,
    'assign practitioner': false,
    'unassign practitioner': false,
    'sign appointment': false,
    'sync user': false,
    'get patient instructions': false,
    'save patient instruction': false,
    'delete patient instruction': false,
    'icd search': false,
    'create update medication order': false,
    'get medication orders': false,
    'create update patient followup': false,
    'get patient account': false,
    'update patient account': false,
    'remove patient coverage': false,
    'send fax': false,
    'external lab resource search': false,
};
var getOystehrTelemedAPI = function (params, oystehr) {
    var getTelemedAppointmentsZambdaID = params.getTelemedAppointmentsZambdaID, initTelemedSessionZambdaID = params.initTelemedSessionZambdaID, getChartDataZambdaID = params.getChartDataZambdaID, saveChartDataZambdaID = params.saveChartDataZambdaID, deleteChartDataZambdaID = params.deleteChartDataZambdaID, changeTelemedAppointmentStatusZambdaID = params.changeTelemedAppointmentStatusZambdaID, changeInPersonVisitStatusZambdaID = params.changeInPersonVisitStatusZambdaID, assignPractitionerZambdaID = params.assignPractitionerZambdaID, unassignPractitionerZambdaID = params.unassignPractitionerZambdaID, signAppointmentZambdaID = params.signAppointmentZambdaID, syncUserZambdaID = params.syncUserZambdaID, getPatientInstructionsZambdaID = params.getPatientInstructionsZambdaID, savePatientInstructionZambdaID = params.savePatientInstructionZambdaID, deletePatientInstructionZambdaID = params.deletePatientInstructionZambdaID, icdSearchZambdaId = params.icdSearchZambdaId, createUpdateMedicationOrderZambdaID = params.createUpdateMedicationOrderZambdaID, getMedicationOrdersZambdaID = params.getMedicationOrdersZambdaID, savePatientFollowupZambdaID = params.savePatientFollowupZambdaID, getPatientAccountZambdaID = params.getPatientAccountZambdaID, updatePatientAccountZambdaID = params.updatePatientAccountZambdaID, removePatientCoverageZambdaID = params.removePatientCoverageZambdaID, sendFaxZambdaID = params.sendFaxZambdaID, externalLabResourceSearchID = params.externalLabResourceSearchID;
    var zambdasToIdsMap = {
        'get telemed appointments': getTelemedAppointmentsZambdaID,
        'init telemed session': initTelemedSessionZambdaID,
        'get chart data': getChartDataZambdaID,
        'save chart data': saveChartDataZambdaID,
        'delete chart data': deleteChartDataZambdaID,
        'change telemed appointment status': changeTelemedAppointmentStatusZambdaID,
        'change in person visit status': changeInPersonVisitStatusZambdaID,
        'assign practitioner': assignPractitionerZambdaID,
        'unassign practitioner': unassignPractitionerZambdaID,
        'sign appointment': signAppointmentZambdaID,
        'sync user': syncUserZambdaID,
        'get patient instructions': getPatientInstructionsZambdaID,
        'save patient instruction': savePatientInstructionZambdaID,
        'delete patient instruction': deletePatientInstructionZambdaID,
        'icd search': icdSearchZambdaId,
        'create update medication order': createUpdateMedicationOrderZambdaID,
        'get medication orders': getMedicationOrdersZambdaID,
        'create update patient followup': savePatientFollowupZambdaID,
        'get patient account': getPatientAccountZambdaID,
        'update patient account': updatePatientAccountZambdaID,
        'remove patient coverage': removePatientCoverageZambdaID,
        'send fax': sendFaxZambdaID,
        'external lab resource search': externalLabResourceSearchID,
    };
    var isAppLocalProvided = params.isAppLocal != null;
    var makeZapRequest = (0, utils_1.getOystehrApiHelpers)(oystehr, ZambdaNames, zambdasToIdsMap, zambdasPublicityMap, isAppLocalProvided).makeZapRequest;
    var getTelemedAppointments = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('get telemed appointments', parameters, utils_1.NotFoundAppointmentErrorHandler)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var initTelemedSession = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('init telemed session', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var getChartData = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('get chart data', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var saveChartData = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('save chart data', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var deleteChartData = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('delete chart data', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var changeTelemedAppointmentStatus = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('change telemed appointment status', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var changeInPersonVisitStatus = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('change in person visit status', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var assignPractitioner = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('assign practitioner', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var unassignPractitioner = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('unassign practitioner', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var signAppointment = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('sign appointment', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var syncUser = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('sync user')];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var getPatientInstructions = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('get patient instructions', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var savePatientInstruction = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('save patient instruction', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var deletePatientInstruction = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('delete patient instruction', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var savePatientFollowup = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('create update patient followup', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var icdSearch = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('icd search', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var createUpdateMedicationOrder = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('create update medication order', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var getMedicationOrders = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('get medication orders', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var getPatientAccount = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('get patient account', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var updatePatientAccount = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('update patient account', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var removePatientCoverage = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('remove patient coverage', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var sendFax = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('send fax', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var getCreateExternalLabResources = function (parameters) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, makeZapRequest('external lab resource search', parameters)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    return {
        getTelemedAppointments: getTelemedAppointments,
        initTelemedSession: initTelemedSession,
        getChartData: getChartData,
        saveChartData: saveChartData,
        deleteChartData: deleteChartData,
        changeTelemedAppointmentStatus: changeTelemedAppointmentStatus,
        changeInPersonVisitStatus: changeInPersonVisitStatus,
        assignPractitioner: assignPractitioner,
        unassignPractitioner: unassignPractitioner,
        signAppointment: signAppointment,
        syncUser: syncUser,
        getPatientInstructions: getPatientInstructions,
        savePatientInstruction: savePatientInstruction,
        deletePatientInstruction: deletePatientInstruction,
        icdSearch: icdSearch,
        getMedicationOrders: getMedicationOrders,
        createUpdateMedicationOrder: createUpdateMedicationOrder,
        savePatientFollowup: savePatientFollowup,
        getPatientAccount: getPatientAccount,
        updatePatientAccount: updatePatientAccount,
        removePatientCoverage: removePatientCoverage,
        sendFax: sendFax,
        getCreateExternalLabResources: getCreateExternalLabResources,
    };
};
exports.getOystehrTelemedAPI = getOystehrTelemedAPI;
//# sourceMappingURL=oystehrApi.js.map