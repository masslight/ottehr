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
exports.composeAndCreateDischargeSummaryPdf = composeAndCreateDischargeSummaryPdf;
var node_fs_1 = require("node:fs");
var utils_1 = require("utils");
var presigned_file_urls_1 = require("../presigned-file-urls");
var mappers_1 = require("./helpers/mappers");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
var visit_note_pdf_creation_1 = require("./visit-details-pdf/visit-note-pdf-creation");
function mapResourceByNameField(data) {
    var result = [];
    data.forEach(function (element) {
        if ('name' in element && element.name) {
            result.push(element.name);
        }
        else if ('display' in element && element.display) {
            result.push(element.display);
        }
    });
    return result;
}
function composeAndCreateDischargeSummaryPdf(allChartData, appointmentPackage, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var data, pdfInfo;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!((_a = appointmentPackage.patient) === null || _a === void 0 ? void 0 : _a.id)) {
                        throw new Error('Patient information is missing from the appointment package.');
                    }
                    console.log('Start composing data for pdf');
                    data = composeDataForDischargeSummaryPdf(allChartData, appointmentPackage);
                    console.log('Start creating pdf');
                    return [4 /*yield*/, createDischargeSummaryPDF(data, appointmentPackage.patient.id, secrets, token)];
                case 1:
                    pdfInfo = _b.sent();
                    return [2 /*return*/, { pdfInfo: pdfInfo, attached: data.attachmentDocRefs }];
            }
        });
    });
}
var parseParticipantInfo = function (practitioner) {
    var _a, _b, _c, _d, _e, _f, _g;
    return ({
        firstName: (_d = (_c = (_b = (_a = practitioner.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : '',
        lastName: (_g = (_f = (_e = practitioner.name) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.family) !== null && _g !== void 0 ? _g : '',
    });
};
function composeDataForDischargeSummaryPdf(allChartData, appointmentPackage) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19;
    var chartData = allChartData.chartData, additionalChartData = allChartData.additionalChartData, radiologyData = allChartData.radiologyData, externalLabsData = allChartData.externalLabsData, inHouseOrdersData = allChartData.inHouseOrdersData, medicationOrders = allChartData.medicationOrders;
    var patient = appointmentPackage.patient, encounter = appointmentPackage.encounter, appointment = appointmentPackage.appointment, location = appointmentPackage.location, practitioners = appointmentPackage.practitioners, timezone = appointmentPackage.timezone;
    if (!patient)
        throw new Error('No patient found for this encounter');
    var attachmentDocRefs = [];
    // --- Patient information ---
    var fullName = (_a = (0, visit_note_pdf_creation_1.getPatientLastFirstName)(patient)) !== null && _a !== void 0 ? _a : '';
    var dob = (_b = (0, utils_1.formatDOB)(patient === null || patient === void 0 ? void 0 : patient.birthDate)) !== null && _b !== void 0 ? _b : '';
    var sex = (_c = utils_1.genderMap[patient.gender]) !== null && _c !== void 0 ? _c : '';
    var id = (_d = patient.id) !== null && _d !== void 0 ? _d : '';
    var phone = (0, utils_1.standardizePhoneNumber)((_f = (_e = patient.telecom) === null || _e === void 0 ? void 0 : _e.find(function (telecom) { return telecom.system === 'phone'; })) === null || _f === void 0 ? void 0 : _f.value);
    // --- Visit information ---
    var type = (0, utils_1.getAppointmentType)(appointment).type;
    var _20 = (_g = (0, utils_1.formatDateToMDYWithTime)(appointment === null || appointment === void 0 ? void 0 : appointment.start, timezone !== null && timezone !== void 0 ? timezone : 'America/New_York')) !== null && _g !== void 0 ? _g : {}, _21 = _20.date, date = _21 === void 0 ? '' : _21, _22 = _20.time, time = _22 === void 0 ? '' : _22;
    var locationName = (_h = location === null || location === void 0 ? void 0 : location.name) !== null && _h !== void 0 ? _h : '';
    var reasonForVisit = (_j = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _j !== void 0 ? _j : '';
    // --- Current Medications ---
    var currentMedications = chartData.medications ? mapResourceByNameField(chartData.medications) : [];
    var currentMedicationsNotes = (_l = (_k = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _k === void 0 ? void 0 : _k.filter(function (note) { return note.type === utils_1.NOTE_TYPE.INTAKE_MEDICATION; })) === null || _l === void 0 ? void 0 : _l.map(function (note) { return note.text; });
    // --- Allergies ---
    var allergies = chartData.allergies
        ? mapResourceByNameField((_m = chartData === null || chartData === void 0 ? void 0 : chartData.allergies) === null || _m === void 0 ? void 0 : _m.filter(function (allergy) { return allergy.current === true; }))
        : [];
    var allergiesNotes = (_p = (_o = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _o === void 0 ? void 0 : _o.filter(function (note) { return note.type === utils_1.NOTE_TYPE.ALLERGY; })) === null || _p === void 0 ? void 0 : _p.map(function (note) { return note.text; });
    // --- Vitals ---
    var vitals = (additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.vitalsObservations)
        ? (0, utils_1.mapVitalsToDisplay)(additionalChartData.vitalsObservations, false)
        : undefined;
    // --- In-House Labs ---
    var inHouseLabResults = (_r = (_q = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.inHouseLabResults) === null || _q === void 0 ? void 0 : _q.labOrderResults) !== null && _r !== void 0 ? _r : [];
    var inHouseLabOrders = ((_s = inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.serviceRequests) === null || _s === void 0 ? void 0 : _s.length)
        ? (0, mappers_1.mapResourcesToInHouseLabOrders)(inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.serviceRequests, inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.activityDefinitions, inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.observations)
        : [];
    // --- External Labs ---
    var externalLabResults = (_u = (_t = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.externalLabResults) === null || _t === void 0 ? void 0 : _t.labOrderResults) !== null && _u !== void 0 ? _u : [];
    var externalLabOrders = ((_v = externalLabsData === null || externalLabsData === void 0 ? void 0 : externalLabsData.serviceRequests) === null || _v === void 0 ? void 0 : _v.length)
        ? (0, mappers_1.mapResourcesToExternalLabOrders)(externalLabsData === null || externalLabsData === void 0 ? void 0 : externalLabsData.serviceRequests)
        : [];
    // --- Radiology ---
    var radiology = radiologyData === null || radiologyData === void 0 ? void 0 : radiologyData.orders.map(function (order) { return ({
        name: order.studyType,
        result: order.result,
    }); });
    // --- In-House Medications ---
    var inhouseMedications = medicationOrders ? (0, utils_1.mapMedicationsToDisplay)(medicationOrders, timezone) : [];
    // --- eRx ---
    var erxMedications = (additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.prescribedMedications)
        ? (0, utils_1.mapErxMedicationsToDisplay)(additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.prescribedMedications, timezone)
        : [];
    // --- Assessment ---
    var diagnoses = (chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis)
        ? {
            primary: mapResourceByNameField(chartData.diagnosis.filter(function (d) { return d.isPrimary; })),
            secondary: mapResourceByNameField(chartData.diagnosis.filter(function (d) { return !d.isPrimary; })),
        }
        : { primary: [], secondary: [] };
    // --- Patient instructions ---
    var patientInstructions = [];
    (_w = chartData === null || chartData === void 0 ? void 0 : chartData.instructions) === null || _w === void 0 ? void 0 : _w.forEach(function (item) {
        if (item.text)
            patientInstructions.push(item.text);
    });
    // --- General patient education documents ---
    var educationDocuments = [];
    // --- Discharge instructions ---
    var disposition = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.disposition;
    var label = '';
    var instruction = '';
    var followUpIn;
    var reason;
    if (disposition === null || disposition === void 0 ? void 0 : disposition.type) {
        label = utils_1.mapDispositionTypeToLabel[disposition.type];
        instruction = disposition.note || (0, utils_1.getDefaultNote)(disposition.type);
        reason = disposition.reason;
        followUpIn = (_x = utils_1.followUpInOptions.find(function (opt) { return opt.value === disposition.followUpIn; })) === null || _x === void 0 ? void 0 : _x.label;
    }
    // --- Work-school excuse ---
    var workSchoolExcuse = [];
    (_y = chartData.schoolWorkNotes) === null || _y === void 0 ? void 0 : _y.forEach(function (ws) {
        if (ws.id)
            attachmentDocRefs.push(ws.id);
        if (ws.type === 'school')
            workSchoolExcuse.push({ note: 'There was a school note generated' });
        else
            workSchoolExcuse.push({ note: 'There was a work note generated' });
    });
    // --- Physician information ---
    var attenderParticipant = (_z = encounter.participant) === null || _z === void 0 ? void 0 : _z.find(function (p) { var _a; return (_a = p === null || p === void 0 ? void 0 : p.type) === null || _a === void 0 ? void 0 : _a.find(function (t) { var _a; return (_a = t === null || t === void 0 ? void 0 : t.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.code === 'ATND'; }); }); });
    var attenderPractitionerId = (_1 = (_0 = attenderParticipant === null || attenderParticipant === void 0 ? void 0 : attenderParticipant.individual) === null || _0 === void 0 ? void 0 : _0.reference) === null || _1 === void 0 ? void 0 : _1.split('/').at(-1);
    var attenderPractitioner = practitioners === null || practitioners === void 0 ? void 0 : practitioners.find(function (practitioner) { return practitioner.id === attenderPractitionerId; });
    var _23 = attenderPractitioner
        ? parseParticipantInfo(attenderPractitioner)
        : {}, physicianFirstName = _23.firstName, physicianLastName = _23.lastName;
    var _24 = (_3 = (0, utils_1.formatDateToMDYWithTime)((_2 = attenderParticipant === null || attenderParticipant === void 0 ? void 0 : attenderParticipant.period) === null || _2 === void 0 ? void 0 : _2.end, timezone !== null && timezone !== void 0 ? timezone : 'America/New_York')) !== null && _3 !== void 0 ? _3 : {}, dischargedDate = _24.date, dischargeTime = _24.time;
    var dischargeDateTime = dischargedDate && dischargeTime ? "".concat(dischargedDate, " at ").concat(dischargeTime) : undefined;
    return {
        patient: {
            fullName: fullName,
            dob: dob,
            sex: sex,
            id: id,
            phone: phone,
        },
        visit: {
            type: type,
            time: time,
            date: date,
            location: locationName,
            reasonForVisit: reasonForVisit,
        },
        vitals: {
            temp: (_5 = (_4 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-temperature']) === null || _4 === void 0 ? void 0 : _4.at(-1)) !== null && _5 !== void 0 ? _5 : '',
            hr: (_7 = (_6 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-heartbeat']) === null || _6 === void 0 ? void 0 : _6.at(-1)) !== null && _7 !== void 0 ? _7 : '',
            rr: (_9 = (_8 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-respiration-rate']) === null || _8 === void 0 ? void 0 : _8.at(-1)) !== null && _9 !== void 0 ? _9 : '',
            bp: (_11 = (_10 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-blood-pressure']) === null || _10 === void 0 ? void 0 : _10.at(-1)) !== null && _11 !== void 0 ? _11 : '',
            oxygenSat: (_13 = (_12 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-oxygen-sat']) === null || _12 === void 0 ? void 0 : _12.at(-1)) !== null && _13 !== void 0 ? _13 : '',
            weight: (_15 = (_14 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-weight']) === null || _14 === void 0 ? void 0 : _14.at(-1)) !== null && _15 !== void 0 ? _15 : '',
            height: (_17 = (_16 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-height']) === null || _16 === void 0 ? void 0 : _16.at(-1)) !== null && _17 !== void 0 ? _17 : '',
            vision: (_19 = (_18 = vitals === null || vitals === void 0 ? void 0 : vitals['vital-vision']) === null || _18 === void 0 ? void 0 : _18.at(-1)) !== null && _19 !== void 0 ? _19 : '',
        },
        currentMedications: currentMedications,
        currentMedicationsNotes: currentMedicationsNotes,
        allergies: allergies,
        allergiesNotes: allergiesNotes,
        inHouseLabs: {
            orders: inHouseLabOrders,
            results: inHouseLabResults,
        },
        externalLabs: {
            orders: externalLabOrders,
            results: externalLabResults,
        },
        radiology: radiology,
        inhouseMedications: inhouseMedications,
        erxMedications: erxMedications,
        diagnoses: diagnoses,
        patientInstructions: patientInstructions,
        educationDocuments: educationDocuments,
        disposition: {
            label: label,
            instruction: instruction,
            reason: reason,
            followUpIn: followUpIn,
        },
        physician: {
            name: "".concat(physicianFirstName, " ").concat(physicianLastName),
        },
        dischargeDateTime: dischargeDateTime,
        workSchoolExcuse: workSchoolExcuse,
        documentsAttached: true,
        attachmentDocRefs: attachmentDocRefs,
    };
}
function createDischargeSummaryPdfBytes(data) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfClient, regularFont, boldFont, callIcon, inconclusiveIcon, abnormalIcon, normalIcon, textStyles, separatedLineStyle, drawHeader, drawDescription, drawPatientInfo, drawReasonForVisit, drawVitalsSection, drawAllergies, drawCurrentMedications, regularTextNoLineAfter, getFlagsExcludingNeutral, getTestNameTextStyle, getCurBounds, drawResultFlags, drawInHouseLabs, drawExternalLabs, drawRadiology, drawInHouseMedications, drawErxMedications, drawAssessment, drawInstructions, drawEducationalDocuments, drawDisposition, drawWorkSchoolExcuse, drawPhysicianInfo;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        return __generator(this, function (_w) {
            switch (_w.label) {
                case 0: return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdf_consts_1.PDF_CLIENT_STYLES)];
                case 1:
                    pdfClient = _w.sent();
                    return [4 /*yield*/, pdfClient.embedFont(node_fs_1.default.readFileSync('./assets/Rubik-Regular.otf'))];
                case 2:
                    regularFont = _w.sent();
                    return [4 /*yield*/, pdfClient.embedFont(node_fs_1.default.readFileSync('./assets/Rubik-Medium.ttf'))];
                case 3:
                    boldFont = _w.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/call.png'))];
                case 4:
                    callIcon = _w.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/inconclusive.png'))];
                case 5:
                    inconclusiveIcon = _w.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/abnormal.png'))];
                case 6:
                    abnormalIcon = _w.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/normal.png'))];
                case 7:
                    normalIcon = _w.sent();
                    textStyles = {
                        header: {
                            fontSize: 16,
                            font: boldFont,
                            side: 'right',
                            spacing: 5,
                            newLineAfter: true,
                        },
                        patientName: {
                            fontSize: 16,
                            font: boldFont,
                            spacing: 5,
                            newLineAfter: true,
                        },
                        subHeader: {
                            fontSize: 14,
                            font: boldFont,
                            spacing: 5,
                            newLineAfter: true,
                        },
                        attachmentTitle: {
                            fontSize: 12,
                            font: regularFont,
                            color: (0, pdf_utils_1.rgbNormalized)(102, 102, 102),
                            spacing: 2,
                            newLineAfter: true,
                        },
                        regular: {
                            fontSize: 12,
                            font: regularFont,
                            spacing: 2,
                            newLineAfter: true,
                        },
                        bold: {
                            fontSize: 12,
                            font: boldFont,
                            spacing: 2,
                            newLineAfter: true,
                        },
                    };
                    separatedLineStyle = {
                        thickness: 1,
                        color: (0, pdf_utils_1.rgbNormalized)(227, 230, 239),
                        margin: {
                            top: 8,
                            bottom: 8,
                        },
                    };
                    drawHeader = function (text, styles) {
                        if (styles === void 0) { styles = textStyles.header; }
                        pdfClient.drawText(text, styles);
                    };
                    drawDescription = function (styles) {
                        var _a;
                        if (styles === void 0) { styles = __assign(__assign({}, textStyles.regular), { side: 'right' }); }
                        pdfClient.drawText("".concat(data.visit.type, " | ").concat(data.visit.time, " | ").concat(data.visit.date), styles);
                        pdfClient.drawText((_a = data.visit.location) !== null && _a !== void 0 ? _a : '', styles);
                    };
                    drawPatientInfo = function () {
                        pdfClient.drawText(data.patient.fullName, textStyles.patientName);
                        pdfClient.drawText("DOB: ".concat(data.patient.dob, " | ").concat(data.patient.sex), textStyles.regular);
                        pdfClient.drawText("PID: ".concat(data.patient.id), textStyles.regular);
                        if (data.patient.phone) {
                            pdfClient.drawImage(callIcon, pdf_consts_1.ICON_STYLE, textStyles.text);
                            pdfClient.drawTextSequential(" ".concat(data.patient.phone), textStyles.regular);
                        }
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawReasonForVisit = function () {
                        pdfClient.drawText('Reason for visit', textStyles.subHeader);
                        pdfClient.drawText(data.visit.reasonForVisit, textStyles.regular);
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawVitalsSection = function () {
                        pdfClient.drawText('Vitals', textStyles.subHeader);
                        var vitals = [
                            ['Temp', data.vitals.temp, 'Oxygen Sat', data.vitals.oxygenSat],
                            ['HR', data.vitals.hr, 'Weight', data.vitals.weight],
                            ['RR', data.vitals.rr, 'Height', data.vitals.height],
                            ['BP', data.vitals.bp, 'Vision', data.vitals.vision],
                        ];
                        var leftX = pdfClient.getLeftBound();
                        var colGap = 5;
                        var colWidth = (pdfClient.getRightBound() - leftX - colGap) / 2;
                        var rightX = leftX + colWidth + colGap;
                        var y = pdfClient.getY();
                        var lineHeight = textStyles.regular.font.heightAtSize(textStyles.regular.fontSize);
                        var rowSpacing = 6;
                        vitals.forEach(function (_a) {
                            var label1 = _a[0], value1 = _a[1], label2 = _a[2], value2 = _a[3];
                            pdfClient.drawTextSequential("".concat(label1, ": "), __assign(__assign({}, textStyles.bold), { newLineAfter: false }), {
                                leftBound: leftX,
                                rightBound: leftX + colWidth,
                            });
                            var label1Width = pdfClient.getTextDimensions("".concat(label1, ": "), textStyles.bold).width;
                            pdfClient.drawTextSequential("".concat(value1), __assign(__assign({}, textStyles.regular), { newLineAfter: true }), {
                                leftBound: leftX + label1Width,
                                rightBound: leftX + label1Width + colWidth,
                            });
                            pdfClient.setY(y);
                            pdfClient.drawTextSequential("".concat(label2, ": "), __assign(__assign({}, textStyles.bold), { newLineAfter: false }), {
                                leftBound: rightX,
                                rightBound: rightX + colWidth,
                            });
                            var label2Width = pdfClient.getTextDimensions("".concat(label2, ": "), textStyles.bold).width;
                            pdfClient.drawTextSequential("".concat(value2), __assign(__assign({}, textStyles.regular), { newLineAfter: true }), {
                                leftBound: rightX + label2Width,
                                rightBound: rightX + label2Width + colWidth,
                            });
                            y -= lineHeight + rowSpacing;
                            pdfClient.setY(y);
                        });
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawAllergies = function () {
                        var _a, _b;
                        pdfClient.drawText('Known Allergies', textStyles.subHeader);
                        var allergies = (_a = data.allergies) === null || _a === void 0 ? void 0 : _a.join('; ');
                        var notes = ((_b = data.allergiesNotes) === null || _b === void 0 ? void 0 : _b.length) ? '; ' + data.allergiesNotes.join('; ') : '';
                        var fullLine = allergies + notes;
                        pdfClient.drawText(fullLine, textStyles.regular);
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawCurrentMedications = function () {
                        var _a, _b;
                        pdfClient.drawText('Current Medications', textStyles.subHeader);
                        var medications = (_a = data.currentMedications) === null || _a === void 0 ? void 0 : _a.join('; ');
                        var notes = ((_b = data.currentMedicationsNotes) === null || _b === void 0 ? void 0 : _b.length) ? '; ' + data.currentMedicationsNotes.join('; ') : '';
                        var fullLine = medications + notes;
                        pdfClient.drawText(fullLine, textStyles.regular);
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    regularTextNoLineAfter = __assign(__assign({}, textStyles.regular), { newLineAfter: false });
                    getFlagsExcludingNeutral = function (flags) {
                        return flags.filter(function (flag) { return flag !== utils_1.NonNormalResult.Neutral; });
                    };
                    getTestNameTextStyle = function (nonNormalResultContained, labType) {
                        // results are normal, no flags
                        if (!nonNormalResultContained) {
                            if (labType === 'inhouse') {
                                // there will be a normal flag therefore the test name should not have a new line after it is written
                                return regularTextNoLineAfter;
                            }
                            else {
                                // no normal flag therefore the test name should have a new line after it is written
                                return textStyles.regular;
                            }
                        }
                        var flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
                        if (flagsExcludingNeutral.length > 0) {
                            // results have a flag to display therefore the test name should not have a new line after it is written
                            return regularTextNoLineAfter;
                        }
                        else {
                            // no flags for neutral tests, new line after test name
                            return textStyles.regular;
                        }
                    };
                    getCurBounds = function () { return ({
                        leftBound: pdfClient.getX(),
                        rightBound: pdfClient.getRightBound(),
                    }); };
                    drawResultFlags = function (nonNormalResultContained, labType) {
                        var resultFlagIconStyle = __assign(__assign({}, pdf_consts_1.ICON_STYLE), { margin: { left: 5, right: 5 } });
                        if (nonNormalResultContained && nonNormalResultContained.length > 0) {
                            var flagsExcludingNeutral_1 = getFlagsExcludingNeutral(nonNormalResultContained);
                            if (flagsExcludingNeutral_1 === null || flagsExcludingNeutral_1 === void 0 ? void 0 : flagsExcludingNeutral_1.length) {
                                flagsExcludingNeutral_1.forEach(function (flag, idx) {
                                    var lastFlag = (flagsExcludingNeutral_1 === null || flagsExcludingNeutral_1 === void 0 ? void 0 : flagsExcludingNeutral_1.length) === idx + 1;
                                    var style = lastFlag ? textStyles.regular : regularTextNoLineAfter;
                                    if (flag === utils_1.NonNormalResult.Abnormal) {
                                        pdfClient.drawImage(abnormalIcon, resultFlagIconStyle, regularTextNoLineAfter);
                                        pdfClient.drawTextSequential('Abnormal', __assign(__assign({}, style), { color: (0, pdf_utils_1.rgbNormalized)(237, 108, 2) }), getCurBounds());
                                    }
                                    else if (flag === utils_1.NonNormalResult.Inconclusive) {
                                        pdfClient.drawImage(inconclusiveIcon, resultFlagIconStyle, regularTextNoLineAfter);
                                        pdfClient.drawTextSequential('Inconclusive', __assign(__assign({}, style), { color: (0, pdf_utils_1.rgbNormalized)(117, 117, 117) }), getCurBounds());
                                    }
                                });
                            }
                        }
                        else if (labType === 'inhouse') {
                            // too hairy to assume normal results for external labs so we will only do this for inhouse
                            pdfClient.drawImage(normalIcon, resultFlagIconStyle, regularTextNoLineAfter);
                            pdfClient.drawTextSequential('Normal', __assign(__assign({}, textStyles.regular), { color: (0, pdf_utils_1.rgbNormalized)(46, 125, 50) }), getCurBounds());
                        }
                    };
                    drawInHouseLabs = function () {
                        var _a, _b, _c, _d;
                        pdfClient.drawText('In-House Labs', textStyles.subHeader);
                        if ((_a = data.inHouseLabs) === null || _a === void 0 ? void 0 : _a.orders.length) {
                            pdfClient.drawText('Orders:', textStyles.subHeader);
                            (_b = data.inHouseLabs) === null || _b === void 0 ? void 0 : _b.orders.forEach(function (order) {
                                pdfClient.drawText(order.testItemName, textStyles.regular);
                            });
                        }
                        if ((_c = data.inHouseLabs) === null || _c === void 0 ? void 0 : _c.results.length) {
                            pdfClient.drawText('Results:', textStyles.subHeader);
                            (_d = data.inHouseLabs) === null || _d === void 0 ? void 0 : _d.results.forEach(function (result) {
                                var testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'inhouse');
                                pdfClient.drawTextSequential(result.name, testNameTextStyle, {
                                    leftBound: pdfClient.getLeftBound(),
                                    rightBound: pdfClient.getRightBound(),
                                });
                                drawResultFlags(result.nonNormalResultContained, 'inhouse');
                            });
                        }
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawExternalLabs = function () {
                        var _a, _b, _c, _d;
                        pdfClient.drawText('External Labs', textStyles.subHeader);
                        if ((_a = data.externalLabs) === null || _a === void 0 ? void 0 : _a.orders.length) {
                            pdfClient.drawText('Orders:', textStyles.subHeader);
                            (_b = data.externalLabs) === null || _b === void 0 ? void 0 : _b.orders.forEach(function (order) {
                                pdfClient.drawText(order.testItemName, textStyles.regular);
                            });
                        }
                        if ((_c = data.externalLabs) === null || _c === void 0 ? void 0 : _c.results.length) {
                            pdfClient.drawText('Results:', textStyles.subHeader);
                            (_d = data.externalLabs) === null || _d === void 0 ? void 0 : _d.results.forEach(function (result) {
                                var testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'external');
                                pdfClient.drawTextSequential(result.name, testNameTextStyle, {
                                    leftBound: pdfClient.getLeftBound(),
                                    rightBound: pdfClient.getRightBound(),
                                });
                                drawResultFlags(result.nonNormalResultContained, 'external');
                            });
                        }
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawRadiology = function () {
                        var _a;
                        pdfClient.drawText('Radiology', textStyles.subHeader);
                        (_a = data.radiology) === null || _a === void 0 ? void 0 : _a.forEach(function (radiology) {
                            pdfClient.drawText(radiology.name, textStyles.bold);
                            if (radiology.result)
                                pdfClient.drawText("Final Read: ".concat(radiology.result), textStyles.regular);
                        });
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawInHouseMedications = function () {
                        var _a;
                        pdfClient.drawText('In-house Medications', textStyles.subHeader);
                        (_a = data.inhouseMedications) === null || _a === void 0 ? void 0 : _a.forEach(function (medication) {
                            pdfClient.drawText("".concat(medication.name).concat(medication.dose ? ' - ' + medication.dose : '').concat(medication.route ? ' / ' + medication.route : ''), textStyles.bold);
                            if (medication.date)
                                pdfClient.drawText(medication.date, textStyles.regular);
                        });
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawErxMedications = function () {
                        var _a;
                        pdfClient.drawText('eRX', textStyles.subHeader);
                        (_a = data.erxMedications) === null || _a === void 0 ? void 0 : _a.forEach(function (rx) {
                            pdfClient.drawText("".concat(rx.name), textStyles.bold);
                            if (rx.instructions)
                                pdfClient.drawText(rx.instructions, textStyles.regular);
                            if (rx.date)
                                pdfClient.drawText(rx.date, textStyles.regular);
                        });
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawAssessment = function () {
                        var _a, _b, _c, _d;
                        pdfClient.drawText('Assessment', textStyles.subHeader);
                        if ((_a = data.diagnoses) === null || _a === void 0 ? void 0 : _a.primary.length) {
                            pdfClient.drawText('Primary Dx:', textStyles.subHeader);
                            (_b = data.diagnoses) === null || _b === void 0 ? void 0 : _b.primary.forEach(function (dx) {
                                pdfClient.drawText(dx, textStyles.regular);
                            });
                        }
                        if ((_c = data.diagnoses) === null || _c === void 0 ? void 0 : _c.secondary.length) {
                            pdfClient.drawText('Secondary Dx:', textStyles.subHeader);
                            (_d = data.diagnoses) === null || _d === void 0 ? void 0 : _d.secondary.forEach(function (dx) {
                                pdfClient.drawText(dx, textStyles.regular);
                            });
                        }
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawInstructions = function () {
                        var _a;
                        pdfClient.drawText('Patient Instructions', textStyles.subHeader);
                        (_a = data.patientInstructions) === null || _a === void 0 ? void 0 : _a.forEach(function (instruction) {
                            pdfClient.drawText("- ".concat(instruction), textStyles.regular);
                        });
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawEducationalDocuments = function () {
                        var _a;
                        pdfClient.drawText('General patient education documents', textStyles.subHeader);
                        (_a = data.educationDocuments) === null || _a === void 0 ? void 0 : _a.forEach(function (doc) {
                            pdfClient.drawText(doc.title, textStyles.regular);
                        });
                        pdfClient.drawText('Documents attached', textStyles.attachmentTitle);
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawDisposition = function () {
                        pdfClient.drawText("Disposition - ".concat(data.disposition.label), textStyles.subHeader);
                        pdfClient.drawText(data.disposition.instruction, textStyles.regular);
                        if (data.disposition.reason)
                            pdfClient.drawText("Reason for transfer: ".concat(data.disposition.reason), textStyles.regular);
                        if (data.disposition.followUpIn)
                            pdfClient.drawText("Follow-up visit in ".concat(data.disposition.followUpIn), textStyles.regular);
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawWorkSchoolExcuse = function () {
                        var _a;
                        pdfClient.drawText('Work / School Excuse', textStyles.subHeader);
                        (_a = data.workSchoolExcuse) === null || _a === void 0 ? void 0 : _a.forEach(function (doc) {
                            pdfClient.drawText(doc.note, textStyles.regular);
                        });
                        pdfClient.drawText('Documents attached', textStyles.attachmentTitle);
                        pdfClient.drawSeparatedLine(separatedLineStyle);
                    };
                    drawPhysicianInfo = function () {
                        pdfClient.drawTextSequential('Treating provider:', textStyles.subHeader);
                        pdfClient.drawText(data.physician.name, textStyles.regular);
                        if (data.dischargeDateTime) {
                            pdfClient.drawSeparatedLine(separatedLineStyle);
                            pdfClient.drawText('Discharged:', textStyles.subHeader);
                            pdfClient.drawText(data.dischargeDateTime, textStyles.regular);
                        }
                    };
                    drawHeader('DISCHARGE SUMMARY');
                    drawDescription();
                    pdfClient.setY(pdf_consts_1.PDF_CLIENT_STYLES.initialPage.height - pdf_consts_1.PDF_CLIENT_STYLES.initialPage.pageMargins.top - pdf_consts_1.Y_POS_GAP);
                    pdfClient.setX(pdfClient.getLeftBound());
                    drawPatientInfo();
                    if ((_a = data.visit) === null || _a === void 0 ? void 0 : _a.reasonForVisit)
                        drawReasonForVisit();
                    if (((_b = data.currentMedications) === null || _b === void 0 ? void 0 : _b.length) || ((_c = data.currentMedicationsNotes) === null || _c === void 0 ? void 0 : _c.length))
                        drawCurrentMedications();
                    if (((_d = data.allergies) === null || _d === void 0 ? void 0 : _d.length) || ((_e = data.allergiesNotes) === null || _e === void 0 ? void 0 : _e.length))
                        drawAllergies();
                    if (Object.values(data.vitals || {}).some(function (val) { return !!val; }))
                        drawVitalsSection();
                    if (((_f = data.inHouseLabs) === null || _f === void 0 ? void 0 : _f.orders.length) || ((_g = data.inHouseLabs) === null || _g === void 0 ? void 0 : _g.results.length))
                        drawInHouseLabs();
                    if (((_h = data.externalLabs) === null || _h === void 0 ? void 0 : _h.orders.length) || ((_j = data.externalLabs) === null || _j === void 0 ? void 0 : _j.results.length))
                        drawExternalLabs();
                    if ((_k = data.radiology) === null || _k === void 0 ? void 0 : _k.length)
                        drawRadiology();
                    if ((_l = data.inhouseMedications) === null || _l === void 0 ? void 0 : _l.length)
                        drawInHouseMedications();
                    if ((_m = data.erxMedications) === null || _m === void 0 ? void 0 : _m.length)
                        drawErxMedications();
                    if (((_p = (_o = data.diagnoses) === null || _o === void 0 ? void 0 : _o.primary) === null || _p === void 0 ? void 0 : _p.length) || ((_r = (_q = data.diagnoses) === null || _q === void 0 ? void 0 : _q.secondary) === null || _r === void 0 ? void 0 : _r.length))
                        drawAssessment();
                    if ((_s = data.patientInstructions) === null || _s === void 0 ? void 0 : _s.length)
                        drawInstructions();
                    if ((_t = data.educationDocuments) === null || _t === void 0 ? void 0 : _t.length)
                        drawEducationalDocuments();
                    if ((_u = data.disposition) === null || _u === void 0 ? void 0 : _u.instruction)
                        drawDisposition();
                    if ((_v = data.workSchoolExcuse) === null || _v === void 0 ? void 0 : _v.length)
                        drawWorkSchoolExcuse();
                    drawPhysicianInfo();
                    return [4 /*yield*/, pdfClient.save()];
                case 8: return [2 /*return*/, _w.sent()];
            }
        });
    });
}
function createDischargeSummaryPDF(data, patientID, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, bucketName, fileName, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!patientID) {
                        throw new Error('No patient id found for consent items');
                    }
                    console.log('Creating pdf bytes');
                    return [4 /*yield*/, createDischargeSummaryPdfBytes(data).catch(function (error) {
                            throw new Error('failed creating pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    console.debug("Created discharge summary pdf bytes");
                    bucketName = utils_1.BUCKET_NAMES.DISCHARGE_SUMMARIES;
                    fileName = 'DischargeSummary.pdf';
                    console.log('Creating base file url');
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, bucketName: bucketName, patientID: patientID, fileName: fileName });
                    console.log('Uploading file to bucket');
                    return [4 /*yield*/, (0, utils_1.uploadPDF)(pdfBytes, baseFileUrl, token, patientID).catch(function (error) {
                            throw new Error('failed uploading pdf to z3: ' + error.message);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
