"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateScheduleParameters = exports.getNameForOwner = exports.addressStringFromAddress = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var addressStringFromAddress = function (address) {
    var addressString = '';
    if (address.line) {
        addressString += ", ".concat(address.line);
    }
    if (address.city) {
        addressString += ", ".concat(address.city);
    }
    if (address.state) {
        addressString += ", ".concat(address.state);
    }
    if (address.postalCode) {
        addressString += ", ".concat(address.postalCode);
    }
    // return without trailing comma
    if (addressString !== '') {
        addressString = addressString.substring(2);
    }
    return addressString;
};
exports.addressStringFromAddress = addressStringFromAddress;
var getNameForOwner = function (owner) {
    var name = '';
    if (owner.resourceType === 'Location') {
        name = owner.name;
    }
    else if (owner.resourceType === 'Practitioner') {
        name = (0, utils_1.getFullName)(owner);
    }
    else if (owner.resourceType === 'HealthcareService') {
        name = owner.name;
    }
    if (name) {
        return name;
    }
    return "".concat(owner.resourceType, "/").concat(owner.id);
};
exports.getNameForOwner = getNameForOwner;
// this lives here because the create schedule zambda uses an input type that extends UpdateScheduleParams,
// so this can be shared across the update and create zambdas
var validateUpdateScheduleParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var _a = JSON.parse(input.body), scheduleId = _a.scheduleId, timezone = _a.timezone, slug = _a.slug, schedule = _a.schedule, scheduleOverrides = _a.scheduleOverrides, closures = _a.closures, ownerId = _a.ownerId, ownerType = _a.ownerType;
    var createMode = Boolean(ownerId) && Boolean(ownerType);
    if (!scheduleId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['scheduleId']);
    }
    if ((0, utils_1.isValidUUID)(scheduleId) === false && createMode === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('scheduleId');
    }
    if (timezone) {
        if (typeof timezone !== 'string') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"timezone" must be a string');
        }
        if (utils_1.TIMEZONES.includes(timezone) === false) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("\"timezone\" must be one of ".concat(utils_1.TIMEZONES.join(', ')));
        }
    }
    // todo: better schema application for these complex structures
    if (schedule) {
        if (typeof schedule !== 'object') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"schedule" must be an object');
        }
    }
    if (scheduleOverrides) {
        if (typeof scheduleOverrides !== 'object') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"scheduleOverrides" must be an object');
        }
    }
    if (closures) {
        if (!Array.isArray(closures)) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"closures" must be an array');
        }
        closures.forEach(function (closure) {
            if (typeof closure !== 'object') {
                throw (0, utils_1.INVALID_INPUT_ERROR)('"closures" must be an array of objects');
            }
            if (!closure.start) {
                throw (0, utils_1.INVALID_INPUT_ERROR)('"closures" must be an array of objects with start date');
            }
            else if (luxon_1.DateTime.fromFormat(closure.start, utils_1.OVERRIDE_DATE_FORMAT).isValid === false) {
                throw (0, utils_1.INVALID_INPUT_ERROR)("\"closures\" start dates must be valid date strings in ".concat(utils_1.OVERRIDE_DATE_FORMAT, " format"));
            }
            if (closure.end && luxon_1.DateTime.fromFormat(closure.end, utils_1.OVERRIDE_DATE_FORMAT).isValid === false) {
                throw (0, utils_1.INVALID_INPUT_ERROR)("\"closures\" end dates must be valid date strings in ".concat(utils_1.OVERRIDE_DATE_FORMAT, " format"));
            }
            if (Object.values(utils_1.ClosureType).includes(closure.type) === false) {
                throw (0, utils_1.INVALID_INPUT_ERROR)("\"closures\" must be an array of objects with a type of ".concat(Object.values(utils_1.ClosureType).join(', ')));
            }
            else if (closure.type === 'period' && !closure.end) {
                throw (0, utils_1.INVALID_INPUT_ERROR)('"closures" of type "period" must have an end date');
            }
            else if (closure.type === 'period' &&
                luxon_1.DateTime.fromFormat(closure.start, utils_1.OVERRIDE_DATE_FORMAT) >=
                    luxon_1.DateTime.fromFormat(closure.end, utils_1.OVERRIDE_DATE_FORMAT)) {
                throw (0, utils_1.INVALID_INPUT_ERROR)('"closures" of type "period" must have start date before end date');
            }
        });
    }
    if (slug && typeof slug !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"slug" must be a string');
    }
    return {
        secrets: secrets,
        scheduleId: scheduleId,
        timezone: timezone,
        schedule: schedule,
        scheduleOverrides: scheduleOverrides,
        closures: closures,
        slug: slug,
    };
};
exports.validateUpdateScheduleParameters = validateUpdateScheduleParameters;
