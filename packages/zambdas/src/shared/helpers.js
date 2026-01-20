"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateString = exports.fillMeta = exports.getCurrentTimeDifference = exports.getMinutesDifference = exports.getVideoRoomResourceExtension = exports.getRelatedPersonsFromResourceList = void 0;
exports.createOystehrClient = createOystehrClient;
exports.getPatchBinary = getPatchBinary;
exports.logTime = logTime;
exports.isValidPhoneNumber = isValidPhoneNumber;
exports.isValidNPI = isValidNPI;
exports.assertDefined = assertDefined;
exports.validateJsonBody = validateJsonBody;
exports.getParticipantFromAppointment = getParticipantFromAppointment;
exports.checkValidBookingTime = checkValidBookingTime;
exports.getBucketAndObjectFromZ3URL = getBucketAndObjectFromZ3URL;
exports.getOtherOfficesForLocation = getOtherOfficesForLocation;
exports.checkPaperworkComplete = checkPaperworkComplete;
exports.resolveTimezone = resolveTimezone;
var sdk_1 = require("@oystehr/sdk");
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
function createOystehrClient(token, secrets) {
    var FHIR_API = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
    var PROJECT_API = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
    var CLIENT_CONFIG = {
        accessToken: token,
        fhirApiUrl: FHIR_API,
        projectApiUrl: PROJECT_API,
    };
    return new sdk_1.default(CLIENT_CONFIG);
}
// returns a map from a patient reference to all related persons linked to that patient
var getRelatedPersonsFromResourceList = function (resources) {
    var mapToReturn = {};
    return resources.filter(function (res) { return res.resourceType === 'RelatedPerson'; }).reduce(function (accum, current) {
        var patientRef = current.patient.reference;
        if (!patientRef) {
            return accum;
        }
        if (accum[patientRef] === undefined) {
            accum[patientRef] = [current];
        }
        else {
            accum[patientRef].push(current);
        }
        return accum;
    }, mapToReturn);
};
exports.getRelatedPersonsFromResourceList = getRelatedPersonsFromResourceList;
var getVideoRoomResourceExtension = function (resource) {
    var _a, _b, _c, _d, _e;
    var resourcePrefix;
    var castedResource;
    if (resource.resourceType === 'Appointment') {
        castedResource = resource;
        resourcePrefix = 'appointment';
    }
    else if (resource.resourceType === 'Encounter') {
        castedResource = resource;
        resourcePrefix = 'encounter';
    }
    else {
        return null;
    }
    for (var index = 0; index < ((_b = (_a = castedResource.extension) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0); index++) {
        var extension = castedResource.extension[index];
        if (extension.url !== "".concat(utils_1.PUBLIC_EXTENSION_BASE_URL, "/").concat(resourcePrefix, "-virtual-service-pre-release")) {
            continue;
        }
        for (var j = 0; j < ((_d = (_c = extension === null || extension === void 0 ? void 0 : extension.extension) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0); j++) {
            var internalExtension = extension.extension[j];
            if (internalExtension.url === 'channelType' && ((_e = internalExtension.valueCoding) === null || _e === void 0 ? void 0 : _e.code) === utils_1.TELEMED_VIDEO_ROOM_CODE) {
                return extension;
            }
        }
    }
    return null;
};
exports.getVideoRoomResourceExtension = getVideoRoomResourceExtension;
var getMinutesDifference = function (startDateTime, endDateTime) {
    return luxon_1.DateTime.fromISO(endDateTime).diff(luxon_1.DateTime.fromISO(startDateTime), 'minutes').minutes;
};
exports.getMinutesDifference = getMinutesDifference;
var getCurrentTimeDifference = function (startDateTime) {
    return luxon_1.DateTime.now().diff(luxon_1.DateTime.fromISO(startDateTime), 'minutes').minutes;
};
exports.getCurrentTimeDifference = getCurrentTimeDifference;
function getPatchBinary(input) {
    var resourceId = input.resourceId, resourceType = input.resourceType, patchOperations = input.patchOperations;
    return {
        method: 'PATCH',
        url: "/".concat(resourceType, "/").concat(resourceId),
        resource: {
            resourceType: 'Binary',
            // data is handled due to bug with non latin1 characters
            data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
            contentType: 'application/json-patch+json',
        },
    };
}
function logTime() {
    if (process.env.IS_OFFLINE === 'true') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('console-stamp')(console, 'HH:MM:ss.l');
    }
}
function isValidPhoneNumber(phone) {
    var phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    return phoneRegex.test(phone);
}
function isValidNPI(npi) {
    var npiRegex = /^\d{10}$/;
    return npiRegex.test(npi);
}
var fillMeta = function (code, system) { return ({
    tag: [
        {
            code: code,
            system: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(system),
        },
    ],
}); };
exports.fillMeta = fillMeta;
function assertDefined(value, name) {
    if (value == null) {
        throw "\"".concat(name, "\" is undefined");
    }
    return value;
}
var validateString = function (value, propertyName) {
    if (typeof value !== 'string') {
        throw new Error("\"".concat(propertyName, "\" property must be a string"));
    }
    return value;
};
exports.validateString = validateString;
function validateJsonBody(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    try {
        return JSON.parse(input.body);
    }
    catch (_a) {
        throw new Error('Invalid JSON in request body');
    }
}
function getParticipantFromAppointment(appointment, participant) {
    var _a, _b, _c;
    var participantTemp = (_c = (_b = (_a = appointment.participant
        .find(function (currentParticipant) { var _a, _b; return (_b = (_a = currentParticipant.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith(participant); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace("".concat(participant, "/"), '');
    if (!participantTemp) {
        throw new Error('Participant not found in list of appointment participants');
    }
    return participantTemp;
}
function checkValidBookingTime(slotTime) {
    var slotDate = luxon_1.DateTime.fromISO(slotTime);
    var currentDate = luxon_1.DateTime.now().setZone('UTC');
    return slotDate > currentDate;
}
function getBucketAndObjectFromZ3URL(z3URL, projectAPI) {
    var updatedPhotoIdFrontUrl = z3URL.replace("".concat(projectAPI, "/z3/object/"), '');
    var photoIdFrontItems = updatedPhotoIdFrontUrl.split('/');
    var bucket = photoIdFrontItems[0];
    var object = photoIdFrontItems.slice(1).join('/');
    return { bucket: bucket, object: object };
}
function getOtherOfficesForLocation(location) {
    var _a, _b;
    var rawExtensionValue = (_b = (_a = location === null || location === void 0 ? void 0 : location.extension) === null || _a === void 0 ? void 0 : _a.find(function (extensionTemp) { return extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/other-offices'; })) === null || _b === void 0 ? void 0 : _b.valueString;
    if (!rawExtensionValue) {
        console.log("Location doesn't have other-offices extension");
        return [];
    }
    var parsedExtValue = [];
    try {
        parsedExtValue = JSON.parse(rawExtensionValue);
    }
    catch (e) {
        console.log('Location other-offices extension is formatted incorrectly');
        (0, aws_serverless_1.captureException)(e);
        return [];
    }
    return parsedExtValue;
}
function checkPaperworkComplete(questionnaireResponse) {
    var _a;
    if ((questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.status) === 'completed' || (questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.status) === 'amended') {
        var photoIdFront = void 0;
        var photoIdFrontItem = (0, utils_1.findQuestionnaireResponseItemLinkId)('photo-id-front', (_a = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item) !== null && _a !== void 0 ? _a : []);
        if (photoIdFrontItem) {
            photoIdFront = (0, utils_1.pickFirstValueFromAnswerItem)(photoIdFrontItem, 'attachment');
        }
        if (photoIdFront) {
            return true;
        }
    }
    return false;
}
function resolveTimezone(schedule, location, fallback) {
    if (fallback === void 0) { fallback = utils_1.TIMEZONES[0]; }
    if (schedule) {
        return (0, utils_1.getTimezone)(schedule);
    }
    if (location) {
        return (0, utils_1.getTimezone)(location);
    }
    return fallback;
}
