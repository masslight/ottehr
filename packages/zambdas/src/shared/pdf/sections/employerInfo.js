"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmployerInfoSection = exports.composeEmployerData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composeEmployerData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    var employer = _a.employer;
    var employerName = (_b = employer === null || employer === void 0 ? void 0 : employer.name) !== null && _b !== void 0 ? _b : '';
    var address = (_c = employer === null || employer === void 0 ? void 0 : employer.address) === null || _c === void 0 ? void 0 : _c[0];
    var streetAddress = (_e = (_d = address === null || address === void 0 ? void 0 : address.line) === null || _d === void 0 ? void 0 : _d[0]) !== null && _e !== void 0 ? _e : '';
    var addressLineOptional = (_g = (_f = address === null || address === void 0 ? void 0 : address.line) === null || _f === void 0 ? void 0 : _f[1]) !== null && _g !== void 0 ? _g : '';
    var city = (_h = address === null || address === void 0 ? void 0 : address.city) !== null && _h !== void 0 ? _h : '';
    var state = (_j = address === null || address === void 0 ? void 0 : address.state) !== null && _j !== void 0 ? _j : '';
    var zip = (_k = address === null || address === void 0 ? void 0 : address.postalCode) !== null && _k !== void 0 ? _k : '';
    var contact = (_l = employer === null || employer === void 0 ? void 0 : employer.contact) === null || _l === void 0 ? void 0 : _l[0];
    var getTelecomValue = function (system) {
        var _a, _b, _c, _d;
        var contactValue = (_b = (_a = contact === null || contact === void 0 ? void 0 : contact.telecom) === null || _a === void 0 ? void 0 : _a.find(function (tel) { return tel.system === system && tel.value; })) === null || _b === void 0 ? void 0 : _b.value;
        var orgValue = (_d = (_c = employer === null || employer === void 0 ? void 0 : employer.telecom) === null || _c === void 0 ? void 0 : _c.find(function (tel) { return tel.system === system && tel.value; })) === null || _d === void 0 ? void 0 : _d.value;
        return contactValue !== null && contactValue !== void 0 ? contactValue : orgValue;
    };
    var firstName = (_p = (_o = (_m = contact === null || contact === void 0 ? void 0 : contact.name) === null || _m === void 0 ? void 0 : _m.given) === null || _o === void 0 ? void 0 : _o[0]) !== null && _p !== void 0 ? _p : '';
    var lastName = (_r = (_q = contact === null || contact === void 0 ? void 0 : contact.name) === null || _q === void 0 ? void 0 : _q.family) !== null && _r !== void 0 ? _r : '';
    var title = (_t = (_s = contact === null || contact === void 0 ? void 0 : contact.purpose) === null || _s === void 0 ? void 0 : _s.text) !== null && _t !== void 0 ? _t : '';
    var email = (_u = getTelecomValue('email')) !== null && _u !== void 0 ? _u : '';
    var phone = (0, utils_1.formatPhoneNumberDisplay)(getTelecomValue('phone'));
    var fax = (0, utils_1.formatPhoneNumberDisplay)(getTelecomValue('fax'));
    return {
        employerName: employerName,
        streetAddress: streetAddress,
        addressLineOptional: addressLineOptional,
        city: city,
        state: state,
        zip: zip,
        firstName: firstName,
        lastName: lastName,
        title: title,
        email: email,
        phone: phone,
        fax: fax,
    };
};
exports.composeEmployerData = composeEmployerData;
var createEmployerInfoSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('patientSummary', function (shouldShow) { return ({
        title: 'Employer Information',
        dataSelector: function (data) { return data.employer; },
        shouldRender: function (employer) { return !!employer.employerName; },
        render: function (client, employerInfo, styles) {
            if (shouldShow('employer-name')) {
                client.drawLabelValueRow('Employer Name', employerInfo.employerName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-address')) {
                client.drawLabelValueRow('Street address', employerInfo.streetAddress, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-address-2')) {
                client.drawLabelValueRow('Address line 2', employerInfo.addressLineOptional, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-city') && shouldShow('employer-state') && shouldShow('employer-zip')) {
                client.drawLabelValueRow('City, State, ZIP', "".concat(employerInfo.city, ", ").concat(employerInfo.state, ", ").concat(employerInfo.zip), styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
            if (shouldShow('employer-contact-first-name') ||
                shouldShow('employer-contact-last-name') ||
                shouldShow('employer-contact-title') ||
                shouldShow('employer-contact-email') ||
                shouldShow('employer-contact-phone') ||
                shouldShow('employer-contact-fax')) {
                client.drawText('Employer Contact', styles.textStyles.subHeader);
            }
            if (shouldShow('employer-contact-first-name')) {
                client.drawLabelValueRow('First name', employerInfo.firstName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-contact-last-name')) {
                client.drawLabelValueRow('Last name', employerInfo.lastName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-contact-title')) {
                client.drawLabelValueRow('Title', employerInfo.title, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-contact-email')) {
                client.drawLabelValueRow('Email', employerInfo.email, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-contact-phone')) {
                client.drawLabelValueRow('Mobile', employerInfo.phone, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('employer-contact-fax')) {
                client.drawLabelValueRow('Fax', employerInfo.fax, styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createEmployerInfoSection = createEmployerInfoSection;
