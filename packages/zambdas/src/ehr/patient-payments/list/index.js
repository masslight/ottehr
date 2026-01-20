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
var shared_1 = require("../../../shared");
var harvest_1 = require("../../shared/harvest");
var helpers_1 = require("../helpers");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrM2MClientToken;
var ZAMBDA_NAME = 'patient-payments-list';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, patientId, oystehrClient, accountResources, account, effectInput, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = validateRequestParameters(input);
                    console.log(JSON.stringify(validatedParameters, null, 4));
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                secrets = input.secrets;
                patientId = validatedParameters.patientId;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrM2MClientToken) return [3 /*break*/, 2];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrM2MClientToken = _a.sent(); // keeping token externally for reuse
                return [3 /*break*/, 3];
            case 2:
                console.log('already have a token, no need to update');
                _a.label = 3;
            case 3:
                oystehrClient = (0, shared_1.createOystehrClient)(oystehrM2MClientToken, secrets);
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehrClient)];
            case 4:
                accountResources = _a.sent();
                account = accountResources.account;
                if (!(account === null || account === void 0 ? void 0 : account.id)) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                }
                return [4 /*yield*/, complexValidation(__assign(__assign({}, validatedParameters), { secrets: input.secrets }), oystehrClient)];
            case 5:
                effectInput = _a.sent();
                return [4 /*yield*/, performEffect(effectInput)];
            case 6:
                response = _a.sent();
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, response)];
            case 7:
                error_1 = _a.sent();
                console.error(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('patient-payments-list', error_1, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var account, patientId, encounterId, oystehrClient, stripeClient, payments;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                account = input.patientAccount, patientId = input.patientId, encounterId = input.encounterId, oystehrClient = input.oystehrClient, stripeClient = input.stripeClient;
                return [4 /*yield*/, (0, helpers_1.getPaymentsForPatient)({
                        oystehrClient: oystehrClient,
                        stripeClient: stripeClient,
                        account: account,
                        patientId: patientId,
                        encounterId: encounterId,
                    })];
            case 1:
                payments = _a.sent();
                return [2 /*return*/, {
                        patientId: patientId,
                        payments: payments,
                        encounterId: encounterId,
                    }];
        }
    });
}); };
var complexValidation = function (input, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, encounterId, secrets, accountResources, account, stripeClient, params;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = input.patientId, encounterId = input.encounterId, secrets = input.secrets;
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehrClient)];
            case 1:
                accountResources = _a.sent();
                account = accountResources.account;
                if (!(account === null || account === void 0 ? void 0 : account.id)) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                }
                stripeClient = (0, shared_1.getStripeClient)(secrets);
                params = [];
                if (encounterId) {
                    params.push({
                        name: 'request',
                        value: "Encounter/".concat(encounterId),
                    });
                }
                else {
                    params.push({
                        name: 'request.patient._id',
                        value: patientId,
                    });
                }
                return [2 /*return*/, {
                        patientId: patientId,
                        encounterId: encounterId,
                        stripeClient: stripeClient,
                        patientAccount: account,
                        oystehrClient: oystehrClient,
                    }];
        }
    });
}); };
var validateRequestParameters = function (input) {
    var authorization = input.headers.Authorization;
    if (!authorization) {
        throw utils_1.NOT_AUTHORIZED;
    }
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), patientId = _a.patientId, encounterId = _a.encounterId;
    if (!patientId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['patientId']);
    }
    if (!(0, utils_1.isValidUUID)(patientId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patientId" must be a valid UUID.');
    }
    if (encounterId && !(0, utils_1.isValidUUID)(encounterId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"encounterId" must be a valid UUID.');
    }
    return {
        patientId: patientId,
        encounterId: encounterId,
    };
};
