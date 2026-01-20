"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULE_TYPES = void 0;
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
exports.SCHEDULE_TYPES = ['location', 'provider', 'group'];
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), slug = _a.slug, scheduleType = _a.scheduleType, selectedDate = _a.selectedDate, maybeServiceCategoryCode = _a.serviceCategoryCode;
    if (!slug) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['slug']);
    }
    if (!exports.SCHEDULE_TYPES.includes(scheduleType)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("scheduleType must be either ".concat(exports.SCHEDULE_TYPES));
    }
    console.log('SERVICE CATEGORIES FOR SLOT GENERATION maybe:', maybeServiceCategoryCode);
    var serviceCategoryCode;
    if (maybeServiceCategoryCode) {
        serviceCategoryCode = utils_1.ServiceCategoryCodeSchema.safeParse(maybeServiceCategoryCode).data;
        if (!serviceCategoryCode) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("\"serviceCategoryCode\" must be one of ".concat(utils_1.ServiceCategoryCodeSchema.options.join(', ')));
        }
    }
    return {
        slug: slug,
        scheduleType: scheduleType,
        secrets: input.secrets,
        selectedDate: selectedDate,
        serviceCategoryCode: serviceCategoryCode,
    };
}
