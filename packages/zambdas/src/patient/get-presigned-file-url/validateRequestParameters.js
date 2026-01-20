"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var fileTypes = [
    utils_1.INSURANCE_CARD_BACK_ID,
    utils_1.INSURANCE_CARD_BACK_2_ID,
    utils_1.INSURANCE_CARD_FRONT_ID,
    utils_1.INSURANCE_CARD_FRONT_2_ID,
    utils_1.PHOTO_ID_FRONT_ID,
    utils_1.PHOTO_ID_BACK_ID,
    utils_1.SCHOOL_WORK_NOTE_SCHOOL_ID,
    utils_1.SCHOOL_WORK_NOTE_WORK_ID,
];
var fileFormats = ['jpg', 'jpeg', 'png', 'pdf'];
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), appointmentID = _a.appointmentID, fileType = _a.fileType, fileFormat = _a.fileFormat;
    if (appointmentID === undefined || appointmentID === '') {
        throw new Error('"appointmentID" is required');
    }
    if (fileType === undefined || fileType === '') {
        throw new Error('"fileType" is required');
    }
    if (!fileTypes.includes(fileType) && !fileType.startsWith(utils_1.PATIENT_PHOTO_ID_PREFIX)) {
        throw new Error("fileType must be one of the following values: ".concat(Object.values(fileTypes).join(', ')));
    }
    if (fileFormat === undefined || fileFormat === '') {
        throw new Error('"fileFormat" is required');
    }
    if (!fileFormats.includes(fileFormat)) {
        throw new Error("fileFormat ".concat(fileFormat, " must be one of the following values: ").concat(Object.values(fileFormats).join(', ')));
    }
    return {
        appointmentID: appointmentID,
        fileType: fileType,
        fileFormat: fileFormat,
        secrets: input.secrets,
    };
}
