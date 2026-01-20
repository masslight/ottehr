"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContactInfoSection = exports.composeContactData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composeContactData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var patient = _a.patient;
    var patientAddress = (_b = patient.address) === null || _b === void 0 ? void 0 : _b[0];
    var streetAddress = (_d = (_c = patientAddress === null || patientAddress === void 0 ? void 0 : patientAddress.line) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : '';
    var addressLineOptional = (_f = (_e = patientAddress === null || patientAddress === void 0 ? void 0 : patientAddress.line) === null || _e === void 0 ? void 0 : _e[1]) !== null && _f !== void 0 ? _f : '';
    var city = (_g = patientAddress === null || patientAddress === void 0 ? void 0 : patientAddress.city) !== null && _g !== void 0 ? _g : '';
    var state = (_h = patientAddress === null || patientAddress === void 0 ? void 0 : patientAddress.state) !== null && _h !== void 0 ? _h : '';
    var zip = (_j = patientAddress === null || patientAddress === void 0 ? void 0 : patientAddress.postalCode) !== null && _j !== void 0 ? _j : '';
    var patientMobile = (_m = (0, utils_1.formatPhoneNumberDisplay)((_l = (_k = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _k === void 0 ? void 0 : _k.find(function (c) { var _a; return c.system === 'phone' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _l === void 0 ? void 0 : _l.value)) !== null && _m !== void 0 ? _m : '';
    var patientEmail = (_q = (_p = (_o = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _o === void 0 ? void 0 : _o.find(function (c) { var _a; return c.system === 'email' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _p === void 0 ? void 0 : _p.value) !== null && _q !== void 0 ? _q : '';
    var patientPreferredCommunicationMethod = (_t = (_s = (_r = patient.extension) === null || _r === void 0 ? void 0 : _r.find(function (e) { return e.url === utils_1.PREFERRED_COMMUNICATION_METHOD_EXTENSION_URL; })) === null || _s === void 0 ? void 0 : _s.valueString) !== null && _t !== void 0 ? _t : '';
    return {
        streetAddress: streetAddress,
        addressLineOptional: addressLineOptional,
        city: city,
        state: state,
        zip: zip,
        patientMobile: patientMobile,
        patientEmail: patientEmail,
        patientPreferredCommunicationMethod: patientPreferredCommunicationMethod,
    };
};
exports.composeContactData = composeContactData;
var createContactInfoSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('patientContactInformation', function (shouldShow) { return ({
        title: 'Contact information',
        dataSelector: function (data) { return data.contact; },
        render: function (client, contactInfo, styles) {
            if (shouldShow('patient-street-address')) {
                client.drawLabelValueRow('Street address', contactInfo.streetAddress, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-street-address-2')) {
                client.drawLabelValueRow('Address line 2', contactInfo.addressLineOptional, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-city') && shouldShow('patient-state') && shouldShow('patient-zip')) {
                client.drawLabelValueRow('City, State, ZIP', "".concat(contactInfo.city, ", ").concat(contactInfo.state, ", ").concat(contactInfo.zip), styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-email')) {
                client.drawLabelValueRow('Email', contactInfo.patientEmail, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-number')) {
                client.drawLabelValueRow('Mobile', contactInfo.patientMobile, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-preferred-communication-method')) {
                client.drawLabelValueRow('Preferred Communication Method', contactInfo.patientPreferredCommunicationMethod, styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createContactInfoSection = createContactInfoSection;
