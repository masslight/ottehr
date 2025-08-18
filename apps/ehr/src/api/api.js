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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePaperworkPdf = exports.updateNursingOrder = exports.createNursingOrder = exports.getNursingOrders = exports.deleteInHouseLabOrder = exports.handleInHouseLabResults = exports.collectInHouseLabSpecimen = exports.getCreateInHouseLabOrderResources = exports.getInHouseOrders = exports.createInHouseLabOrder = exports.createSlot = exports.getRadiologyOrders = exports.radiologyLaunchViewer = exports.cancelRadiologyOrder = exports.createRadiologyOrder = exports.updateLabOrderResources = exports.deleteLabOrder = exports.getExternalLabOrders = exports.createExternalLabOrder = exports.getSignedPatientProfilePhotoUrl = exports.uploadPatientProfilePhoto = exports.createSchedule = exports.updateSchedule = exports.getSchedule = exports.listScheduleOwners = exports.getEmployees = exports.cancelAppointment = exports.getLocations = exports.getConversation = exports.userActivation = exports.getUserDetails = exports.changeInPersonVisitStatus = exports.unassignPractitioner = exports.assignPractitioner = exports.updateUser = exports.createUser = exports.inviteParticipant = exports.cancelTelemedAppointment = exports.saveFollowup = exports.createAppointment = exports.getAppointments = exports.getOrCreateVisitLabel = exports.getLabelPdf = exports.submitLabOrder = exports.getUser = void 0;
var sdk_1 = require("@oystehr/sdk");
var utils_1 = require("utils");
var VITE_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;
var SUBMIT_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_SUBMIT_LAB_ORDER_ZAMBDA_ID;
var GET_APPOINTMENTS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_APPOINTMENTS_ZAMBDA_ID;
var CREATE_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID;
var CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID;
var INVITE_PARTICIPANT_ZAMBDA_ID = import.meta.env.VITE_APP_INVITE_PARTICIPANT_ZAMBDA_ID;
var CREATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_USER_ZAMBDA_ID;
var UPDATE_USER_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_USER_ZAMBDA_ID;
var ASSIGN_PRACTITIONER_ZAMBDA_ID = import.meta.env.VITE_APP_ASSIGN_PRACTITIONER_ZAMBDA_ID;
var UNASSIGN_PRACTITIONER_ZAMBDA_ID = import.meta.env.VITE_APP_UNASSIGN_PRACTITIONER_ZAMBDA_ID;
var CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID = import.meta.env.VITE_APP_CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID;
var GET_USER_ZAMBDA_ID = import.meta.env.VITE_APP_GET_USER_ZAMBDA_ID;
var USER_ACTIVATION_ZAMBDA_ID = import.meta.env.VITE_APP_USER_ACTIVATION_ZAMBDA_ID;
var GET_CONVERSATION_ZAMBDA_ID = import.meta.env.VITE_APP_GET_CONVERSATION_ZAMBDA_ID;
var GET_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_GET_SCHEDULE_ZAMBDA_ID;
var CANCEL_APPOINTMENT_ZAMBDA_ID = import.meta.env.VITE_APP_CANCEL_APPOINTMENT_ID;
var GET_EMPLOYEES_ZAMBDA_ID = import.meta.env.VITE_APP_GET_EMPLOYEES_ZAMBDA_ID;
var GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID = import.meta.env.VITE_APP_GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID;
var SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID = import.meta.env.VITE_APP_SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID;
var CREATE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_LAB_ORDER_ZAMBDA_ID;
var GET_LAB_ORDERS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LAB_ORDERS_ZAMBDA_ID;
var DELETE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_DELETE_LAB_ORDER_ZAMBDA_ID;
var UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID;
var EHR_GET_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_EHR_GET_SCHEDULE_ZAMBDA_ID;
var UPDATE_SCHEDULE_ZAMBDA_ID = import.meta.env.VITE_APP_UPDATE_SCHEDULE_ZAMBDA_ID;
var LIST_SCHEDULE_OWNERS_ZAMBDA_ID = import.meta.env.VITE_APP_LIST_SCHEDULE_OWNERS_ZAMBDA_ID;
var CREATE_SCHEDULE_ZAMBDA_ID = 'create-schedule';
var CREATE_SLOT_ZAMBDA_ID = 'create-slot';
var CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID = import.meta.env.VITE_APP_CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID;
var GET_IN_HOUSE_ORDERS_ZAMBDA_ID = import.meta.env.VITE_APP_GET_IN_HOUSE_ORDERS_ZAMBDA_ID;
var GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES = import.meta.env.VITE_APP_GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES;
var COLLECT_IN_HOUSE_LAB_SPECIMEN = import.meta.env.VITE_APP_COLLECT_IN_HOUSE_LAB_SPECIMEN;
var HANDLE_IN_HOUSE_LAB_RESULTS = import.meta.env.VITE_APP_HANDLE_IN_HOUSE_LAB_RESULTS;
var DELETE_IN_HOUSE_LAB_ORDER = import.meta.env.VITE_APP_DELETE_IN_HOUSE_LAB_ORDER;
var GET_NURSING_ORDERS_ZAMBDA_ID = 'get-nursing-orders';
var CREATE_NURSING_ORDER_ZAMBDA_ID = 'create-nursing-order';
var UPDATE_NURSING_ORDER = 'update-nursing-order';
var GET_LABEL_PDF_ZAMBDA_ID = import.meta.env.VITE_APP_GET_LABEL_PDF_ZAMBDA_ID;
var GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID = import.meta.env.VITE_APP_GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID;
var PAPERWORK_TO_PDF_ZAMBDA_ID = 'paperwork-to-pdf';
var getUser = function (token) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr;
    return __generator(this, function (_a) {
        oystehr = new sdk_1.default({
            accessToken: token,
            projectApiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
        });
        return [2 /*return*/, oystehr.user.me()];
    });
}); };
exports.getUser = getUser;
if (!VITE_APP_IS_LOCAL) {
    throw new Error('VITE_APP_IS_LOCAL is not defined');
}
var submitLabOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (SUBMIT_LAB_ORDER_ZAMBDA_ID == null) {
                    throw new Error('submit external lab order zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: SUBMIT_LAB_ORDER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_1 = _a.sent();
                console.log(error_1);
                throw error_1;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.submitLabOrder = submitLabOrder;
var getLabelPdf = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_LABEL_PDF_ZAMBDA_ID == null) {
                    throw new Error('get-label-pdf environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_LABEL_PDF_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_2 = _a.sent();
                console.error(error_2);
                throw error_2;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getLabelPdf = getLabelPdf;
var getOrCreateVisitLabel = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID == null) {
                    throw new Error('get-or-create-visit-label-pdf environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_OR_CREATE_VISIT_LABEL_PDF_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_3 = _a.sent();
                console.error(error_3);
                throw error_3;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getOrCreateVisitLabel = getOrCreateVisitLabel;
var getAppointments = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_APPOINTMENTS_ZAMBDA_ID == null) {
                    throw new Error('get appointments environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_APPOINTMENTS_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_4 = _a.sent();
                console.log(error_4);
                throw error_4;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAppointments = getAppointments;
var createAppointment = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CREATE_APPOINTMENT_ZAMBDA_ID == null) {
                    throw new Error('create appointment environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CREATE_APPOINTMENT_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_5 = _a.sent();
                console.log(error_5);
                throw error_5;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createAppointment = createAppointment;
var saveFollowup = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID == null) {
                    throw new Error('save followup environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: SAVE_PATIENT_FOLLOWUP_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_6 = _a.sent();
                console.log(error_6);
                throw new Error(JSON.stringify(error_6));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.saveFollowup = saveFollowup;
var cancelTelemedAppointment = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID == null) {
                    throw new Error('cancel appointment environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CANCEL_TELEMED_APPOINTMENT_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_7 = _a.sent();
                console.log(error_7, 'error');
                throw new Error(JSON.stringify(error_7));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.cancelTelemedAppointment = cancelTelemedAppointment;
var inviteParticipant = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (INVITE_PARTICIPANT_ZAMBDA_ID == null) {
                    throw new Error('invite participant environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: INVITE_PARTICIPANT_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_8 = _a.sent();
                console.log(error_8, 'Error occurred trying to invite participant');
                throw new Error(JSON.stringify(error_8));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.inviteParticipant = inviteParticipant;
var createUser = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CREATE_USER_ZAMBDA_ID == null) {
                    throw new Error('create user environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CREATE_USER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_9 = _a.sent();
                throw new Error(JSON.stringify(error_9));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createUser = createUser;
var updateUser = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (UPDATE_USER_ZAMBDA_ID == null) {
                    throw new Error('update user environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: UPDATE_USER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_10 = _a.sent();
                throw new Error(JSON.stringify(error_10));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.updateUser = updateUser;
var assignPractitioner = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (ASSIGN_PRACTITIONER_ZAMBDA_ID == null) {
                    throw new Error('assign practitioner environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: ASSIGN_PRACTITIONER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_11 = _a.sent();
                throw new Error(error_11.message);
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.assignPractitioner = assignPractitioner;
var unassignPractitioner = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_12;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (UNASSIGN_PRACTITIONER_ZAMBDA_ID == null) {
                    throw new Error('unassign practitioner environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: UNASSIGN_PRACTITIONER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_12 = _a.sent();
                throw new Error(JSON.stringify(error_12));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.unassignPractitioner = unassignPractitioner;
var changeInPersonVisitStatus = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_13;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID == null) {
                    throw new Error('change in person visit status environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CHANGE_IN_PERSON_VISIT_STATUS_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_13 = _a.sent();
                throw new Error(JSON.stringify(error_13));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.changeInPersonVisitStatus = changeInPersonVisitStatus;
var getUserDetails = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_14;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_USER_ZAMBDA_ID == null) {
                    throw new Error('get user details environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_USER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_14 = _a.sent();
                throw new Error(JSON.stringify(error_14));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getUserDetails = getUserDetails;
var userActivation = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_15;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (USER_ACTIVATION_ZAMBDA_ID == null) {
                    throw new Error('user-activation environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: USER_ACTIVATION_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_15 = _a.sent();
                throw new Error(JSON.stringify(error_15));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.userActivation = userActivation;
var getConversation = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_16;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_CONVERSATION_ZAMBDA_ID == null) {
                    throw new Error('GET_CONVERSATION_ZAMBDA_ID environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_CONVERSATION_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_16 = _a.sent();
                throw new Error(JSON.stringify(error_16));
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getConversation = getConversation;
var getLocations = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_17;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_SCHEDULE_ZAMBDA_ID == null || VITE_APP_IS_LOCAL == null) {
                    throw new Error('get location environment variable could not be loaded');
                }
                console.log(import.meta.env);
                return [4 /*yield*/, oystehr.zambda.executePublic(__assign({ id: GET_SCHEDULE_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_17 = _a.sent();
                console.log(error_17);
                throw error_17;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getLocations = getLocations;
var cancelAppointment = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_18;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CANCEL_APPOINTMENT_ZAMBDA_ID == null) {
                    throw new Error('cancel appointment environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.executePublic(__assign({ id: CANCEL_APPOINTMENT_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_18 = _a.sent();
                console.log(error_18);
                throw error_18;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.cancelAppointment = cancelAppointment;
var getEmployees = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_19;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_EMPLOYEES_ZAMBDA_ID == null) {
                    throw new Error('get employees environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute({
                        id: GET_EMPLOYEES_ZAMBDA_ID,
                    })];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_19 = _a.sent();
                console.log(error_19);
                throw error_19;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getEmployees = getEmployees;
var listScheduleOwners = function (params, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_20;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (LIST_SCHEDULE_OWNERS_ZAMBDA_ID == null) {
                    throw new Error('list-schedule-owners zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: LIST_SCHEDULE_OWNERS_ZAMBDA_ID }, params))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_20 = _a.sent();
                console.log(error_20);
                throw error_20;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.listScheduleOwners = listScheduleOwners;
var getSchedule = function (params, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_21;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (EHR_GET_SCHEDULE_ZAMBDA_ID == null) {
                    throw new Error('ehr-get-schedule zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: EHR_GET_SCHEDULE_ZAMBDA_ID }, params))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_21 = _a.sent();
                console.log(error_21);
                throw error_21;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getSchedule = getSchedule;
var updateSchedule = function (params, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_22;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (UPDATE_SCHEDULE_ZAMBDA_ID == null) {
                    throw new Error('update-schedule zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: UPDATE_SCHEDULE_ZAMBDA_ID }, params))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_22 = _a.sent();
                console.log(error_22);
                throw error_22;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.updateSchedule = updateSchedule;
var createSchedule = function (params, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_23;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CREATE_SCHEDULE_ZAMBDA_ID }, params))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_23 = _a.sent();
                console.log(error_23);
                throw error_23;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createSchedule = createSchedule;
var uploadPatientProfilePhoto = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var patientPhotoFile, zambdaInput, urlSigningResponse, presignedImageUrl, uploadResponse, error_24;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                if (GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID == null) {
                    throw new Error('Could not find environment variable GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID');
                }
                patientPhotoFile = parameters.patientPhotoFile, zambdaInput = __rest(parameters, ["patientPhotoFile"]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign(__assign({ id: GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID }, zambdaInput), { action: 'upload' }))];
            case 1:
                urlSigningResponse = _a.sent();
                presignedImageUrl = (0, utils_1.chooseJson)(urlSigningResponse).presignedImageUrl;
                return [4 /*yield*/, fetch(presignedImageUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': patientPhotoFile.type,
                        },
                        body: patientPhotoFile,
                    })];
            case 2:
                uploadResponse = _a.sent();
                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload file');
                }
                return [2 /*return*/, (0, utils_1.chooseJson)(urlSigningResponse)];
            case 3:
                error_24 = _a.sent();
                console.error(error_24);
                throw error_24;
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.uploadPatientProfilePhoto = uploadPatientProfilePhoto;
var getSignedPatientProfilePhotoUrl = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var urlSigningResponse, error_25;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID == null) {
                    throw new Error('Could not find environment variable GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign(__assign({ id: GET_PATIENT_PROFILE_PHOTO_URL_ZAMBDA_ID }, parameters), { action: 'download' }))];
            case 1:
                urlSigningResponse = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(urlSigningResponse)];
            case 2:
                error_25 = _a.sent();
                console.error(error_25);
                throw error_25;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getSignedPatientProfilePhotoUrl = getSignedPatientProfilePhotoUrl;
var createExternalLabOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_26;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CREATE_LAB_ORDER_ZAMBDA_ID == null) {
                    throw new Error('create external lab order environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CREATE_LAB_ORDER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_26 = _a.sent();
                console.log(error_26);
                throw error_26;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createExternalLabOrder = createExternalLabOrder;
var getExternalLabOrders = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var searchBy, response, error_27;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_LAB_ORDERS_ZAMBDA_ID == null) {
                    throw new Error('get external lab orders zambda environment variable could not be loaded');
                }
                searchBy = parameters.searchBy;
                if (!searchBy) {
                    throw new Error("Missing one of the required parameters (serviceRequestId | encounterId | patientId): ".concat(JSON.stringify(parameters)));
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_LAB_ORDERS_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_27 = _a.sent();
                console.log(error_27);
                throw error_27;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getExternalLabOrders = getExternalLabOrders;
var deleteLabOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_28;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (DELETE_LAB_ORDER_ZAMBDA_ID == null) {
                    throw new Error('delete lab order zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: DELETE_LAB_ORDER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_28 = _a.sent();
                console.log(error_28);
                throw error_28;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.deleteLabOrder = deleteLabOrder;
var updateLabOrderResources = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_29;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID == null) {
                    throw new Error('update lab order resources zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: UPDATE_LAB_ORDER_RESOURCES_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_29 = _a.sent();
                console.log(error_29);
                throw error_29;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.updateLabOrderResources = updateLabOrderResources;
var createRadiologyOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_30;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'radiology-create-order' }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_30 = _a.sent();
                console.log(error_30);
                throw error_30;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createRadiologyOrder = createRadiologyOrder;
var cancelRadiologyOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_31;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'radiology-cancel-order' }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, response ? (0, utils_1.chooseJson)(response) : {}];
            case 2:
                error_31 = _a.sent();
                console.log(error_31);
                throw error_31;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.cancelRadiologyOrder = cancelRadiologyOrder;
var radiologyLaunchViewer = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_32;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'radiology-launch-viewer' }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_32 = _a.sent();
                console.log(error_32);
                throw error_32;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.radiologyLaunchViewer = radiologyLaunchViewer;
var getRadiologyOrders = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var searchBy, response, error_33;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                searchBy = parameters.encounterIds || parameters.patientId || parameters.serviceRequestId;
                if (!searchBy) {
                    throw new Error("Missing one of the required parameters (serviceRequestId | encounterId | patientId): ".concat(JSON.stringify(parameters)));
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'radiology-order-list' }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_33 = _a.sent();
                console.log(error_33);
                throw error_33;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getRadiologyOrders = getRadiologyOrders;
var createSlot = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var response, jsonToUse, error_34;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.executePublic(__assign({ id: CREATE_SLOT_ZAMBDA_ID }, input))];
            case 1:
                response = _a.sent();
                jsonToUse = (0, utils_1.chooseJson)(response);
                return [2 /*return*/, jsonToUse];
            case 2:
                error_34 = _a.sent();
                throw (0, utils_1.apiErrorToThrow)(error_34);
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createSlot = createSlot;
var createInHouseLabOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_35;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID == null) {
                    throw new Error('create in house lab order zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CREATE_IN_HOUSE_LAB_ORDER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_35 = _a.sent();
                console.log(error_35);
                throw error_35;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createInHouseLabOrder = createInHouseLabOrder;
var getInHouseOrders = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var searchBy, response, error_36;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_IN_HOUSE_ORDERS_ZAMBDA_ID == null) {
                    throw new Error('get in house orders zambda environment variable could not be loaded');
                }
                searchBy = parameters.searchBy;
                if (!searchBy) {
                    throw new Error("Missing one of the required parameters (serviceRequestId | encounterId | patientId): ".concat(JSON.stringify(parameters)));
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_IN_HOUSE_ORDERS_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_36 = _a.sent();
                console.log(error_36);
                throw error_36;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getInHouseOrders = getInHouseOrders;
var getCreateInHouseLabOrderResources = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_37;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES == null) {
                    throw new Error('get create in house lab order resources zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_CREATE_IN_HOUSE_LAB_ORDER_RESOURCES }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_37 = _a.sent();
                console.log(error_37);
                throw error_37;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getCreateInHouseLabOrderResources = getCreateInHouseLabOrderResources;
var collectInHouseLabSpecimen = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_38;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (COLLECT_IN_HOUSE_LAB_SPECIMEN == null) {
                    throw new Error('collect in house lab specimen zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: COLLECT_IN_HOUSE_LAB_SPECIMEN }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_38 = _a.sent();
                console.log(error_38);
                throw error_38;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.collectInHouseLabSpecimen = collectInHouseLabSpecimen;
var handleInHouseLabResults = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_39;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (HANDLE_IN_HOUSE_LAB_RESULTS == null) {
                    throw new Error('handle in house lab results zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: HANDLE_IN_HOUSE_LAB_RESULTS }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_39 = _a.sent();
                console.log(error_39);
                throw error_39;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.handleInHouseLabResults = handleInHouseLabResults;
var deleteInHouseLabOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_40;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                if (DELETE_IN_HOUSE_LAB_ORDER == null) {
                    throw new Error('delete in house lab order zambda environment variable could not be loaded');
                }
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: DELETE_IN_HOUSE_LAB_ORDER }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_40 = _a.sent();
                console.log(error_40);
                throw error_40;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.deleteInHouseLabOrder = deleteInHouseLabOrder;
var getNursingOrders = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_41;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: GET_NURSING_ORDERS_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_41 = _a.sent();
                console.log(error_41);
                throw error_41;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getNursingOrders = getNursingOrders;
var createNursingOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_42;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: CREATE_NURSING_ORDER_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_42 = _a.sent();
                console.log(error_42);
                throw error_42;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.createNursingOrder = createNursingOrder;
var updateNursingOrder = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_43;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: UPDATE_NURSING_ORDER }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_43 = _a.sent();
                console.log(error_43);
                throw error_43;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.updateNursingOrder = updateNursingOrder;
var generatePaperworkPdf = function (oystehr, parameters) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_44;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: PAPERWORK_TO_PDF_ZAMBDA_ID }, parameters))];
            case 1:
                response = _a.sent();
                return [2 /*return*/, (0, utils_1.chooseJson)(response)];
            case 2:
                error_44 = _a.sent();
                console.log(error_44);
                throw error_44;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.generatePaperworkPdf = generatePaperworkPdf;
//# sourceMappingURL=api.js.map