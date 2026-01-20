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
exports.sendText = exports.getDocReferenceIDFromFocus = void 0;
exports.wrapTaskHandler = wrapTaskHandler;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var getDocReferenceIDFromFocus = function (task) {
    var _a;
    var ref = (_a = task.focus) === null || _a === void 0 ? void 0 : _a.reference;
    if (!ref) {
        throw "no reference found on Task ".concat(task.id);
    }
    var _b = ref.split('/'), resource = _b[0], id = _b[1];
    if (resource !== 'DocumentReference') {
        throw "no DocRef specified as focus on Task ".concat(task.id);
    }
    if (!id) {
        throw "no DocRef id missing in focus on Task ".concat(task.id);
    }
    return id;
};
exports.getDocReferenceIDFromFocus = getDocReferenceIDFromFocus;
var sendText = function (message, fhirRelatedPerson, oystehrToken, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var taskStatus, statusReason, smsNumber, messageRecipient, oystehr_1, result, e_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                smsNumber = (0, utils_1.getSMSNumberForIndividual)(fhirRelatedPerson);
                if (!smsNumber) return [3 /*break*/, 5];
                console.log('sending message to', smsNumber);
                messageRecipient = "RelatedPerson/".concat(fhirRelatedPerson.id);
                oystehr_1 = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, oystehr_1.transactionalSMS.send({
                        message: message,
                        resource: messageRecipient,
                    })];
            case 2:
                result = _a.sent();
                console.log('send SMS result', result);
                taskStatus = 'completed';
                statusReason = 'text sent successfully';
                return [3 /*break*/, 4];
            case 3:
                e_1 = _a.sent();
                console.log('message send error: ', JSON.stringify(e_1));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                void (0, shared_1.sendErrors)(e_1, ENVIRONMENT);
                taskStatus = 'failed';
                statusReason = "failed to send text to ".concat(smsNumber);
                return [3 /*break*/, 4];
            case 4: return [3 /*break*/, 6];
            case 5:
                taskStatus = 'failed';
                statusReason = "could not retrieve sms number for related person ".concat(fhirRelatedPerson.id);
                console.log('Could not find sms number. Skipping sending text');
                _a.label = 6;
            case 6: return [2 /*return*/, { taskStatus: taskStatus, statusReason: statusReason }];
        }
    });
}); };
exports.sendText = sendText;
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var oystehr;
function wrapTaskHandler(zambdaName, handler, options) {
    var _this = this;
    if (options === void 0) { options = { retry: false }; }
    return (0, shared_1.wrapHandler)(zambdaName, function (input) { return __awaiter(_this, void 0, void 0, function () {
        var params, taskId, ENVIRONMENT, taskIdParam, error_1, error_2, patchError_1, result, error_3, patchError_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    params = (0, validateRequestParameters_1.validateRequestParameters)(input);
                    taskIdParam = params.task.id;
                    if (!taskIdParam) {
                        throw new Error('Task ID is missing in the input parameters');
                    }
                    taskId = taskIdParam;
                    ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                    return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, input.secrets)];
                case 1:
                    oystehrToken = _a.sent();
                    oystehr = (0, shared_1.createOystehrClient)(oystehrToken, input.secrets);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.log('Error validating request parameters:', error_1);
                    return [2 /*return*/, (0, shared_1.topLevelCatch)(zambdaName, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
                case 3:
                    _a.trys.push([3, 5, , 10]);
                    return [4 /*yield*/, markTaskInProgress(taskId, oystehr)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 5:
                    error_2 = _a.sent();
                    console.error('Error patching task status to in-progress:', error_2);
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, markTaskFailed(taskId, oystehr, "Failed to mark task in-progress: ".concat(JSON.stringify(error_2)), options.retry)];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    patchError_1 = _a.sent();
                    console.error('Error patching task status in top level catch:', patchError_1);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/, (0, shared_1.topLevelCatch)(zambdaName, error_2, ENVIRONMENT)];
                case 10:
                    _a.trys.push([10, 13, , 18]);
                    return [4 /*yield*/, handler(params, oystehr)];
                case 11:
                    result = _a.sent();
                    return [4 /*yield*/, markTaskCompleted(taskId, oystehr, result.taskStatus, result.statusReason)];
                case 12:
                    _a.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(result),
                        }];
                case 13:
                    error_3 = _a.sent();
                    _a.label = 14;
                case 14:
                    _a.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, markTaskFailed(taskId, oystehr, JSON.stringify(error_3), options.retry)];
                case 15:
                    _a.sent();
                    return [3 /*break*/, 17];
                case 16:
                    patchError_2 = _a.sent();
                    console.error('Error patching task status in top level catch:', patchError_2);
                    return [3 /*break*/, 17];
                case 17: return [2 /*return*/, (0, shared_1.topLevelCatch)(zambdaName, error_3, ENVIRONMENT)];
                case 18: return [2 /*return*/];
            }
        });
    }); });
}
function markTaskInProgress(taskId, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({ task: { id: taskId }, taskStatusToUpdate: 'in-progress', statusReasonToUpdate: 'started processing' }, oystehr)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function markTaskCompleted(taskId, oystehr, status, reason) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({ task: { id: taskId }, taskStatusToUpdate: status, statusReasonToUpdate: reason !== null && reason !== void 0 ? reason : 'completed successfully' }, oystehr)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function markTaskFailed(taskId_1, oystehr_2, reason_1) {
    return __awaiter(this, arguments, void 0, function (taskId, oystehr, reason, retry) {
        if (retry === void 0) { retry = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({
                        task: { id: taskId },
                        taskStatusToUpdate: retry ? 'ready' : 'failed',
                        statusReasonToUpdate: retry ? '' : reason,
                    }, oystehr)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
