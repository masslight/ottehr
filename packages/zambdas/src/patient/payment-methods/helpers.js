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
exports.validateUserHasAccessToPatientAccount = exports.makeStripeCustomerId = exports.getBillingAccountForPatient = void 0;
exports.getStripeClient = getStripeClient;
exports.getStripeCustomerId = getStripeCustomerId;
var stripe_1 = require("stripe");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var getBillingAccountForPatient = function (patientId, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var accounts;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehrClient.fhir.search({
                    resourceType: 'Account',
                    params: [
                        {
                            name: 'patient',
                            value: "Patient/".concat(patientId),
                        },
                        {
                            name: 'status',
                            value: 'active',
                        },
                        {
                            name: 'type',
                            value: 'PBILLACCT',
                        },
                    ],
                })];
            case 1:
                accounts = _a.sent();
                return [2 /*return*/, accounts.unbundle()[0]];
        }
    });
}); };
exports.getBillingAccountForPatient = getBillingAccountForPatient;
var validateStripeEnvironment = function (secrets) {
    var secretKey = (0, utils_1.getSecret)(utils_1.SecretsKeys.STRIPE_SECRET_KEY, secrets);
    var publicKey = (0, utils_1.getSecret)(utils_1.SecretsKeys.STRIPE_PUBLIC_KEY, secrets);
    if (!secretKey) {
        throw '"STRIPE_SECRET_KEY" environment variable was not set.';
    }
    if (!publicKey) {
        throw '"STRIPE_PUBLIC_KEY" environment variable was not set.';
    }
    return {
        publicKey: publicKey,
        secretKey: secretKey,
        paymentMethodTypes: 'card',
        apiVersion: '2024-04-10',
    };
};
function getStripeClient(secrets) {
    var env = validateStripeEnvironment(secrets);
    return new stripe_1.default(env.secretKey, {
        // @ts-expect-error default api version older than sdk
        apiVersion: env.apiVersion,
    });
}
var makeStripeCustomerId = function (stripeId, stripeAccount) {
    if (!stripeAccount) {
        return {
            system: utils_1.ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
            value: stripeId,
        };
    }
    return {
        system: utils_1.ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
        value: stripeId,
        extension: [
            {
                url: utils_1.ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
                valueString: stripeAccount,
            },
        ],
    };
};
exports.makeStripeCustomerId = makeStripeCustomerId;
function getStripeCustomerId(input) {
    return __awaiter(this, void 0, void 0, function () {
        var patientId, appointmentId, oystehrClient, patientAccount, stripeAccount, stripeCustomerId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientId = input.patientId, appointmentId = input.appointmentId, oystehrClient = input.oystehrClient;
                    return [4 /*yield*/, (0, exports.getBillingAccountForPatient)(patientId, oystehrClient)];
                case 1:
                    patientAccount = _a.sent();
                    if (!patientAccount) {
                        throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                    }
                    return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ appointmentId: appointmentId }, oystehrClient)];
                case 2:
                    stripeAccount = _a.sent();
                    stripeCustomerId = (0, utils_1.getStripeCustomerIdFromAccount)(patientAccount, stripeAccount);
                    if (!stripeCustomerId) {
                        throw utils_1.STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
                    }
                    return [2 /*return*/, { stripeCustomerId: stripeCustomerId }];
            }
        });
    });
}
var validateUserHasAccessToPatientAccount = function (input, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var beneficiaryPatientId, secrets, zambdaInput, authorization, user, userAccess;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                beneficiaryPatientId = input.beneficiaryPatientId, secrets = input.secrets, zambdaInput = input.zambdaInput;
                authorization = zambdaInput.headers.Authorization;
                if (!authorization) {
                    console.log('authorization header not found');
                    throw utils_1.NOT_AUTHORIZED;
                }
                return [4 /*yield*/, (0, shared_1.getUser)(authorization.replace('Bearer ', ''), secrets)];
            case 1:
                user = _a.sent();
                return [4 /*yield*/, (0, shared_1.userHasAccessToPatient)(user, beneficiaryPatientId, oystehrClient)];
            case 2:
                userAccess = _a.sent();
                if (!userAccess) {
                    console.log('no user access to patient');
                    throw utils_1.NOT_AUTHORIZED;
                }
                return [2 /*return*/, user];
        }
    });
}); };
exports.validateUserHasAccessToPatientAccount = validateUserHasAccessToPatientAccount;
