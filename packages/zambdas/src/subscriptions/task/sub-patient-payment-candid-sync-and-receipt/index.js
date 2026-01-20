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
var aws_serverless_1 = require("@sentry/aws-serverless");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var helpers_1 = require("../../helpers");
var validateRequestParameters_1 = require("../validateRequestParameters");
var oystehrToken;
var oystehr;
var taskId;
var ZAMBDA_NAME = 'sub-patient-payment-candid-sync-and-receipt';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, task, secrets, paymentNoticeId, encounterId, paymentNoticeSearchResult, paymentNotices, paymentNotice, encounterRef, encounterSearchResult, encounters, encounter, patientId, amountInCents, paymentIntent, stripePaymentIntentId, stripeClient, error_1, candidSyncFailed, receiptPdfFailed, errors, error_2, receiptPdfInfo, error_3, anyStepFailed, taskStatus, statusMessage, patchedTask, response, error_4, ENVIRONMENT, patchError_1;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0:
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                task = validatedParameters.task, secrets = validatedParameters.secrets;
                console.log('task ID', task.id);
                if (!task.id) {
                    throw new Error('Task ID is required');
                }
                taskId = task.id;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _m.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _m.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                _m.label = 4;
            case 4:
                _m.trys.push([4, 19, , 25]);
                console.log('getting payment notice Id from the task');
                paymentNoticeId = ((_a = task.focus) === null || _a === void 0 ? void 0 : _a.type) === 'PaymentNotice' ? (_c = (_b = task.focus) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('PaymentNotice/', '') : undefined;
                console.log('payment notice ID parsed: ', paymentNoticeId);
                if (!paymentNoticeId) {
                    console.log('no payment notice ID found on task');
                    throw new Error('no payment notice ID found on task focus');
                }
                encounterId = (_e = (_d = task.encounter) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.split('/')[1];
                if (!encounterId) {
                    console.log('no encounter ID found on task');
                    throw new Error('no encounter ID found on task encounter');
                }
                console.log('fetching payment notice');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'PaymentNotice',
                        params: [
                            {
                                name: '_id',
                                value: paymentNoticeId,
                            },
                        ],
                    })];
            case 5:
                paymentNoticeSearchResult = _m.sent();
                paymentNotices = paymentNoticeSearchResult.unbundle();
                if (!paymentNotices || paymentNotices.length === 0) {
                    throw new Error("PaymentNotice ".concat(paymentNoticeId, " not found"));
                }
                paymentNotice = paymentNotices[0];
                encounterRef = (_f = paymentNotice.request) === null || _f === void 0 ? void 0 : _f.reference;
                if (!encounterRef) {
                    throw new Error("No encounter reference found on PaymentNotice ".concat(paymentNoticeId));
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                        ],
                    })];
            case 6:
                encounterSearchResult = _m.sent();
                encounters = encounterSearchResult.unbundle();
                if (!encounters || encounters.length === 0) {
                    throw new Error("Encounter ".concat(encounterId, " not found"));
                }
                encounter = encounters[0];
                patientId = (_h = (_g = encounter.subject) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.replace('Patient/', '');
                if (!patientId) {
                    throw new Error("No patient reference found on Encounter ".concat(encounterId));
                }
                amountInCents = Math.round((((_j = paymentNotice.amount) === null || _j === void 0 ? void 0 : _j.value) || 0) * 100);
                paymentIntent = void 0;
                stripePaymentIntentId = (_l = (_k = paymentNotice.identifier) === null || _k === void 0 ? void 0 : _k.find(function (identifier) { return identifier.system === shared_1.STRIPE_PAYMENT_ID_SYSTEM; })) === null || _l === void 0 ? void 0 : _l.value;
                if (!stripePaymentIntentId) return [3 /*break*/, 10];
                stripeClient = (0, shared_1.getStripeClient)(secrets);
                _m.label = 7;
            case 7:
                _m.trys.push([7, 9, , 10]);
                return [4 /*yield*/, stripeClient.paymentIntents.retrieve(stripePaymentIntentId)];
            case 8:
                paymentIntent = _m.sent();
                return [3 /*break*/, 10];
            case 9:
                error_1 = _m.sent();
                console.error('Error fetching Stripe payment intent:', error_1);
                (0, aws_serverless_1.captureException)(error_1);
                return [3 /*break*/, 10];
            case 10:
                candidSyncFailed = false;
                receiptPdfFailed = false;
                errors = [];
                _m.label = 11;
            case 11:
                _m.trys.push([11, 13, , 14]);
                console.time('Candid pre-encounter sync');
                return [4 /*yield*/, (0, shared_1.performCandidPreEncounterSync)({
                        encounterId: encounterId,
                        oystehr: oystehr,
                        secrets: secrets,
                        amountCents: amountInCents,
                    })];
            case 12:
                _m.sent();
                console.timeEnd('Candid pre-encounter sync');
                return [3 /*break*/, 14];
            case 13:
                error_2 = _m.sent();
                console.error("Error during Candid pre-encounter sync: ".concat(error_2));
                (0, aws_serverless_1.captureException)(error_2);
                candidSyncFailed = true;
                errors.push("Candid sync failed: ".concat(error_2));
                return [3 /*break*/, 14];
            case 14:
                _m.trys.push([14, 16, , 17]);
                console.time('receipt pdf creation');
                return [4 /*yield*/, (0, shared_1.createPatientPaymentReceiptPdf)(encounterId, patientId, secrets, oystehrToken, paymentIntent)];
            case 15:
                receiptPdfInfo = _m.sent();
                console.timeEnd('receipt pdf creation');
                console.log('Receipt PDF created:', receiptPdfInfo);
                return [3 /*break*/, 17];
            case 16:
                error_3 = _m.sent();
                console.error("Error creating receipt PDF: ".concat(error_3));
                (0, aws_serverless_1.captureException)(error_3);
                receiptPdfFailed = true;
                errors.push("Receipt PDF creation failed: ".concat(error_3));
                return [3 /*break*/, 17];
            case 17:
                // Update task status based on whether any step failed
                console.log('making patch request to update task status');
                anyStepFailed = candidSyncFailed || receiptPdfFailed;
                taskStatus = anyStepFailed ? 'failed' : 'completed';
                statusMessage = void 0;
                if (anyStepFailed) {
                    statusMessage = errors.join('; ');
                }
                else {
                    statusMessage = 'Candid sync and receipt PDF created successfully';
                }
                return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({ task: { id: task.id }, taskStatusToUpdate: taskStatus, statusReasonToUpdate: statusMessage }, oystehr)];
            case 18:
                patchedTask = _m.sent();
                response = {
                    taskStatus: patchedTask.status,
                    statusReason: patchedTask.statusReason,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 19:
                error_4 = _m.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                _m.label = 20;
            case 20:
                _m.trys.push([20, 23, , 24]);
                if (!(oystehr && taskId)) return [3 /*break*/, 22];
                return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({ task: { id: taskId }, taskStatusToUpdate: 'failed', statusReasonToUpdate: JSON.stringify(error_4) }, oystehr)];
            case 21:
                _m.sent();
                _m.label = 22;
            case 22: return [3 /*break*/, 24];
            case 23:
                patchError_1 = _m.sent();
                console.error('Error patching task status in top level catch:', patchError_1);
                return [3 /*break*/, 24];
            case 24: return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_4, ENVIRONMENT)];
            case 25: return [2 /*return*/];
        }
    });
}); });
