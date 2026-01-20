"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPharmacyFormsSection = exports.composePharmacyData = void 0;
var pdf_common_1 = require("../pdf-common");
var composePharmacyData = function (pharmacy) {
    var _a, _b, _c;
    var name = (_a = pharmacy === null || pharmacy === void 0 ? void 0 : pharmacy.name) !== null && _a !== void 0 ? _a : '';
    var address = (_c = (_b = pharmacy === null || pharmacy === void 0 ? void 0 : pharmacy.address) === null || _b === void 0 ? void 0 : _b[0].text) !== null && _c !== void 0 ? _c : '';
    return {
        name: name,
        address: address,
    };
};
exports.composePharmacyData = composePharmacyData;
var createPharmacyFormsSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('preferredPharmacy', function (shouldShow) { return ({
        title: 'Preferred pharmacy',
        dataSelector: function (data) { return data.pharmacy; },
        render: function (client, data, styles) {
            if (shouldShow('pharmacy-name')) {
                client.drawLabelValueRow('Pharmacy name', data.name, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('pharmacy-address')) {
                client.drawLabelValueRow("Pharmacy address", data.address, styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createPharmacyFormsSection = createPharmacyFormsSection;
