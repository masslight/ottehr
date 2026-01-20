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
exports.index = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'submit-lab-order';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, serviceRequestIDs, manualOrder_1, secrets, oystehr, userToken, currentUser_1, now_1, bundledOrdersByOrderNumber, successfulBundledOrders_1, failedBundledOrders, submitLabPromises, submitLabResults, _i, submitLabResults_1, res, resources, resources, provenancePostRequests_1, serviceRequestPatchRequest_1, requests, hasSuccesses, orderPdfUrls, _b, hasFailures, failedOrdersByOrderNumber, responseBody, error_1, ENVIRONMENT;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 13, , 14]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), serviceRequestIDs = _a.serviceRequestIDs, manualOrder_1 = _a.manualOrder, secrets = _a.secrets;
                console.log('manualOrder', serviceRequestIDs, manualOrder_1);
                console.log('Getting token');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _c.sent();
                console.log('token', m2mToken);
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                userToken = input.headers.Authorization.replace('Bearer ', '');
                return [4 /*yield*/, (0, shared_1.createOystehrClient)(userToken, secrets).user.me()];
            case 2:
                currentUser_1 = _c.sent();
                now_1 = luxon_1.DateTime.now();
                console.log('getting resources needed for submit lab');
                return [4 /*yield*/, (0, helpers_1.getBundledOrderResources)(oystehr, m2mToken, serviceRequestIDs, manualOrder_1)];
            case 3:
                bundledOrdersByOrderNumber = _c.sent();
                console.log('successfully retrieved resources');
                successfulBundledOrders_1 = {};
                failedBundledOrders = {};
                if (!!manualOrder_1) return [3 /*break*/, 5];
                console.log('calling oystehr submit lab');
                submitLabPromises = Object.entries(bundledOrdersByOrderNumber).map(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                    var params, res, body, result, eReq, abn, e_1;
                    var orderNumber = _b[0], resources = _b[1];
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _c.trys.push([0, 5, , 6]);
                                console.log('resources.isPscOrder', resources.isPscOrder);
                                params = {
                                    serviceRequest: resources.testDetails.map(function (test) { return "ServiceRequest/".concat(test.serviceRequestID); }),
                                    accountNumber: resources.accountNumber,
                                    orderNumber: orderNumber,
                                };
                                console.log('params being sent to oystehr submit lab', JSON.stringify(params));
                                return [4 /*yield*/, fetch(utils_1.OYSTEHR_SUBMIT_LAB_API, {
                                        method: 'POST',
                                        headers: {
                                            Authorization: "Bearer ".concat(m2mToken),
                                        },
                                        body: JSON.stringify(params),
                                    })];
                            case 1:
                                res = _c.sent();
                                if (!!res.ok) return [3 /*break*/, 3];
                                return [4 /*yield*/, res.json()];
                            case 2:
                                body = _c.sent();
                                throw new Error("Error submitting requisition number: ".concat(orderNumber, ". Error: ").concat(body.message));
                            case 3: return [4 /*yield*/, res.json()];
                            case 4:
                                result = _c.sent();
                                eReq = result === null || result === void 0 ? void 0 : result.eRequisitionDocumentReference;
                                abn = result === null || result === void 0 ? void 0 : result.abnDocumentReference;
                                return [2 /*return*/, {
                                        status: 'fulfilled',
                                        orderNumber: orderNumber,
                                        eReqDocumentReference: eReq,
                                        abnDocumentReference: abn,
                                        isPsc: resources.isPscOrder,
                                    }];
                            case 5:
                                e_1 = _c.sent();
                                (0, aws_serverless_1.captureException)(e_1);
                                return [2 /*return*/, { status: 'rejected', orderNumber: orderNumber, reason: e_1.message }];
                            case 6: return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, Promise.all(submitLabPromises)];
            case 4:
                submitLabResults = _c.sent();
                for (_i = 0, submitLabResults_1 = submitLabResults; _i < submitLabResults_1.length; _i++) {
                    res = submitLabResults_1[_i];
                    if (res.status === 'fulfilled') {
                        resources = bundledOrdersByOrderNumber[res.orderNumber];
                        successfulBundledOrders_1[res.orderNumber] = __assign({}, resources);
                        if (res.eReqDocumentReference) {
                            console.log("eReq generated for order ".concat(res.orderNumber, " - docRef id: ").concat(res.eReqDocumentReference.id));
                            successfulBundledOrders_1[res.orderNumber].labGeneratedEReq = res.eReqDocumentReference;
                        }
                        if (res.abnDocumentReference) {
                            console.log("abn generated for order ".concat(res.orderNumber, " - docRef id: ").concat(res.abnDocumentReference.id));
                            successfulBundledOrders_1[res.orderNumber].abnDocRef = res.abnDocumentReference;
                        }
                    }
                    else if (res.status === 'rejected') {
                        console.error('rejected result', res);
                        resources = bundledOrdersByOrderNumber[res.orderNumber];
                        failedBundledOrders[res.orderNumber] = resources;
                    }
                }
                return [3 /*break*/, 6];
            case 5:
                Object.entries(bundledOrdersByOrderNumber).forEach(function (_a) {
                    var orderNumber = _a[0], resources = _a[1];
                    successfulBundledOrders_1[orderNumber] = resources;
                });
                _c.label = 6;
            case 6:
                provenancePostRequests_1 = [];
                serviceRequestPatchRequest_1 = [];
                Object.values(successfulBundledOrders_1).forEach(function (resources) {
                    resources.testDetails.forEach(function (test) {
                        var _a, _b;
                        provenancePostRequests_1.push((0, helpers_1.makeProvenanceResourceRequest)(now_1, test.serviceRequestID, currentUser_1));
                        var serviceRequestPatchOps = [
                            {
                                op: 'replace',
                                path: '/status',
                                value: 'active',
                            },
                        ];
                        if (manualOrder_1) {
                            serviceRequestPatchOps.push({
                                op: 'add',
                                path: ((_a = test.serviceRequest) === null || _a === void 0 ? void 0 : _a.category) ? '/category/-' : '/category',
                                value: ((_b = test.serviceRequest) === null || _b === void 0 ? void 0 : _b.category)
                                    ? { coding: [utils_1.MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING] }
                                    : [{ coding: [utils_1.MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING] }],
                            });
                        }
                        serviceRequestPatchRequest_1.push((0, utils_1.getPatchBinary)({
                            resourceType: 'ServiceRequest',
                            resourceId: test.serviceRequestID,
                            patchOperations: serviceRequestPatchOps,
                        }));
                    });
                });
                requests = __spreadArray(__spreadArray([], provenancePostRequests_1, true), serviceRequestPatchRequest_1, true);
                if (!requests.length) return [3 /*break*/, 8];
                console.log('making fhir transaction requests');
                return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.transaction({ requests: requests }))];
            case 7:
                _c.sent();
                return [3 /*break*/, 9];
            case 8:
                console.log('no requests to make');
                _c.label = 9;
            case 9:
                hasSuccesses = Object.keys(successfulBundledOrders_1).length > 0;
                if (!hasSuccesses) return [3 /*break*/, 11];
                return [4 /*yield*/, (0, helpers_1.makeOrderFormsAndDocRefs)(successfulBundledOrders_1, now_1, secrets, m2mToken, oystehr)];
            case 10:
                _b = _c.sent();
                return [3 /*break*/, 12];
            case 11:
                _b = [];
                _c.label = 12;
            case 12:
                orderPdfUrls = _b;
                hasFailures = Object.keys(failedBundledOrders).length > 0;
                failedOrdersByOrderNumber = hasFailures
                    ? Object.keys(failedBundledOrders).map(function (orderNumber) { return orderNumber; })
                    : undefined;
                responseBody = { orderPdfUrls: orderPdfUrls, failedOrdersByOrderNumber: failedOrdersByOrderNumber };
                return [2 /*return*/, {
                        body: JSON.stringify(responseBody),
                        statusCode: 200,
                    }];
            case 13:
                error_1 = _c.sent();
                console.log(error_1);
                console.log('submit external lab order error:', JSON.stringify(error_1));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-submit-lab-order', error_1, ENVIRONMENT)];
            case 14: return [2 /*return*/];
        }
    });
}); });
