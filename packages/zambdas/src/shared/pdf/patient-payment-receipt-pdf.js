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
exports.createPatientPaymentReceiptPdf = createPatientPaymentReceiptPdf;
var types_1 = require("ehr-ui/src/types/types");
var fs_1 = require("fs");
var lodash_1 = require("lodash");
var luxon_1 = require("luxon");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var helpers_1 = require("../../ehr/change-telemed-appointment-status/helpers/helpers");
var harvest_1 = require("../../ehr/shared/harvest");
var helpers_2 = require("../helpers");
var stripeIntegration_1 = require("../stripeIntegration");
var z3Utils_1 = require("../z3Utils");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
// lastOperationPaymentIntent is used to fill Stripe data for last (card) payment
// by default we fetch all Stripe processed payments and last one might be not there if it's a freshly created payment
function createPatientPaymentReceiptPdf(encounterId, patientId, secrets, oystehrToken, lastOperationPaymentIntent) {
    return __awaiter(this, void 0, void 0, function () {
        var stripeClient, oystehr, billingOrganizationRef, billingOrganizationId, receiptData, receiptPdf, pdfInfo, docRef;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stripeClient = (0, stripeIntegration_1.getStripeClient)(secrets);
                    oystehr = (0, helpers_2.createOystehrClient)(oystehrToken, secrets);
                    billingOrganizationRef = (0, utils_1.getSecret)(utils_1.SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets);
                    billingOrganizationId = (0, utils_1.removePrefix)('Organization/', billingOrganizationRef);
                    if (!billingOrganizationId)
                        throw new Error('No DEFAULT_BILLING_RESOURCE organization id found');
                    return [4 /*yield*/, getReceiptData(encounterId, patientId, billingOrganizationId, oystehr, stripeClient, lastOperationPaymentIntent)];
                case 1:
                    receiptData = _a.sent();
                    console.log('Got receipt data: ', JSON.stringify(receiptData));
                    console.log('Creating receipt pdf');
                    return [4 /*yield*/, createReceiptPdf(receiptData)];
                case 2:
                    receiptPdf = _a.sent();
                    console.log('Created receipt pdf');
                    return [4 /*yield*/, createReplaceReceiptOnZ3(receiptPdf, receiptData.patient.id, encounterId, secrets, oystehrToken)];
                case 3:
                    pdfInfo = _a.sent();
                    return [4 /*yield*/, (0, helpers_1.makeReceiptPdfDocumentReference)(oystehr, pdfInfo, patientId, encounterId, receiptData.listResources)];
                case 4:
                    docRef = _a.sent();
                    console.log('Created document reference: ', JSON.stringify(docRef));
                    return [2 /*return*/, pdfInfo];
            }
        });
    });
}
function getReceiptData(encounterId, patientId, organizationId, oystehr, stripeClient, lastOperationPaymentIntent) {
    return __awaiter(this, void 0, void 0, function () {
        var accountResources, account, stripeAccount, customerId, _a, fhirBundle, listResourcesBundle, organization, paymentIntents, customer, paymentMethods, resources, paymentNotices, patient, appointment, encounter, locationId, location, _b, locationName, payments, listResources, patientAddress, patientPhone, orgPhone, visitDate, organizationAddress, appointmentType, visitType;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        return __generator(this, function (_z) {
            switch (_z.label) {
                case 0: return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehr)];
                case 1:
                    accountResources = _z.sent();
                    account = accountResources.account;
                    return [4 /*yield*/, (0, utils_1.getStripeAccountForAppointmentOrEncounter)({ encounterId: encounterId }, oystehr)];
                case 2:
                    stripeAccount = _z.sent();
                    customerId = account ? (0, utils_1.getStripeCustomerIdFromAccount)(account, stripeAccount) : undefined;
                    if (!customerId)
                        throw new Error('No stripe customer id found');
                    return [4 /*yield*/, Promise.all([
                            oystehr.fhir.search({
                                resourceType: 'Encounter',
                                params: [
                                    { name: '_id', value: encounterId },
                                    { name: '_revinclude', value: 'PaymentNotice:request' },
                                    { name: '_include', value: 'Encounter:subject' },
                                    { name: '_include', value: 'Encounter:appointment' },
                                ],
                            }),
                            oystehr.fhir.search({
                                resourceType: 'List',
                                params: [{ name: 'patient', value: "Patient/".concat(patientId) }],
                            }),
                            oystehr.fhir.get({ resourceType: 'Organization', id: organizationId }),
                            stripeClient.paymentIntents.search({
                                query: "metadata['encounterId']:\"".concat(encounterId, "\" OR metadata['oystehr_encounter_id']:\"").concat(encounterId, "\""),
                                limit: 20, // default is 10
                            }),
                            stripeClient.customers.retrieve(customerId, {
                                expand: ['invoice_settings.default_payment_method', 'sources'],
                            }),
                            stripeClient.paymentMethods.list({
                                customer: customerId,
                                type: 'card',
                            }),
                        ])];
                case 3:
                    _a = _z.sent(), fhirBundle = _a[0], listResourcesBundle = _a[1], organization = _a[2], paymentIntents = _a[3], customer = _a[4], paymentMethods = _a[5];
                    resources = fhirBundle.unbundle();
                    paymentNotices = resources.filter(function (r) { return r.resourceType === 'PaymentNotice'; });
                    patient = resources.find(function (r) { return r.resourceType === 'Patient'; });
                    appointment = resources.find(function (r) { return r.resourceType === 'Appointment'; });
                    encounter = resources.find(function (r) { return r.resourceType === 'Encounter'; });
                    if (!organization || !patient || !appointment || !encounter)
                        throw new Error('One of the required resources is not found');
                    locationId = (0, utils_1.removePrefix)('Location/', (_d = (_c = encounter.location) === null || _c === void 0 ? void 0 : _c[0].location.reference) !== null && _d !== void 0 ? _d : '');
                    if (!locationId) return [3 /*break*/, 5];
                    return [4 /*yield*/, oystehr.fhir.get({ resourceType: 'Location', id: locationId })];
                case 4:
                    _b = _z.sent();
                    return [3 /*break*/, 6];
                case 5:
                    _b = undefined;
                    _z.label = 6;
                case 6:
                    location = _b;
                    locationName = location === null || location === void 0 ? void 0 : location.name;
                    // parse data
                    if (customer.deleted)
                        throw new Error('Customer is deleted');
                    payments = parsePaymentsList(paymentNotices, paymentIntents.data, customer, paymentMethods.data, lastOperationPaymentIntent);
                    listResources = listResourcesBundle.unbundle();
                    patientAddress = (0, utils_1.getPatientAddress)(patient.address);
                    patientPhone = (0, utils_1.getPhoneNumberForIndividual)(patient);
                    orgPhone = (_f = ((_e = organization.telecom) !== null && _e !== void 0 ? _e : []).find(function (cp) {
                        return cp.system === 'phone' && cp.value;
                    })) === null || _f === void 0 ? void 0 : _f.value;
                    visitDate = luxon_1.DateTime.fromISO((_g = appointment.start) !== null && _g !== void 0 ? _g : '');
                    organizationAddress = (_h = organization.address) === null || _h === void 0 ? void 0 : _h[0];
                    appointmentType = ((_j = appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === null || _j === void 0 ? void 0 : _j.text) || '';
                    visitType = types_1.appointmentTypeLabels[appointmentType];
                    return [2 /*return*/, {
                            receiptDate: (_l = (_k = payments.at(-1)) === null || _k === void 0 ? void 0 : _k.paymentDate) !== null && _l !== void 0 ? _l : '??',
                            payments: payments,
                            listResources: listResources,
                            visitData: {
                                date: visitDate.toFormat('MM/dd/yyyy'),
                                time: visitDate.toFormat('hh:mm a'),
                                type: visitType,
                                location: locationName,
                            },
                            organization: {
                                name: (_m = organization === null || organization === void 0 ? void 0 : organization.name) !== null && _m !== void 0 ? _m : '??',
                                street: (_p = (_o = organizationAddress === null || organizationAddress === void 0 ? void 0 : organizationAddress.line) === null || _o === void 0 ? void 0 : _o[0]) !== null && _p !== void 0 ? _p : '??',
                                street2: (_q = organizationAddress === null || organizationAddress === void 0 ? void 0 : organizationAddress.line) === null || _q === void 0 ? void 0 : _q[1],
                                city: (_r = organizationAddress === null || organizationAddress === void 0 ? void 0 : organizationAddress.city) !== null && _r !== void 0 ? _r : '??',
                                state: (_s = organizationAddress === null || organizationAddress === void 0 ? void 0 : organizationAddress.state) !== null && _s !== void 0 ? _s : '??',
                                zip: (_t = organizationAddress === null || organizationAddress === void 0 ? void 0 : organizationAddress.postalCode) !== null && _t !== void 0 ? _t : '??',
                                phone: orgPhone,
                            },
                            patient: {
                                id: patient.id,
                                name: (_u = (0, utils_1.getFullName)(patient)) !== null && _u !== void 0 ? _u : '??',
                                street: (_v = patientAddress.addressLine) !== null && _v !== void 0 ? _v : '??',
                                street2: patientAddress.addressLine2,
                                city: (_w = patientAddress.city) !== null && _w !== void 0 ? _w : '??',
                                state: (_x = patientAddress.state) !== null && _x !== void 0 ? _x : '??',
                                zip: (_y = patientAddress.postalCode) !== null && _y !== void 0 ? _y : '??',
                                phone: patientPhone,
                            },
                        }];
            }
        });
    });
}
function parsePaymentsList(paymentNotices, paymentIntents, customer, paymentMethods, lastOperationPaymentIntent) {
    var _a;
    if (lastOperationPaymentIntent)
        paymentIntents.push(lastOperationPaymentIntent);
    var defaultPaymentMethod = (_a = customer.invoice_settings) === null || _a === void 0 ? void 0 : _a.default_payment_method;
    var payments = paymentNotices.map(function (paymentNotice) {
        var _a, _b, _c, _d, _e, _f;
        var pnStripeId = (_b = (_a = paymentNotice.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === stripeIntegration_1.STRIPE_PAYMENT_ID_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
        var stripeIntent = paymentIntents.find(function (pi) { return pi.id === pnStripeId; });
        var stripeMethod = paymentMethods.find(function (pm) { return pm.id === (stripeIntent === null || stripeIntent === void 0 ? void 0 : stripeIntent.payment_method); });
        var amount = paymentNotice.amount.value;
        var method = (_d = (_c = paymentNotice.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === utils_1.PAYMENT_METHOD_EXTENSION_URL; })) === null || _d === void 0 ? void 0 : _d.valueString;
        if (!amount)
            throw new Error('No amount found');
        return {
            amount: amount,
            method: method,
            // todo: what date should i put here?
            paymentDate: paymentNotice === null || paymentNotice === void 0 ? void 0 : paymentNotice.created,
            last4: (_e = stripeMethod === null || stripeMethod === void 0 ? void 0 : stripeMethod.card) === null || _e === void 0 ? void 0 : _e.last4,
            brand: (_f = stripeMethod === null || stripeMethod === void 0 ? void 0 : stripeMethod.card) === null || _f === void 0 ? void 0 : _f.brand,
            isPrimary: (stripeMethod === null || stripeMethod === void 0 ? void 0 : stripeMethod.id) === (defaultPaymentMethod === null || defaultPaymentMethod === void 0 ? void 0 : defaultPaymentMethod.id),
        };
    });
    // i do sorting before formatting date to MM/dd/yyyy to make it more precise
    payments.sort(function (a, b) {
        var _a, _b;
        var dateA = luxon_1.DateTime.fromISO((_a = a.paymentDate) !== null && _a !== void 0 ? _a : '');
        var dateB = luxon_1.DateTime.fromISO((_b = b.paymentDate) !== null && _b !== void 0 ? _b : '');
        return dateA.diff(dateB).milliseconds;
    });
    payments.forEach(function (payment) { var _a; return (payment.paymentDate = luxon_1.DateTime.fromISO((_a = payment.paymentDate) !== null && _a !== void 0 ? _a : '').toFormat('MM/dd/yyyy')); });
    return payments;
}
function createReceiptPdf(receiptData) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfClientStyles, pdfClient, RubikFont, RubikFontMedium, logo, logoBuffer, textStyles, drawBlockHeader, writeText, drawHeadline, drawVisitDetails, drawOrganizationAndPatientDetails, drawPaymentDetails;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pdfClientStyles = {
                        initialPage: {
                            width: pdf_lib_1.PageSizes.A4[0],
                            height: pdf_lib_1.PageSizes.A4[1],
                            pageMargins: {
                                top: 24,
                                bottom: 24,
                                right: 24,
                                left: 24,
                            },
                        },
                    };
                    return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdfClientStyles)];
                case 1:
                    pdfClient = _a.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Regular.otf'))];
                case 2:
                    RubikFont = _a.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Medium.ttf'))];
                case 3:
                    RubikFontMedium = _a.sent();
                    return [4 /*yield*/, (0, pdf_utils_1.getPdfLogo)()];
                case 4:
                    logoBuffer = _a.sent();
                    if (!logoBuffer) return [3 /*break*/, 6];
                    return [4 /*yield*/, pdfClient.embedImage(logoBuffer)];
                case 5:
                    logo = _a.sent();
                    _a.label = 6;
                case 6:
                    textStyles = {
                        header: {
                            fontSize: 16,
                            spacing: 8,
                            font: RubikFontMedium,
                            side: 'right',
                        },
                        blockHeader: {
                            fontSize: 14,
                            spacing: 3,
                            font: RubikFontMedium,
                            newLineAfter: true,
                        },
                        text: {
                            fontSize: 12,
                            spacing: 3,
                            font: RubikFont,
                            newLineAfter: true,
                        },
                    };
                    drawBlockHeader = function (text) {
                        pdfClient.drawText(text, textStyles.blockHeader);
                    };
                    writeText = function (text, params) {
                        var styles = __assign({}, textStyles.text);
                        if (params === null || params === void 0 ? void 0 : params.side)
                            styles.side = params.side;
                        if (params === null || params === void 0 ? void 0 : params.noNewLineAfter)
                            delete styles.newLineAfter;
                        if (params === null || params === void 0 ? void 0 : params.bold)
                            styles.font = RubikFontMedium;
                        if (params === null || params === void 0 ? void 0 : params.fontSize)
                            styles.fontSize = params.fontSize;
                        if (params === null || params === void 0 ? void 0 : params.spacing)
                            styles.spacing = params.spacing;
                        pdfClient.drawText(text, styles);
                    };
                    drawHeadline = function () {
                        var imgStyles = {
                            width: 120,
                            height: 30,
                        };
                        if (logo)
                            pdfClient.drawImage(logo, imgStyles);
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        pdfClient.drawText('RECEIPT', textStyles.header);
                        pdfClient.setY(pdfClient.getY() - imgStyles.height); // new line after image
                    };
                    drawVisitDetails = function () {
                        var visit = "".concat(receiptData.visitData.type, " | ").concat(receiptData.visitData.time, " | ").concat(receiptData.visitData.date);
                        var textWidth = pdfClient.getTextDimensions("Visit: ".concat(visit), textStyles.text).width;
                        pdfClient.setX(pdfClient.getRightBound() - textWidth - 5);
                        pdfClient.drawTextSequential('Visit: ', __assign(__assign({}, textStyles.text), { font: RubikFontMedium, newLineAfter: false }));
                        pdfClient.drawTextSequential(visit, textStyles.text);
                        pdfClient.drawTextSequential('Receipt date: ', __assign(__assign({}, textStyles.text), { font: RubikFontMedium, newLineAfter: false }));
                        pdfClient.drawTextSequential("".concat(receiptData.receiptDate), __assign(__assign({}, textStyles.text), { newLineAfter: false }));
                        if (receiptData.visitData.location)
                            writeText("".concat(receiptData.visitData.location), { side: 'right' });
                        else
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    };
                    drawOrganizationAndPatientDetails = function () {
                        var pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
                        var initialRightBound = pdfClient.getRightBound();
                        var initialLeftBound = pdfClient.getLeftBound();
                        var beforeColumnsY = pdfClient.getY();
                        // Patient column
                        // Setting bounds for the first column
                        pdfClient.setRightBound(pageWidth / 2);
                        drawBlockHeader(receiptData.patient.name);
                        writeText("".concat(receiptData.patient.street));
                        if (receiptData.patient.street2)
                            writeText("".concat(receiptData.patient.street2));
                        writeText("".concat(receiptData.patient.city, ", ").concat(receiptData.patient.state, " ").concat(receiptData.patient.zip));
                        if (receiptData.patient.phone)
                            writeText("".concat(receiptData.patient.phone));
                        var afterFirstColumn = pdfClient.getY();
                        // Organization column
                        // Setting Y to the start of the table
                        pdfClient.setY(beforeColumnsY);
                        // Setting new bounds for the second column
                        pdfClient.setRightBound(initialRightBound);
                        pdfClient.setLeftBound(pageWidth / 2);
                        drawBlockHeader(receiptData.organization.name);
                        writeText("".concat(receiptData.organization.street));
                        if (receiptData.organization.street2)
                            writeText("".concat(receiptData.organization.street2));
                        writeText("".concat(receiptData.organization.city, ", ").concat(receiptData.organization.state, " ").concat(receiptData.organization.zip));
                        if (receiptData.organization.phone)
                            writeText("".concat(receiptData.organization.phone));
                        // Setting Y to the minimum so cursor will be at the bottom of the table
                        if (afterFirstColumn < pdfClient.getY())
                            pdfClient.setY(afterFirstColumn);
                        else
                            pdfClient.setY(pdfClient.getY());
                        pdfClient.setLeftBound(initialLeftBound);
                    };
                    drawPaymentDetails = function () {
                        var tableWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
                        var firstColumnWidth = tableWidth / 2;
                        var otherColumnWidth = tableWidth / 4;
                        var initialLeftBound = pdfClient.getLeftBound();
                        var totalAmount = 0;
                        drawBlockHeader('Payments');
                        // Payments list
                        receiptData.payments.forEach(function (payment) {
                            var cardText = "Card ending ".concat(payment.last4);
                            if (payment.isPrimary)
                                cardText += ' (Primary)';
                            var paymentMethodText = payment.method === 'card' ? cardText : (0, lodash_1.capitalize)(payment.method);
                            totalAmount += payment.amount;
                            pdfClient.setRightBound(initialLeftBound + firstColumnWidth);
                            writeText(paymentMethodText, { noNewLineAfter: true, spacing: 0 });
                            pdfClient.setLeftBound(initialLeftBound + firstColumnWidth);
                            pdfClient.setRightBound(initialLeftBound + firstColumnWidth + otherColumnWidth);
                            writeText("".concat(payment.paymentDate), { noNewLineAfter: true });
                            pdfClient.setLeftBound(initialLeftBound + firstColumnWidth + otherColumnWidth);
                            pdfClient.setRightBound(initialLeftBound + firstColumnWidth + otherColumnWidth * 2);
                            writeText("$ ".concat(payment.amount), { side: 'right' });
                            pdfClient.setLeftBound(initialLeftBound);
                            var grayLine = __assign({}, pdf_utils_1.SEPARATED_LINE_STYLE);
                            grayLine.margin = { top: 5, bottom: 1 };
                            pdfClient.drawSeparatedLine(grayLine);
                        });
                        // Totals
                        writeText("Total:", { noNewLineAfter: true, bold: true });
                        writeText("$ ".concat(totalAmount), { side: 'right', bold: true });
                    };
                    drawHeadline();
                    drawVisitDetails();
                    pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    drawOrganizationAndPatientDetails();
                    pdfClient.newLine(56);
                    drawPaymentDetails();
                    return [4 /*yield*/, pdfClient.save()];
                case 7: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function uploadPDF(pdfBytes, token, baseFileUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var presignedUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(token, baseFileUrl, 'upload')];
                case 1:
                    presignedUrl = _a.sent();
                    return [4 /*yield*/, (0, z3Utils_1.uploadObjectToZ3)(pdfBytes, presignedUrl)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createReplaceReceiptOnZ3(pdfBytes, patientId, encounterId, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var bucketName, fileName, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bucketName = 'receipts';
                    fileName = "".concat(encounterId, ".pdf");
                    console.log('Creating base file url');
                    baseFileUrl = makeReceiptZ3Url(secrets, bucketName, fileName, patientId);
                    console.log('Uploading file to bucket');
                    return [4 /*yield*/, uploadPDF(pdfBytes, token, baseFileUrl).catch(function (error) {
                            throw new Error('failed uploading pdf to z3: ' + error.message);
                        })];
                case 1:
                    _a.sent();
                    // savePdfLocally(pdfBytes);
                    return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
var makeReceiptZ3Url = function (secrets, bucketName, fileName, patientId) {
    var projectId = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_ID, secrets);
    var fileURL = "".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/z3/").concat(projectId, "-").concat(bucketName, "/").concat(patientId, "/").concat(fileName);
    console.log('created z3 url: ', fileURL);
    return fileURL;
};
