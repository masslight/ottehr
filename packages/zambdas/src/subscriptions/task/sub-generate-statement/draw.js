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
exports.generatePdf = generatePdf;
exports.formatMoney = formatMoney;
var fs_1 = require("fs");
var luxon_1 = require("luxon");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var pdf_utils_1 = require("../../../shared/pdf/pdf-utils");
var TITLE_COLOR = (0, pdf_utils_1.rgbNormalized)(15, 52, 124);
var LABEL_COLOR = (0, pdf_utils_1.rgbNormalized)(180, 180, 180);
function generatePdf(input) {
    return __awaiter(this, void 0, void 0, function () {
        var patient, appointment, location, itemizationResponse, timezone, responsibleParty, procedureNameProvider, pdfClientStyles, pdfClient, rubikFont, rubikFontBold, textStyles, tableRowSeparatorStyle, logoBuffer, logo, imgStyles, appointmentType, _a, appointmentDate, appointmentTime, timezoneToShow, locationName, beforeAppointmentInfoY, afterAppointmentInfoY, patientName, patientDob, patientMobile, patientEmail, responsiblePartyAddress, addressLine1, addressLine2, city, state, zip, address, phone, email, _i, _b, serviceLine, beforeProcedureY, _c, _d, afterProcedureY;
        var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
        return __generator(this, function (_4) {
            switch (_4.label) {
                case 0:
                    patient = input.patient, appointment = input.appointment, location = input.location, itemizationResponse = input.itemizationResponse, timezone = input.timezone, responsibleParty = input.responsibleParty, procedureNameProvider = input.procedureNameProvider;
                    pdfClientStyles = {
                        initialPage: {
                            width: pdf_lib_1.PageSizes.A4[0],
                            height: pdf_lib_1.PageSizes.A4[1],
                            pageMargins: {
                                top: 40,
                                bottom: 40,
                                right: 40,
                                left: 40,
                            },
                        },
                    };
                    return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdfClientStyles)];
                case 1:
                    pdfClient = _4.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Regular.otf'))];
                case 2:
                    rubikFont = _4.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Bold.otf'))];
                case 3:
                    rubikFontBold = _4.sent();
                    textStyles = {
                        title: {
                            fontSize: 20,
                            font: rubikFont,
                            color: TITLE_COLOR,
                            spacing: 17,
                            side: 'right',
                        },
                        subtitle: {
                            fontSize: 16,
                            spacing: 8,
                            font: rubikFont,
                            color: TITLE_COLOR,
                        },
                        regular: {
                            fontSize: 12,
                            spacing: 1,
                            font: rubikFont,
                        },
                        regularBold: {
                            fontSize: 12,
                            spacing: 1,
                            font: rubikFontBold,
                        },
                        tableContent: {
                            fontSize: 10,
                            spacing: 1,
                            font: rubikFont,
                        },
                        label: {
                            fontSize: 12,
                            spacing: 1,
                            font: rubikFont,
                            color: LABEL_COLOR,
                        },
                    };
                    tableRowSeparatorStyle = {
                        thickness: 0.5,
                        color: (0, pdf_utils_1.rgbNormalized)(200, 200, 200),
                        margin: {
                            top: 8,
                        },
                    };
                    return [4 /*yield*/, (0, pdf_utils_1.getPdfLogo)()];
                case 4:
                    logoBuffer = _4.sent();
                    if (!logoBuffer) return [3 /*break*/, 6];
                    return [4 /*yield*/, pdfClient.embedImage(logoBuffer)];
                case 5:
                    logo = _4.sent();
                    imgStyles = {
                        width: 110,
                        height: 28,
                    };
                    pdfClient.drawImage(logo, imgStyles);
                    _4.label = 6;
                case 6:
                    pdfClient.drawText('STATEMENT\n', textStyles.title);
                    appointmentType = (0, utils_1.getAppointmentType)(appointment).type;
                    _a = (_e = (0, utils_1.formatDateToMDYWithTime)(appointment === null || appointment === void 0 ? void 0 : appointment.start, timezone)) !== null && _e !== void 0 ? _e : {}, appointmentDate = _a.date, appointmentTime = _a.time;
                    timezoneToShow = (appointment === null || appointment === void 0 ? void 0 : appointment.start)
                        ? luxon_1.DateTime.fromISO(appointment.start).setZone(timezone).offsetNameShort
                        : '';
                    locationName = (_f = location === null || location === void 0 ? void 0 : location.name) !== null && _f !== void 0 ? _f : '';
                    beforeAppointmentInfoY = pdfClient.getY();
                    pdfClient.drawText("".concat(appointmentType, " | ").concat(appointmentTime, " ").concat(timezoneToShow, " | ").concat(appointmentDate, "\n"), textStyles.regular);
                    pdfClient.drawText(locationName + '\n\n', textStyles.regular);
                    afterAppointmentInfoY = pdfClient.getY();
                    pdfClient.setY(beforeAppointmentInfoY);
                    pdfClient.drawText('Statement Date\n', __assign(__assign({}, textStyles.label), { side: 'right' }));
                    pdfClient.drawText(luxon_1.DateTime.now().toFormat('MM/dd/yyyy'), __assign(__assign({}, textStyles.regular), { side: 'right' }));
                    pdfClient.setY(afterAppointmentInfoY);
                    patientName = (_g = (0, utils_1.getFullName)(patient)) !== null && _g !== void 0 ? _g : '';
                    patientDob = (_h = ((patient === null || patient === void 0 ? void 0 : patient.birthDate) && luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy'))) !== null && _h !== void 0 ? _h : '';
                    patientMobile = (_l = (0, utils_1.standardizePhoneNumber)((_k = (_j = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _j === void 0 ? void 0 : _j.find(function (c) { var _a; return c.system === 'phone' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _k === void 0 ? void 0 : _k.value)) !== null && _l !== void 0 ? _l : '';
                    patientEmail = (_p = (_o = (_m = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _m === void 0 ? void 0 : _m.find(function (c) { var _a; return c.system === 'email' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _o === void 0 ? void 0 : _o.value) !== null && _p !== void 0 ? _p : '';
                    pdfClient.drawText('Patient\n', textStyles.subtitle);
                    pdfClient.drawText("".concat(patientName, "\n"), textStyles.regularBold);
                    pdfClient.drawText("DOB: ".concat(patientDob, "\n"), textStyles.regular);
                    pdfClient.drawText("".concat(patientMobile, " | ").concat(patientEmail, "\n\n"), textStyles.regular);
                    if (responsibleParty) {
                        responsiblePartyAddress = (_q = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.address) === null || _q === void 0 ? void 0 : _q[0];
                        addressLine1 = (_s = (_r = responsiblePartyAddress === null || responsiblePartyAddress === void 0 ? void 0 : responsiblePartyAddress.line) === null || _r === void 0 ? void 0 : _r[0]) !== null && _s !== void 0 ? _s : '';
                        addressLine2 = (_u = (_t = responsiblePartyAddress === null || responsiblePartyAddress === void 0 ? void 0 : responsiblePartyAddress.line) === null || _t === void 0 ? void 0 : _t[1]) !== null && _u !== void 0 ? _u : '';
                        city = (_v = responsiblePartyAddress === null || responsiblePartyAddress === void 0 ? void 0 : responsiblePartyAddress.city) !== null && _v !== void 0 ? _v : '';
                        state = (_w = responsiblePartyAddress === null || responsiblePartyAddress === void 0 ? void 0 : responsiblePartyAddress.state) !== null && _w !== void 0 ? _w : '';
                        zip = (_x = responsiblePartyAddress === null || responsiblePartyAddress === void 0 ? void 0 : responsiblePartyAddress.postalCode) !== null && _x !== void 0 ? _x : '';
                        address = [addressLine1, addressLine2, "".concat(city, ", ").concat(state, " ").concat(zip)].filter(function (s) { return s.length > 0; }).join('\n');
                        phone = (_0 = (0, utils_1.standardizePhoneNumber)((_z = (_y = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.telecom) === null || _y === void 0 ? void 0 : _y.find(function (c) { var _a; return c.system === 'phone' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _z === void 0 ? void 0 : _z.value)) !== null && _0 !== void 0 ? _0 : '';
                        email = (_3 = (_2 = (_1 = responsibleParty === null || responsibleParty === void 0 ? void 0 : responsibleParty.telecom) === null || _1 === void 0 ? void 0 : _1.find(function (c) { var _a; return c.system === 'email' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _2 === void 0 ? void 0 : _2.value) !== null && _3 !== void 0 ? _3 : '';
                        pdfClient.drawText('Responsible party\n', textStyles.subtitle);
                        pdfClient.drawText((0, utils_1.getFullName)(responsibleParty) + '\n', textStyles.regularBold);
                        pdfClient.drawText(address + '\n', textStyles.regular);
                        pdfClient.drawText("".concat(phone, " | ").concat(email, "\n\n"), textStyles.regular);
                    }
                    pdfClient.drawText('Services provided\n', textStyles.subtitle);
                    pdfClient.drawStartXPosSpecifiedText('Service', textStyles.tableContent, 0);
                    pdfClient.drawStartXPosSpecifiedText('Price', textStyles.tableContent, 200);
                    restoreY(pdfClient, function () {
                        pdfClient.drawStartXPosSpecifiedText('Insurance\nPaid', textStyles.tableContent, 270);
                    });
                    restoreY(pdfClient, function () {
                        pdfClient.drawStartXPosSpecifiedText('Patient\nResponsibility', textStyles.tableContent, 340);
                    });
                    restoreY(pdfClient, function () {
                        pdfClient.drawStartXPosSpecifiedText('Patient\nPaid', textStyles.tableContent, 430);
                    });
                    pdfClient.drawStartXPosSpecifiedText('Balance\n\n', textStyles.tableContent, 500);
                    _i = 0, _b = itemizationResponse.serviceLineItemization;
                    _4.label = 7;
                case 7:
                    if (!(_i < _b.length)) return [3 /*break*/, 10];
                    serviceLine = _b[_i];
                    pdfClient.drawSeparatedLine(tableRowSeparatorStyle);
                    beforeProcedureY = pdfClient.getY();
                    _d = (_c = pdfClient).drawTextSequential;
                    return [4 /*yield*/, procedureNameProvider(serviceLine.procedureCode)];
                case 8:
                    _d.apply(_c, [(_4.sent()) + '\n',
                        textStyles.tableContent,
                        {
                            leftBound: 40,
                            rightBound: 180,
                        }]);
                    afterProcedureY = pdfClient.getY();
                    pdfClient.setY(beforeProcedureY);
                    pdfClient.drawStartXPosSpecifiedText(formatMoney(serviceLine.chargeAmountCents - serviceLine.insuranceAdjustments.totalAdjustmentCents), textStyles.tableContent, 200);
                    pdfClient.drawStartXPosSpecifiedText(formatMoney(serviceLine.insurancePayments.totalPaymentCents), textStyles.tableContent, 270);
                    pdfClient.drawStartXPosSpecifiedText(formatMoney(serviceLine.chargeAmountCents -
                        serviceLine.insuranceAdjustments.totalAdjustmentCents -
                        serviceLine.insurancePayments.totalPaymentCents), textStyles.tableContent, 340);
                    pdfClient.drawStartXPosSpecifiedText(formatMoney(serviceLine.patientPayments.totalPaymentCents), textStyles.tableContent, 430);
                    pdfClient.drawStartXPosSpecifiedText(formatMoney(serviceLine.patientBalanceCents), textStyles.tableContent, 500);
                    pdfClient.setY(afterProcedureY);
                    _4.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    pdfClient.drawText('\n\n', textStyles.regular);
                    pdfClient.drawText("Remaining Patient Balance: ".concat(formatMoney(itemizationResponse.patientBalanceCents)), __assign(__assign({}, textStyles.regularBold), { side: 'right' }));
                    return [2 /*return*/, pdfClient.save()];
            }
        });
    });
}
function restoreY(pdfClient, draw) {
    var y = pdfClient.getY();
    draw();
    pdfClient.setY(y);
}
function formatMoney(cents) {
    var formatMoneyTemp = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    });
    return formatMoneyTemp.format(cents / 100);
}
