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
var shared_1 = require("../../../shared");
var helpers_1 = require("../helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2MClientToken;
exports.index = (0, shared_1.wrapHandler)('del-payment-method', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, beneficiaryPatientId, appointmentId, paymentMethodId, secrets, oystehrClient, stripeCustomerId, stripeClient, paymentMethod, detachedPaymentMethod, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 11, , 12]);
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
                beneficiaryPatientId = validatedParameters.beneficiaryPatientId, appointmentId = validatedParameters.appointmentId, paymentMethodId = validatedParameters.paymentMethodId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!m2MClientToken) return [3 /*break*/, 3];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 2:
                m2MClientToken = _a.sent(); // keeping token externally for reuse
                return [3 /*break*/, 4];
            case 3:
                console.log('already have a token, no need to update');
                _a.label = 4;
            case 4:
                oystehrClient = (0, shared_1.createOystehrClient)(m2MClientToken, secrets);
                return [4 /*yield*/, (0, helpers_1.validateUserHasAccessToPatientAccount)({ beneficiaryPatientId: beneficiaryPatientId, secrets: secrets, zambdaInput: input }, oystehrClient)];
            case 5:
                void (_a.sent());
                return [4 /*yield*/, (0, validateRequestParameters_1.complexValidation)({
                        patientId: beneficiaryPatientId,
                        appointmentId: appointmentId,
                        oystehrClient: oystehrClient,
                    })];
            case 6:
                stripeCustomerId = (_a.sent()).stripeCustomerId;
                stripeClient = (0, helpers_1.getStripeClient)(secrets);
                return [4 /*yield*/, stripeClient.paymentMethods.retrieve(paymentMethodId)];
            case 7:
                paymentMethod = _a.sent();
                if (!(paymentMethod !== undefined && paymentMethod.customer === stripeCustomerId)) return [3 /*break*/, 9];
                return [4 /*yield*/, stripeClient.paymentMethods.detach(paymentMethodId)];
            case 8:
                detachedPaymentMethod = _a.sent();
                console.log("Payment method (".concat(detachedPaymentMethod.id, ") successfully detached from customer (").concat(paymentMethod.customer, ")."));
                return [3 /*break*/, 10];
            case 9:
                console.error("Stripe payment method with ID ".concat(paymentMethod.id, " belongs to ").concat(paymentMethod.customer, " and not ").concat(stripeCustomerId));
                throw utils_1.STRIPE_RESOURCE_ACCESS_NOT_AUTHORIZED_ERROR;
            case 10: return [2 /*return*/, (0, shared_1.lambdaResponse)(204, null)];
            case 11:
                error_1 = _a.sent();
                console.error(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('payment-methods-delete', error_1, ENVIRONMENT)];
            case 12: return [2 /*return*/];
        }
    });
}); });
