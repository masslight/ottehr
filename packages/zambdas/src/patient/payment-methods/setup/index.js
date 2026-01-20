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
var utils_1 = require("utils");
var harvest_1 = require("../../../ehr/shared/harvest");
var shared_1 = require("../../../shared");
var helpers_1 = require("../helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mClientToken;
exports.index = (0, shared_1.wrapHandler)('payment-setup', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, beneficiaryPatientId, appointmentId, secrets, oystehrClient, stripeAccount, stripeClient, accountResources, account, guarantor, customerId, setupIntent, stripeError_1, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 12, , 13]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                beneficiaryPatientId = validatedParameters.beneficiaryPatientId, appointmentId = validatedParameters.appointmentId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!m2mClientToken) return [3 /*break*/, 2];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                m2mClientToken = _a.sent(); // keeping token externally for reuse
                return [3 /*break*/, 3];
            case 2:
                console.log('already have a token, no need to update');
                _a.label = 3;
            case 3:
                oystehrClient = (0, shared_1.createOystehrClient)(m2mClientToken, secrets);
                return [4 /*yield*/, (0, helpers_1.validateUserHasAccessToPatientAccount)({ beneficiaryPatientId: beneficiaryPatientId, secrets: secrets, zambdaInput: input }, oystehrClient)];
            case 4:
                void (_a.sent());
                return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ appointmentId: appointmentId }, oystehrClient)];
            case 5:
                stripeAccount = _a.sent();
                console.log('Using stripe account: ', stripeAccount);
                stripeClient = (0, helpers_1.getStripeClient)(secrets);
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(beneficiaryPatientId, oystehrClient)];
            case 6:
                accountResources = _a.sent();
                account = accountResources.account;
                if (!(account === null || account === void 0 ? void 0 : account.id)) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                }
                guarantor = accountResources.guarantorResource;
                return [4 /*yield*/, (0, shared_1.ensureStripeCustomerId)({
                        guarantorResource: guarantor,
                        account: account,
                        patientId: beneficiaryPatientId,
                        stripeClient: stripeClient,
                        stripeAccount: stripeAccount,
                    }, oystehrClient)];
            case 7:
                customerId = (_a.sent()).customerId;
                console.log('Using stripe customer ID: ', customerId);
                setupIntent = void 0;
                _a.label = 8;
            case 8:
                _a.trys.push([8, 10, , 11]);
                return [4 /*yield*/, stripeClient.setupIntents.create({
                        customer: "".concat(customerId),
                        automatic_payment_methods: {
                            enabled: false,
                        },
                        payment_method_types: ['card'],
                    }, {
                        stripeAccount: stripeAccount,
                    })];
            case 9:
                setupIntent = _a.sent();
                return [3 /*break*/, 11];
            case 10:
                stripeError_1 = _a.sent();
                throw (0, utils_1.checkForStripeCustomerDeletedError)(stripeError_1);
            case 11:
                if (!setupIntent.client_secret) {
                    throw new Error('Failed to create SetupIntent');
                }
                response = {
                    clientSecret: setupIntent.client_secret,
                    stripeAccount: stripeAccount,
                };
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, response)];
            case 12:
                error_1 = _a.sent();
                console.error(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('payment-methods-setup', error_1, ENVIRONMENT)];
            case 13: return [2 /*return*/];
        }
    });
}); });
