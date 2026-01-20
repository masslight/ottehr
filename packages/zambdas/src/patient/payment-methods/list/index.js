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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var harvest_1 = require("../../../ehr/shared/harvest");
var shared_1 = require("../../../shared");
var helpers_1 = require("../helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrM2MClientToken;
exports.index = (0, shared_1.wrapHandler)('payment-list', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, beneficiaryPatientId, appointmentId, secrets, oystehrClient, stripeClient, stripeAccount, accountResources, account, output, customerId, customer, paymentMethods, defaultPaymentMethod_1, allCards, stripeError_1, error_1, ENVIRONMENT;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 13, , 14]);
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                    console.log(JSON.stringify(validatedParameters, null, 4));
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                beneficiaryPatientId = validatedParameters.beneficiaryPatientId, appointmentId = validatedParameters.appointmentId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrM2MClientToken) return [3 /*break*/, 2];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrM2MClientToken = _e.sent(); // keeping token externally for reuse
                return [3 /*break*/, 3];
            case 2:
                console.log('already have a token, no need to update');
                _e.label = 3;
            case 3:
                oystehrClient = (0, shared_1.createOystehrClient)(oystehrM2MClientToken, secrets);
                return [4 /*yield*/, (0, helpers_1.validateUserHasAccessToPatientAccount)({ beneficiaryPatientId: beneficiaryPatientId, secrets: secrets, zambdaInput: input }, oystehrClient)];
            case 4:
                void (_e.sent());
                stripeClient = (0, helpers_1.getStripeClient)(secrets);
                return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ appointmentId: appointmentId }, oystehrClient)];
            case 5:
                stripeAccount = _e.sent();
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(beneficiaryPatientId, oystehrClient)];
            case 6:
                accountResources = _e.sent();
                account = accountResources.account;
                if (!(account === null || account === void 0 ? void 0 : account.id)) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                }
                output = { cards: [] };
                customerId = account ? (0, utils_1.getStripeCustomerIdFromAccount)(account, stripeAccount) : undefined;
                _e.label = 7;
            case 7:
                _e.trys.push([7, 11, , 12]);
                if (!(customerId !== undefined)) return [3 /*break*/, 10];
                return [4 /*yield*/, stripeClient.customers.retrieve(customerId, {
                        expand: ['invoice_settings.default_payment_method', 'sources'],
                    }, {
                        stripeAccount: stripeAccount,
                    })];
            case 8:
                customer = _e.sent();
                return [4 /*yield*/, stripeClient.customers.listPaymentMethods(customer.id, {
                        type: 'card',
                    }, {
                        stripeAccount: stripeAccount,
                    })];
            case 9:
                paymentMethods = (_a = (_e.sent())) === null || _a === void 0 ? void 0 : _a.data;
                console.log('payment methods', paymentMethods, JSON.stringify(customer, null, 2));
                if (customer !== undefined &&
                    customer.deleted !== true &&
                    ((_b = customer.invoice_settings) === null || _b === void 0 ? void 0 : _b.default_payment_method) !== undefined &&
                    ((_c = customer.invoice_settings) === null || _c === void 0 ? void 0 : _c.default_payment_method) !== null) {
                    defaultPaymentMethod_1 = (_d = customer.invoice_settings) === null || _d === void 0 ? void 0 : _d.default_payment_method;
                    if (defaultPaymentMethod_1 !== undefined &&
                        defaultPaymentMethod_1.type === 'card' &&
                        defaultPaymentMethod_1.card !== undefined) {
                        allCards = paymentMethods.map(function (pm) {
                            return {
                                id: pm.id,
                                brand: pm.card.brand,
                                expMonth: pm.card.exp_month,
                                expYear: pm.card.exp_year,
                                lastFour: pm.card.last4,
                                default: pm.id === defaultPaymentMethod_1.id,
                            };
                        });
                        console.log('all cards', allCards);
                        output.cards = filterExpired(allCards).sort(function (a, b) {
                            if (a.default && !b.default) {
                                return -1;
                            }
                            if (!a.default && b.default) {
                                return 1;
                            }
                            return 0;
                        });
                    }
                    else {
                        console.log('no default payment method found');
                    }
                }
                else {
                    console.log('no default payment method found in customer invoice settings');
                }
                _e.label = 10;
            case 10: return [3 /*break*/, 12];
            case 11:
                stripeError_1 = _e.sent();
                throw (0, utils_1.checkForStripeCustomerDeletedError)(stripeError_1);
            case 12: return [2 /*return*/, (0, shared_1.lambdaResponse)(200, output)];
            case 13:
                error_1 = _e.sent();
                console.error(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('payment-methods-list', error_1, ENVIRONMENT)];
            case 14: return [2 /*return*/];
        }
    });
}); });
var filterExpired = function (cardList) {
    var isExpired = function (month, year) {
        var today = luxon_1.DateTime.now();
        var expDay = luxon_1.DateTime.fromObject({ year: year, month: month }).endOf('month');
        return expDay < today;
    };
    return cardList.filter(function (card) {
        return !isExpired(card.expMonth, card.expYear);
    });
};
