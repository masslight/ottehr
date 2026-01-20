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
exports.index = void 0;
exports.validateRequestParameters = validateRequestParameters;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var tasks_1 = require("../../../shared/tasks");
var m2mToken;
var ZAMBDA_NAME = 'create-manual-task';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var params, oystehr, userToken, oystehrCurrentUser, userPractitionerId, currentUserPractitioner, taskBasedOn, taskToCreate, createdTask, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                params = validateRequestParameters(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, params.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, params.secrets);
                userToken = input.headers.Authorization.replace('Bearer ', '');
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken, params.secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 2:
                userPractitionerId = _a.sent();
                return [4 /*yield*/, oystehrCurrentUser.fhir.get({
                        resourceType: 'Practitioner',
                        id: userPractitionerId,
                    })];
            case 3:
                currentUserPractitioner = _a.sent();
                taskBasedOn = params.category === utils_1.MANUAL_TASK.category.radiology && params.orderId
                    ? ["ServiceRequest/".concat(params.orderId)]
                    : undefined;
                taskToCreate = (0, tasks_1.createTask)({
                    category: params.category,
                    encounterId: params.encounterId,
                    location: {
                        id: params.location.id,
                        name: params.location.name,
                    },
                    input: [
                        {
                            type: utils_1.MANUAL_TASK.input.title,
                            valueString: params.taskTitle,
                        },
                        {
                            type: utils_1.MANUAL_TASK.input.details,
                            valueString: params.taskDetails,
                        },
                        {
                            type: utils_1.MANUAL_TASK.input.providerName,
                            valueString: (0, utils_1.getFullName)(currentUserPractitioner),
                        },
                        {
                            type: utils_1.MANUAL_TASK.input.appointmentId,
                            valueString: params.appointmentId,
                        },
                        {
                            type: utils_1.MANUAL_TASK.input.orderId,
                            valueString: params.orderId,
                        },
                        {
                            type: utils_1.MANUAL_TASK.input.encounterId,
                            valueString: params.encounterId,
                        },
                        {
                            type: utils_1.MANUAL_TASK.input.patient,
                            valueReference: params.patient
                                ? {
                                    reference: 'Patient/' + params.patient.id,
                                    display: params.patient.name,
                                }
                                : undefined,
                        },
                    ],
                    basedOn: taskBasedOn,
                });
                if (params.assignee) {
                    taskToCreate.owner = {
                        reference: 'Practitioner/' + params.assignee.id,
                        display: params.assignee.name,
                        extension: [
                            {
                                url: utils_1.TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
                                valueDateTime: luxon_1.DateTime.now().toISO(),
                            },
                        ],
                    };
                    taskToCreate.status = 'in-progress';
                }
                return [4 /*yield*/, oystehr.fhir.create(taskToCreate)];
            case 4:
                createdTask = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(createdTask),
                    }];
            case 5:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
function validateRequestParameters(input) {
    var _a = (0, shared_1.validateJsonBody)(input), category = _a.category, appointmentId = _a.appointmentId, orderId = _a.orderId, encounterId = _a.encounterId, taskTitle = _a.taskTitle, taskDetails = _a.taskDetails, assignee = _a.assignee, location = _a.location, patient = _a.patient;
    var missingFields = [];
    if (!category)
        missingFields.push('category');
    if (!taskTitle)
        missingFields.push('taskTitle');
    if (!location)
        missingFields.push('location');
    if (location) {
        if (!location.id)
            missingFields.push('location.id');
        if (!location.name)
            missingFields.push('location.name');
    }
    if (assignee) {
        if (!assignee.id)
            missingFields.push('assignee.id');
        if (!assignee.name)
            missingFields.push('assignee.name');
    }
    if (patient) {
        if (!patient.id)
            missingFields.push('patient.id');
        if (!patient.name)
            missingFields.push('patient.name');
    }
    if (missingFields.length > 0)
        throw new Error("Missing required fields [".concat(missingFields.join(', '), "]"));
    return {
        category: category,
        appointmentId: appointmentId,
        orderId: orderId,
        encounterId: encounterId,
        taskTitle: taskTitle,
        taskDetails: taskDetails,
        assignee: assignee,
        location: location,
        patient: patient,
        secrets: input.secrets,
    };
}
