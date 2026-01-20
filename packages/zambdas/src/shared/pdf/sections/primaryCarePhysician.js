"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrimaryCarePhysicianSection = exports.composePrimaryCarePhysicianData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composePrimaryCarePhysicianData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var physician = _a.physician;
    var pcpName = physician ? (0, utils_1.getFullName)(physician) : '';
    var pcpPracticeName = (_d = (_c = (_b = physician === null || physician === void 0 ? void 0 : physician.extension) === null || _b === void 0 ? void 0 : _b.find(function (e) { return e.url === utils_1.PRACTICE_NAME_URL; })) === null || _c === void 0 ? void 0 : _c.valueString) !== null && _d !== void 0 ? _d : '';
    var pcpAddress = (_g = (_f = (_e = physician === null || physician === void 0 ? void 0 : physician.address) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : '';
    var pcpPhone = (_k = (0, utils_1.standardizePhoneNumber)((_j = (_h = physician === null || physician === void 0 ? void 0 : physician.telecom) === null || _h === void 0 ? void 0 : _h.find(function (c) { var _a; return c.system === 'phone' && ((_a = c.period) === null || _a === void 0 ? void 0 : _a.end) === undefined; })) === null || _j === void 0 ? void 0 : _j.value)) !== null && _k !== void 0 ? _k : '';
    return {
        pcpName: pcpName,
        pcpPracticeName: pcpPracticeName,
        pcpAddress: pcpAddress,
        pcpPhone: pcpPhone,
    };
};
exports.composePrimaryCarePhysicianData = composePrimaryCarePhysicianData;
var createPrimaryCarePhysicianSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('primaryCarePhysician', function (shouldShow) { return ({
        title: 'Primary care physician',
        dataSelector: function (data) { return data.pcp; },
        render: function (client, details, styles) {
            if (shouldShow('pcp-first') || shouldShow('pcp-last')) {
                client.drawLabelValueRow('PCP first and last name', details.pcpName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('pcp-practice')) {
                client.drawLabelValueRow('PCP practice name', details.pcpPracticeName, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('pcp-address')) {
                client.drawLabelValueRow('PCP address', details.pcpAddress, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('pcp-number')) {
                client.drawLabelValueRow('PCP phone number', details.pcpPhone, styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createPrimaryCarePhysicianSection = createPrimaryCarePhysicianSection;
