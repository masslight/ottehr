"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmergencyContactInfoSection = exports.composeEmergencyContactData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composeEmergencyContactData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    var emergencyContactResource = _a.emergencyContactResource;
    var emergencyContactAddress = (_b = emergencyContactResource === null || emergencyContactResource === void 0 ? void 0 : emergencyContactResource.address) === null || _b === void 0 ? void 0 : _b[0];
    var streetAddress = (_d = (_c = emergencyContactAddress === null || emergencyContactAddress === void 0 ? void 0 : emergencyContactAddress.line) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : '';
    var addressLineOptional = (_f = (_e = emergencyContactAddress === null || emergencyContactAddress === void 0 ? void 0 : emergencyContactAddress.line) === null || _e === void 0 ? void 0 : _e[1]) !== null && _f !== void 0 ? _f : '';
    var city = (_g = emergencyContactAddress === null || emergencyContactAddress === void 0 ? void 0 : emergencyContactAddress.city) !== null && _g !== void 0 ? _g : '';
    var state = (_h = emergencyContactAddress === null || emergencyContactAddress === void 0 ? void 0 : emergencyContactAddress.state) !== null && _h !== void 0 ? _h : '';
    var zip = (_j = emergencyContactAddress === null || emergencyContactAddress === void 0 ? void 0 : emergencyContactAddress.postalCode) !== null && _j !== void 0 ? _j : '';
    var phone = (0, utils_1.formatPhoneNumberDisplay)((_m = (_l = (_k = emergencyContactResource === null || emergencyContactResource === void 0 ? void 0 : emergencyContactResource.telecom) === null || _k === void 0 ? void 0 : _k.find(function (c) { var _a; return c.system === 'phone' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _l === void 0 ? void 0 : _l.value) !== null && _m !== void 0 ? _m : '');
    var firstName = '';
    var middleName = '';
    var lastName = '';
    if (emergencyContactResource) {
        firstName = (_o = (0, utils_1.getFirstName)(emergencyContactResource)) !== null && _o !== void 0 ? _o : '';
        middleName = (_p = (0, utils_1.getMiddleName)(emergencyContactResource)) !== null && _p !== void 0 ? _p : '';
        lastName = (_q = (0, utils_1.getLastName)(emergencyContactResource)) !== null && _q !== void 0 ? _q : '';
    }
    var relationship = '';
    if (emergencyContactResource) {
        var relationCode = emergencyContactResource === null || emergencyContactResource === void 0 ? void 0 : emergencyContactResource.relationship;
        if (relationCode === null || relationCode === void 0 ? void 0 : relationCode[0]) {
            var cc = relationCode[0];
            var coding = (_r = cc === null || cc === void 0 ? void 0 : cc.coding) === null || _r === void 0 ? void 0 : _r[0];
            if (coding && coding.display) {
                relationship = coding.display;
            }
        }
    }
    return { relationship: relationship, firstName: firstName, middleName: middleName, lastName: lastName, phone: phone, streetAddress: streetAddress, addressLineOptional: addressLineOptional, city: city, state: state, zip: zip };
};
exports.composeEmergencyContactData = composeEmergencyContactData;
var createEmergencyContactInfoSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('emergencyContact', function (shouldShow) { return ({
        title: 'Emergency contact information',
        dataSelector: function (data) { return data.emergencyContact; },
        render: function (client, contactInfo, styles) {
            if (shouldShow('emergency-contact-relationship')) {
                client.drawLabelValueRow('Relationship to the patient', contactInfo.relationship, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-first-name')) {
                client.drawLabelValueRow('First name', contactInfo.firstName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-middle-name')) {
                client.drawLabelValueRow('Middle name', contactInfo.middleName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-last-name')) {
                client.drawLabelValueRow('Last name', contactInfo.lastName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-number')) {
                client.drawLabelValueRow('Phone', contactInfo.phone, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-address')) {
                client.drawLabelValueRow('Street address', contactInfo.streetAddress, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-address-2')) {
                client.drawLabelValueRow('Address line 2', contactInfo.addressLineOptional, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('emergency-contact-city') &&
                shouldShow('emergency-contact-state') &&
                shouldShow('emergency-contact-zip')) {
                client.drawLabelValueRow('City, State, ZIP', "".concat(contactInfo.city, ", ").concat(contactInfo.state, ", ").concat(contactInfo.zip), styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createEmergencyContactInfoSection = createEmergencyContactInfoSection;
