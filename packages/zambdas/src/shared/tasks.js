"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_TYPE_SYSTEM = void 0;
exports.createTask = createTask;
exports.getTaskLocation = getTaskLocation;
exports.createOwnerReference = createOwnerReference;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var systemUrls_1 = require("utils/lib/fhir/systemUrls");
exports.TASK_TYPE_SYSTEM = (0, systemUrls_1.ottehrCodeSystemUrl)('task-type');
var TASK_LOCATION_SYSTEM = (0, systemUrls_1.ottehrCodeSystemUrl)('task-location');
function createTask(data, showOnBoard) {
    var _a, _b;
    if (showOnBoard === void 0) { showOnBoard = true; }
    var tag = [];
    if (showOnBoard) {
        tag.push({
            code: 'task',
        });
    }
    if (data.location != null) {
        tag.push({
            system: TASK_LOCATION_SYSTEM,
            code: data.location.id,
            display: (_a = data.location) === null || _a === void 0 ? void 0 : _a.name,
        });
    }
    return {
        resourceType: 'Task',
        status: 'ready',
        groupIdentifier: {
            system: (0, systemUrls_1.ottehrIdentifierSystem)('task-category'),
            value: data.category,
        },
        code: data.code
            ? isCodeableConcept(data.code)
                ? data.code
                : {
                    coding: [
                        {
                            system: data.code.system,
                            code: data.code.code,
                        },
                    ],
                }
            : undefined,
        encounter: data.encounterId ? { reference: "Encounter/".concat(data.encounterId) } : undefined,
        authoredOn: luxon_1.DateTime.now().toISO(),
        intent: 'order',
        basedOn: data.basedOn
            ? data.basedOn.map(function (basedOn) {
                return {
                    reference: basedOn,
                };
            })
            : undefined,
        input: (0, utils_1.undefinedIfEmptyArray)(((_b = data.input) !== null && _b !== void 0 ? _b : [])
            .map(function (input) {
            if (isFhirTaskInput(input)) {
                return input;
            }
            return {
                type: {
                    coding: [
                        {
                            system: (0, systemUrls_1.ottehrCodeSystemUrl)('task-input'),
                            code: input.type,
                        },
                    ],
                },
                valueString: input.valueString,
                valueReference: input.valueReference,
            };
        })
            .filter(function (input) { return input.valueString || input.valueReference; })),
        location: data.location
            ? {
                reference: 'Location/' + data.location.id,
                display: data.location.name,
            }
            : undefined,
        meta: tag.length > 0
            ? {
                tag: tag,
            }
            : undefined,
    };
}
function getTaskLocation(task) {
    var _a, _b;
    var locationCoding = (_b = (_a = task.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === TASK_LOCATION_SYSTEM; });
    if (locationCoding === null || locationCoding === void 0 ? void 0 : locationCoding.code) {
        return {
            id: locationCoding.code,
            name: locationCoding.display,
        };
    }
    return undefined;
}
function createOwnerReference(id, name) {
    return {
        reference: 'Practitioner/' + id,
        display: name,
        extension: [
            {
                url: utils_1.TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
                valueDateTime: luxon_1.DateTime.now().toISO(),
            },
        ],
    };
}
function isFhirTaskInput(input) {
    return typeof input.type === 'object';
}
function isCodeableConcept(code) {
    return code.coding != null;
}
