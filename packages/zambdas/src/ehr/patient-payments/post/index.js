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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var harvest_1 = require("../../shared/harvest");
var ZAMBDA_NAME = 'post-patient-payment';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrM2MClientToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var authorization, secrets, user, userProfile, validatedParameters, requiredSecrets, patientId, encounterId, oystehrClient, effectInput, notice, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                authorization = input.headers.Authorization;
                secrets = input.secrets;
                if (!authorization) {
                    console.log('authorization header not found');
                    throw utils_1.NOT_AUTHORIZED;
                }
                return [4 /*yield*/, (0, shared_1.getUser)(authorization.replace('Bearer ', ''), secrets)];
            case 1:
                user = _a.sent();
                userProfile = user.profile;
                if (!userProfile) {
                    throw utils_1.NOT_AUTHORIZED;
                }
                console.group('patient-payment-post validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = validateRequestParameters(input);
                    console.log(JSON.stringify(validatedParameters, null, 4));
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                requiredSecrets = validateEnvironmentParameters(input, validatedParameters.paymentDetails.paymentMethod === 'card');
                patientId = validatedParameters.patientId, encounterId = validatedParameters.encounterId;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrM2MClientToken) return [3 /*break*/, 3];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 2:
                oystehrM2MClientToken = _a.sent(); // keeping token externally for reuse
                return [3 /*break*/, 4];
            case 3:
                console.log('already have a token, no need to update');
                _a.label = 4;
            case 4:
                oystehrClient = (0, shared_1.createOystehrClient)(oystehrM2MClientToken, secrets);
                return [4 /*yield*/, complexValidation(__assign(__assign(__assign({}, validatedParameters), requiredSecrets), { userProfile: userProfile }), oystehrClient)];
            case 5:
                effectInput = _a.sent();
                return [4 /*yield*/, performEffect(effectInput, oystehrClient, requiredSecrets)];
            case 6:
                notice = (_a.sent()).notice;
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, { notice: notice, patientId: patientId, encounterId: encounterId })];
            case 7:
                error_1 = _a.sent();
                console.error(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('patient-payments-post', error_1, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehrClient, requiredSecrets) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterId, paymentDetails, organizationId, userProfile, stripeAccount, paymentMethod, amountInCents, description, dateTimeIso, paymentIntent, paymentNoticeInput, stripeClient, customerId, paymentMethodId, paymentIntentInput, e_1, noticeToWrite, paymentNotice, paymentTaskResource, taskCreationResult;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounterId = input.encounterId, paymentDetails = input.paymentDetails, organizationId = input.organizationId, userProfile = input.userProfile, stripeAccount = input.stripeAccount;
                paymentMethod = paymentDetails.paymentMethod, amountInCents = paymentDetails.amountInCents, description = paymentDetails.description;
                dateTimeIso = luxon_1.DateTime.now().toISO() || '';
                console.log('dateTimeIso', dateTimeIso);
                paymentNoticeInput = {
                    encounterId: encounterId,
                    paymentDetails: paymentDetails,
                    submitterRef: { reference: userProfile },
                    dateTimeIso: dateTimeIso,
                    recipientId: organizationId,
                };
                if (!(input.cardInput && paymentMethod === 'card')) return [3 /*break*/, 5];
                stripeClient = (0, shared_1.getStripeClient)(requiredSecrets.secrets);
                customerId = input.cardInput.stripeCustomerId;
                paymentMethodId = paymentDetails.paymentMethodId;
                paymentIntentInput = {
                    amount: amountInCents,
                    currency: 'usd',
                    customer: customerId,
                    payment_method: paymentMethodId,
                    description: description || "Payment for encounter ".concat(encounterId),
                    confirm: true,
                    metadata: {
                        oystehr_encounter_id: encounterId,
                    },
                    automatic_payment_methods: {
                        enabled: true,
                        allow_redirects: 'never',
                    },
                };
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, stripeClient.paymentIntents.create(paymentIntentInput, {
                        stripeAccount: stripeAccount,
                    })];
            case 2:
                paymentIntent = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                e_1 = _a.sent();
                throw (0, utils_1.parseStripeError)(e_1);
            case 4:
                if (paymentIntent.status !== 'succeeded') {
                    throw utils_1.GENERIC_STRIPE_PAYMENT_ERROR;
                }
                paymentNoticeInput.stripePaymentIntentId = paymentIntent.id;
                console.log('Payment Intent created:', JSON.stringify(paymentIntent, null, 2));
                return [3 /*break*/, 6];
            case 5:
                console.log('handling non card payment:', paymentMethod, amountInCents, description);
                _a.label = 6;
            case 6:
                noticeToWrite = makePaymentNotice(paymentNoticeInput);
                return [4 /*yield*/, oystehrClient.fhir.create(noticeToWrite)];
            case 7:
                paymentNotice = _a.sent();
                // Write Task that will kick off subscription to perform Candid sync and create receipt PDF
                if (!paymentNotice.id) {
                    throw new Error('PaymentNotice ID is required to create task');
                }
                paymentTaskResource = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.patientPaymentCandidSyncAndReceipt, paymentNotice.id, encounterId);
                // Update the task focus to reference PaymentNotice instead of Appointment
                paymentTaskResource.focus = {
                    type: 'PaymentNotice',
                    reference: "PaymentNotice/".concat(paymentNotice.id),
                };
                return [4 /*yield*/, oystehrClient.fhir.create(paymentTaskResource)];
            case 8:
                taskCreationResult = _a.sent();
                console.log('Task creation result:', taskCreationResult);
                return [2 /*return*/, { notice: paymentNotice, paymentIntent: paymentIntent }];
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
    var _a = JSON.parse(input.body), patientId = _a.patientId, encounterId = _a.encounterId, paymentDetails = _a.paymentDetails;
    var missingParams = [];
    if (!patientId) {
        missingParams.push('patientId');
    }
    if (!encounterId) {
        missingParams.push('encounterId');
    }
    if (!paymentDetails) {
        missingParams.push('paymentDetails');
    }
    if (missingParams.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingParams);
    }
    if (typeof paymentDetails !== 'object' || !paymentDetails.paymentMethod || !paymentDetails.amountInCents) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"paymentDetails" must be an object with a "paymentMethod" property and an "amountInCents" property that is a valid non-zero integer.');
    }
    if (!(0, utils_1.isValidUUID)(patientId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patientId" must be a valid UUID.');
    }
    if (!(0, utils_1.isValidUUID)(encounterId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"encounterId" must be a valid UUID.');
    }
    var paymentMethod = paymentDetails.paymentMethod, amountInCents = paymentDetails.amountInCents, paymentMethodId = paymentDetails.paymentMethodId, description = paymentDetails.description;
    if (paymentMethod !== 'card' &&
        paymentMethod !== 'card-reader' &&
        paymentMethod !== 'cash' &&
        paymentMethod !== 'check') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"paymentDetails.paymentMethod" must be "card", "card-reader", "cash", or "check".');
    }
    if (paymentMethod === 'card' && !paymentMethodId) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"paymentDetails.paymentMethodId" is required for card payments.');
    }
    var verifiedAmount = parseInt(amountInCents);
    if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"paymentDetails.amountInCents" must be a valid non-zero integer.');
    }
    if (description && typeof description !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"paymentDetails.description" must be a string if provided.');
    }
    return {
        patientId: patientId,
        encounterId: encounterId,
        paymentDetails: __assign(__assign({}, paymentDetails), { amountInCents: verifiedAmount }),
    };
};
var validateEnvironmentParameters = function (input, isCardPayment) {
    var secrets = input.secrets;
    if (!secrets) {
        throw new Error('Secrets are required for this operation.');
    }
    var organizationId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, secrets);
    if (!organizationId) {
        throw (0, utils_1.MISCONFIGURED_ENVIRONMENT_ERROR)('"ORGANIZATION_ID" environment variable was not set. Please ensure it is configured in project secrets.');
    }
    var stripeKey = null;
    if (isCardPayment) {
        try {
            stripeKey = (0, utils_1.getSecret)(utils_1.SecretsKeys.STRIPE_SECRET_KEY, secrets);
        }
        catch (_a) {
            throw (0, utils_1.MISCONFIGURED_ENVIRONMENT_ERROR)('"STRIPE_SECRET_KEY" environment variable was not set. Please ensure it is configured in project secrets.');
        }
    }
    return { organizationId: organizationId, stripeKey: stripeKey, secrets: secrets };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientAccount, stripeAccount, stripeCustomerId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(input.paymentDetails.paymentMethod === 'card')) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(input.patientId, oystehr)];
            case 1:
                patientAccount = _a.sent();
                if (!patientAccount.account) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                }
                return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ encounterId: input.encounterId }, oystehr)];
            case 2:
                stripeAccount = _a.sent();
                stripeCustomerId = (0, utils_1.getStripeCustomerIdFromAccount)(patientAccount.account, stripeAccount);
                if (!stripeCustomerId) {
                    throw utils_1.STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
                }
                return [2 /*return*/, __assign({ cardInput: { stripeCustomerId: stripeCustomerId }, stripeAccount: stripeAccount }, input)];
            case 3: return [2 /*return*/, __assign({}, input)];
        }
    });
}); };
var makePaymentNotice = function (input) {
    var encounterId = input.encounterId, paymentDetails = input.paymentDetails, submitterRef = input.submitterRef, stripePaymentIntentId = input.stripePaymentIntentId, candidPaymentId = input.candidPaymentId, dateTimeIso = input.dateTimeIso, recipientId = input.recipientId;
    var paymentMethod = paymentDetails.paymentMethod, amountInCents = paymentDetails.amountInCents;
    var identifier;
    if (paymentMethod === 'card' && stripePaymentIntentId) {
        identifier = (0, shared_1.makeBusinessIdentifierForStripePayment)(stripePaymentIntentId);
    }
    else if (candidPaymentId) {
        identifier = (0, shared_1.makeBusinessIdentifierForCandidPayment)(candidPaymentId);
    }
    // the created timestamp is in UTC and the exact date in any timezone can always be derived from there
    // for now the payment date on the PaymentNotice is set to the default timezone (US Eastern)
    var paymentDate = luxon_1.DateTime.fromISO(dateTimeIso).setZone(utils_1.TIMEZONES[0]).toFormat('yyyy-MM-dd');
    var created = luxon_1.DateTime.fromISO(dateTimeIso).toUTC().toISO();
    if (!created) {
        throw new Error('Invalid dateTimeIso provided for PaymentNotice creation');
    }
    console.log('payment date', paymentDate);
    var amountInDollars = amountInCents / 100.0;
    var paymentAmount = {
        value: amountInDollars,
        currency: 'USD',
    };
    var reconciliation = {
        resourceType: 'PaymentReconciliation',
        id: 'contained-reconciliation',
        status: 'active',
        created: created,
        disposition: paymentMethod === 'card'
            ? 'card payment intent created and confirmed with Stripe'
            : "".concat(paymentMethod, " collected from patient"),
        outcome: 'complete',
        paymentDate: paymentDate,
        paymentAmount: paymentAmount,
        detail: [
            {
                type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/payment-type', code: 'payment' }] },
                submitter: submitterRef,
            },
        ],
    };
    var notice = {
        resourceType: 'PaymentNotice',
        status: 'active',
        request: { reference: "Encounter/".concat(encounterId), type: 'Encounter' },
        created: created,
        amount: paymentAmount,
        contained: [reconciliation],
        extension: [
            {
                url: utils_1.PAYMENT_METHOD_EXTENSION_URL,
                valueString: paymentMethod,
            },
        ],
        payment: {
            reference: "#".concat(reconciliation.id),
        },
        recipient: { reference: "Organization/".concat(recipientId) },
    };
    if (identifier) {
        notice.identifier = [identifier];
    }
    return notice;
};
