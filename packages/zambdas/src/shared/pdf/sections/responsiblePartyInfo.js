"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResponsiblePartySection = exports.composeResponsiblePartyData = void 0;
var lodash_es_1 = require("lodash-es");
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composeResponsiblePartyData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    var guarantorResource = _a.guarantorResource;
    var phone = (_d = (0, utils_1.standardizePhoneNumber)((_c = (_b = guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.telecom) === null || _b === void 0 ? void 0 : _b.find(function (c) { var _a; return c.system === 'phone' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _c === void 0 ? void 0 : _c.value)) !== null && _d !== void 0 ? _d : '';
    var email = (_g = (_f = (_e = guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.telecom) === null || _e === void 0 ? void 0 : _e.find(function (c) { var _a; return c.system === 'email' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _f === void 0 ? void 0 : _f.value) !== null && _g !== void 0 ? _g : '';
    var sex = '';
    if (guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.gender) {
        var genderString = (guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.gender) === 'other' ? 'Intersex' : guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.gender;
        sex = (0, lodash_es_1.capitalize)(genderString);
    }
    var dob = (0, utils_1.formatDateForDisplay)(guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.birthDate);
    var fullName = '';
    if (guarantorResource) {
        fullName = (_h = (0, utils_1.getFullName)(guarantorResource)) !== null && _h !== void 0 ? _h : '';
    }
    var relationship = '';
    if (guarantorResource && guarantorResource.resourceType === 'Patient') {
        relationship = 'Self';
    }
    else if (guarantorResource) {
        relationship = (_l = (_k = (_j = guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.relationship) === null || _j === void 0 ? void 0 : _j[0].coding) === null || _k === void 0 ? void 0 : _k[0].display) !== null && _l !== void 0 ? _l : '';
    }
    var guarantorAddress = (_m = guarantorResource === null || guarantorResource === void 0 ? void 0 : guarantorResource.address) === null || _m === void 0 ? void 0 : _m[0];
    var streetAddress = (_p = (_o = guarantorAddress === null || guarantorAddress === void 0 ? void 0 : guarantorAddress.line) === null || _o === void 0 ? void 0 : _o[0]) !== null && _p !== void 0 ? _p : '';
    var addressLineOptional = (_r = (_q = guarantorAddress === null || guarantorAddress === void 0 ? void 0 : guarantorAddress.line) === null || _q === void 0 ? void 0 : _q[1]) !== null && _r !== void 0 ? _r : '';
    var city = (_s = guarantorAddress === null || guarantorAddress === void 0 ? void 0 : guarantorAddress.city) !== null && _s !== void 0 ? _s : '';
    var state = (_t = guarantorAddress === null || guarantorAddress === void 0 ? void 0 : guarantorAddress.state) !== null && _t !== void 0 ? _t : '';
    var zip = (_u = guarantorAddress === null || guarantorAddress === void 0 ? void 0 : guarantorAddress.postalCode) !== null && _u !== void 0 ? _u : '';
    return {
        relationship: relationship,
        fullName: fullName,
        dob: dob,
        sex: sex,
        phone: phone,
        email: email,
        streetAddress: streetAddress,
        addressLineOptional: addressLineOptional,
        state: state,
        city: city,
        zip: zip,
    };
};
exports.composeResponsiblePartyData = composeResponsiblePartyData;
var createResponsiblePartySection = function () {
    return (0, pdf_common_1.createConfiguredSection)('responsibleParty', function (shouldShow) { return ({
        title: 'Responsible party information',
        dataSelector: function (data) { return data.responsibleParty; },
        render: function (client, data, styles) {
            if (shouldShow('responsible-party-relationship')) {
                client.drawLabelValueRow('Relationship to the patient', data.relationship, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-first-name') || shouldShow('responsible-party-last-name')) {
                client.drawLabelValueRow('Full name', data.fullName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-date-of-birth')) {
                client.drawLabelValueRow('Date of birth', data.dob, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-birth-sex')) {
                client.drawLabelValueRow('Birth sex', data.sex, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-number')) {
                client.drawLabelValueRow('Phone', data.phone, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-email')) {
                client.drawLabelValueRow('Email', data.email, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-address')) {
                client.drawLabelValueRow('Street address', data.streetAddress, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-address-2')) {
                client.drawLabelValueRow("Address line 2", data.addressLineOptional, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('responsible-party-city') &&
                shouldShow('responsible-party-state') &&
                shouldShow('responsible-party-zip')) {
                client.drawLabelValueRow("City, State, ZIP", "".concat(data.city, ", ").concat(data.state, ", ").concat(data.zip), styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createResponsiblePartySection = createResponsiblePartySection;
