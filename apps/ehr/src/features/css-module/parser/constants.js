"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FillingOutAs = exports.Gender = exports.WEIGHT_ROUNDING_PRECISION = exports.LBS_TO_KG_FACTOR = exports.WEIGHT_LAST_UPDATED_EXTENSION_URL = exports.WEIGHT_EXTENSION_URL = void 0;
exports.WEIGHT_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/weight';
exports.WEIGHT_LAST_UPDATED_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/weight-last-updated';
exports.LBS_TO_KG_FACTOR = 0.45359237;
exports.WEIGHT_ROUNDING_PRECISION = 100;
var Gender;
(function (Gender) {
    Gender["male"] = "Male";
    Gender["female"] = "Female";
    Gender["other"] = "Other";
    Gender["unknown"] = "Unknown";
})(Gender || (exports.Gender = Gender = {}));
var FillingOutAs;
(function (FillingOutAs) {
    FillingOutAs["SELF"] = "Self";
    FillingOutAs["PARENT_GUARDIAN"] = "Parent/Guardian";
})(FillingOutAs || (exports.FillingOutAs = FillingOutAs = {}));
//# sourceMappingURL=constants.js.map