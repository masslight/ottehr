"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPatientInfoSection = exports.createPatientHeader = exports.composePatientData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composePatientData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
    var patient = _a.patient, appointment = _a.appointment;
    var fullName = (_b = (0, utils_1.getFormattedPatientFullName)(patient, { skipNickname: true })) !== null && _b !== void 0 ? _b : '';
    var suffix = (_c = (0, utils_1.getNameSuffix)(patient)) !== null && _c !== void 0 ? _c : '';
    var preferredName = (_g = (_f = (_e = (_d = patient.name) === null || _d === void 0 ? void 0 : _d.find(function (name) { return name.use === 'nickname'; })) === null || _e === void 0 ? void 0 : _e.given) === null || _f === void 0 ? void 0 : _f[0]) !== null && _g !== void 0 ? _g : '';
    var dob = (0, utils_1.formatDateForDisplay)(patient === null || patient === void 0 ? void 0 : patient.birthDate);
    var unconfirmedDOB = (0, utils_1.formatDateForDisplay)((0, utils_1.getUnconfirmedDOBForAppointment)(appointment));
    var sex = (_h = utils_1.genderMap[patient.gender]) !== null && _h !== void 0 ? _h : '';
    var id = (_j = patient.id) !== null && _j !== void 0 ? _j : '';
    var phone = (_m = (0, utils_1.standardizePhoneNumber)((_l = (_k = patient.telecom) === null || _k === void 0 ? void 0 : _k.find(function (telecom) { return telecom.system === 'phone'; })) === null || _l === void 0 ? void 0 : _l.value)) !== null && _m !== void 0 ? _m : '';
    var reasonForVisit = (_o = appointment.description) !== null && _o !== void 0 ? _o : '';
    var authorizedNonlegalGuardians = ((_q = (_p = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _p === void 0 ? void 0 : _p.find(function (e) { return e.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; })) === null || _q === void 0 ? void 0 : _q.valueString) ||
        'none';
    var pronouns = (_w = (_v = (_u = (_t = (_s = (_r = patient.extension) === null || _r === void 0 ? void 0 : _r.find(function (e) { return e.url === utils_1.PATIENT_INDIVIDUAL_PRONOUNS_URL; })) === null || _s === void 0 ? void 0 : _s.valueCodeableConcept) === null || _t === void 0 ? void 0 : _t.coding) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.display) !== null && _w !== void 0 ? _w : '';
    var patientSex = '';
    if ((patient === null || patient === void 0 ? void 0 : patient.gender) === 'male') {
        patientSex = 'Male';
    }
    else if ((patient === null || patient === void 0 ? void 0 : patient.gender) === 'female') {
        patientSex = 'Female';
    }
    else if ((patient === null || patient === void 0 ? void 0 : patient.gender) !== undefined) {
        patientSex = 'Intersex';
    }
    var ssn = (_z = (_y = (_x = patient === null || patient === void 0 ? void 0 : patient.identifier) === null || _x === void 0 ? void 0 : _x.find(function (id) { var _a, _b, _c; return id.system === 'http://hl7.org/fhir/sid/us-ssn' && ((_c = (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code) === 'SS'; })) === null || _y === void 0 ? void 0 : _y.value) !== null && _z !== void 0 ? _z : '';
    return {
        fullName: fullName,
        suffix: suffix,
        preferredName: preferredName,
        dob: dob,
        unconfirmedDOB: unconfirmedDOB,
        sex: sex,
        id: id,
        phone: phone,
        reasonForVisit: reasonForVisit,
        authorizedNonlegalGuardians: authorizedNonlegalGuardians,
        pronouns: pronouns,
        ssn: ssn,
        patientSex: patientSex,
    };
};
exports.composePatientData = composePatientData;
var createPatientHeader = function () { return ({
    dataSelector: function (data) { return data.patient; },
    render: function (client, patientInfo, styles) {
        client.drawText(patientInfo.fullName, styles.textStyles.patientName);
        client.drawText("PID: ".concat(patientInfo.id), styles.textStyles.regular);
    },
}); };
exports.createPatientHeader = createPatientHeader;
var createPatientInfoSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('patientSummary', function (shouldShow) { return ({
        title: 'About the patient',
        dataSelector: function (data) { return data.patient; },
        render: function (client, patientInfo, styles) {
            if (shouldShow('patient-name-suffix')) {
                client.drawLabelValueRow('Suffix', patientInfo.suffix, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-preferred-name')) {
                client.drawLabelValueRow('Chosen or preferred name', patientInfo.preferredName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-birthdate')) {
                client.drawLabelValueRow('Date of birth (Original)', patientInfo.dob, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (patientInfo.unconfirmedDOB) {
                client.drawLabelValueRow('Date of birth (Unmatched)', patientInfo.unconfirmedDOB, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-birth-sex')) {
                client.drawLabelValueRow('Birth sex', patientInfo.sex, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-pronouns')) {
                client.drawLabelValueRow('Preferred pronouns', patientInfo.pronouns, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-ssn')) {
                client.drawLabelValueRow('SSN', patientInfo.ssn, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            client.drawLabelValueRow('Reason for visit', patientInfo.reasonForVisit, styles.textStyles.regular, styles.textStyles.regular, {
                drawDivider: true,
                dividerMargin: 8,
            });
            client.drawLabelValueRow('Authorized non-legal guardian(s)', patientInfo.authorizedNonlegalGuardians, styles.textStyles.regular, styles.textStyles.regular, { spacing: 16 });
        },
    }); });
};
exports.createPatientInfoSection = createPatientInfoSection;
