"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
var fs_1 = require("fs");
var path_1 = require("path");
var url_1 = require("url");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var base_in_house_lab_seed_data_1 = require("../data/base-in-house-lab-seed-data");
var AD_CANONICAL_URL_BASE = 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition';
var sanitizeForId = function (str) {
    /* eslint-disable-next-line  no-useless-escape */
    return str.replace(/[ ()\/\\]/g, '');
};
var valueSetConfigDiff = function (a, b) {
    var bCodes = new Set(__spreadArray([], b, true).map(function (x) { return x.code; }));
    return new Set(__spreadArray([], a, true).filter(function (x) { return !bCodes.has(x.code); }));
};
var makeValueSet = function (itemName, values, valueSetName) {
    var valueSetId = "contained-".concat(sanitizeForId(itemName), "-").concat(valueSetName.toLowerCase(), "-valueSet");
    var valueSet = {
        id: valueSetId,
        resourceType: 'ValueSet',
        status: 'active',
        compose: {
            include: [
                {
                    system: utils_1.IN_HOUSE_RESULTS_VALUESET_SYSTEM,
                    concept: values.map(function (valueStr) {
                        return {
                            code: valueStr.code,
                            display: valueStr.display,
                        };
                    }),
                },
            ],
        },
    };
    return {
        valueSetId: valueSetId,
        valueSet: valueSet,
    };
};
var makeUnitCoding = function (unitStr) {
    return {
        coding: [
            {
                system: utils_1.IN_HOUSE_UNIT_OF_MEASURE_SYSTEM,
                code: unitStr,
            },
        ],
    };
};
var makeQuantitativeDetails = function (item) {
    if (!item.normalRange) {
        throw new Error("Cannot make quantitativeDetails for ".concat(JSON.stringify(item)));
    }
    return {
        decimalPrecision: item.normalRange.precision,
        unit: item.normalRange.unit ? makeUnitCoding(item.normalRange.unit) : undefined,
    };
};
var makeQualifiedInterval = function (item) {
    if (!item.normalRange) {
        throw new Error("Cannot make QualifiedInterval for ".concat(JSON.stringify(item)));
    }
    return {
        category: 'reference',
        range: {
            low: item.normalRange.low !== undefined ? { value: item.normalRange.low } : undefined,
            high: item.normalRange.high !== undefined ? { value: item.normalRange.high } : undefined,
        },
    };
};
var makeObsDefExtension = function (item) {
    var _a, _b;
    var display = (_a = item.display) === null || _a === void 0 ? void 0 : _a.type;
    if (!display)
        throw new Error("Missing display on ".concat(item.loincCode.join(','), " item"));
    var displayExt = {
        url: utils_1.OD_DISPLAY_CONFIG.url,
        valueString: display,
    };
    var extension = [displayExt];
    if (item.dataType === 'string') {
        // handle at least the string validation
        if (item.display.validations) {
            for (var _i = 0, _c = Object.entries(item.display.validations); _i < _c.length; _i++) {
                var _d = _c[_i], key = _d[0], val = _d[1];
                if (key === 'format') {
                    extension.push({
                        url: utils_1.OD_VALUE_VALIDATION_CONFIG.url,
                        valueCoding: {
                            system: utils_1.OD_VALUE_VALIDATION_CONFIG.formatValidation.url,
                            code: val.value,
                            display: val.display,
                        },
                    });
                }
            }
        }
    }
    else if ((_b = item.display) === null || _b === void 0 ? void 0 : _b.nullOption) {
        extension.push(utils_1.IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG);
    }
    return extension;
};
var makeRelatedArtifact = function (item) {
    var parentTestUrls = [];
    item.components.forEach(function (component) {
        if (component.reflexLogic) {
            if ('parentTestUrl' in component.reflexLogic)
                parentTestUrls.push(component.reflexLogic.parentTestUrl);
        }
    });
    if (parentTestUrls.length === 0)
        return;
    var artifacts = [];
    parentTestUrls.forEach(function (url) {
        var artifact = {
            resource: url,
            type: 'depends-on',
            display: utils_1.REFLEX_ARTIFACT_DISPLAY,
        };
        artifacts.push(artifact);
    });
    return artifacts;
};
var makeActivityExtension = function (item) {
    var extension = [];
    if (item.repeatTest) {
        extension.push({
            url: utils_1.REPEATABLE_TEXT_EXTENSION_CONFIG.url,
            valueString: utils_1.REPEATABLE_TEXT_EXTENSION_CONFIG.valueString,
        });
    }
    var reflexLogics = [];
    item.components.forEach(function (component) {
        if (component.reflexLogic) {
            if ('testToRun' in component.reflexLogic)
                reflexLogics.push(component.reflexLogic);
        }
    });
    if (reflexLogics.length) {
        reflexLogics.forEach(function (logic) {
            extension.push({
                url: utils_1.REFLEX_TEST_LOGIC_URL,
                extension: [
                    {
                        url: utils_1.REFLEX_TEST_TO_RUN_URL,
                        valueCanonical: logic.testToRun.testCanonicalUrl,
                    },
                    {
                        url: utils_1.REFLEX_TEST_TO_RUN_NAME_URL,
                        valueString: logic.testToRun.testName,
                    },
                    {
                        url: utils_1.REFLEX_TEST_ALERT_URL,
                        valueString: logic.triggerAlert,
                    },
                    {
                        url: utils_1.REFLEX_TEST_CONDITION_URL,
                        valueExpression: {
                            description: logic.condition.description,
                            language: logic.condition.language,
                            expression: logic.condition.expression,
                        },
                    },
                ],
            });
        });
    }
    return extension.length ? extension : undefined;
};
var getUnitForCodeableConceptType = function (item) {
    if (item.dataType !== 'CodeableConcept')
        return undefined;
    if (!item.unit)
        return undefined;
    return makeUnitCoding(item.unit);
};
var getComponentObservationDefinition = function (item) {
    var _a;
    var componentName = item.componentName;
    var obsDef = {
        // changing these ids will create a backwards compatibility issue for the results page
        id: "contained-".concat(sanitizeForId(componentName.toLowerCase()), "-component-").concat(item.dataType.toLowerCase(), "-observationDef-id"),
        resourceType: 'ObservationDefinition',
        code: {
            coding: __spreadArray([], item.loincCode.map(function (loincCode) {
                return { system: 'http://loinc.org', code: loincCode };
            }), true),
            text: componentName,
        },
        permittedDataType: [item.dataType],
    };
    var contained = [];
    if (item.dataType === 'CodeableConcept') {
        if (!((_a = item.valueSet) === null || _a === void 0 ? void 0 : _a.length)) {
            throw new Error("valueSet not defined on codeableConcept component ".concat(componentName, " ").concat(JSON.stringify(item)));
        }
        var _b = makeValueSet(componentName, item.valueSet, 'valid'), validValueSetId = _b.valueSetId, validValueSet = _b.valueSet;
        var _c = makeValueSet(componentName, item.abnormalValues, 'abnormal'), abnormalValueSetId = _c.valueSetId, abnormalValueSet = _c.valueSet;
        // the normalValueSet will serve as the reference range
        var validSet = new Set(item.valueSet);
        var abnormalSet = new Set(item.abnormalValues);
        var _d = makeValueSet(componentName, __spreadArray([], valueSetConfigDiff(validSet, abnormalSet), true), 'reference-range'), refRangeValueSetId = _d.valueSetId, refRangeValueSet = _d.valueSet;
        obsDef.validCodedValueSet = {
            type: 'ValueSet',
            reference: "#".concat(validValueSetId),
        };
        obsDef.abnormalCodedValueSet = {
            type: 'ValueSet',
            reference: "#".concat(abnormalValueSetId),
        };
        obsDef.normalCodedValueSet = {
            type: 'ValueSet',
            reference: "#".concat(refRangeValueSetId),
        };
        obsDef.extension = makeObsDefExtension(item);
        if (item.unit) {
            obsDef.quantitativeDetails = { unit: getUnitForCodeableConceptType(item) };
        }
        contained.push(validValueSet, abnormalValueSet, refRangeValueSet, obsDef);
    }
    else if (item.dataType === 'Quantity') {
        if (!item.normalRange) {
            throw new Error("No normalRange for quantity type component ".concat(componentName, " ").concat(JSON.stringify(item)));
        }
        obsDef.quantitativeDetails = makeQuantitativeDetails(item);
        obsDef.qualifiedInterval = [makeQualifiedInterval(item)];
        obsDef.extension = makeObsDefExtension(item);
        contained.push(obsDef);
    }
    else if (item.dataType === 'string') {
        obsDef.extension = makeObsDefExtension(item);
        contained.push(obsDef);
    }
    else {
        throw new Error("Got unrecognized component item: ".concat(JSON.stringify(item)));
    }
    return {
        obsDef: obsDef,
        contained: contained,
    };
};
function getObservationRequirement(item) {
    var obsDefReferences = [];
    var contained = [];
    item.components.forEach(function (item) {
        var _a = getComponentObservationDefinition(item), obsDef = _a.obsDef, componentContained = _a.contained;
        if (!obsDef.id) {
            throw new Error("Error in obsDef generation, no id found for component ".concat(JSON.stringify(item)));
        }
        obsDefReferences.push({
            type: 'ObservationDefinition',
            reference: "#".concat(obsDef.id),
        });
        contained.push.apply(contained, componentContained);
    });
    return {
        obsDefReferences: obsDefReferences,
        contained: contained,
    };
}
var getUrlAndVersion = function (item, adUrlVersionMap) {
    if (!item.name)
        throw new Error('Item must have a name');
    var nameForUrl = item.name.split(' ').join('');
    var url = "".concat(AD_CANONICAL_URL_BASE, "/").concat(nameForUrl);
    var curVersion = adUrlVersionMap[url];
    var updatedVersion = curVersion ? parseInt(curVersion) + 1 : 1;
    return { url: url, version: updatedVersion.toString() };
};
function loadData(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var absPath, moduleUrl, importedModule;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (filePath === 'default') {
                        return [2 /*return*/, base_in_house_lab_seed_data_1.testItems];
                    }
                    absPath = path_1.default.resolve(process.cwd(), filePath);
                    moduleUrl = (0, url_1.pathToFileURL)(absPath).href;
                    return [4 /*yield*/, Promise.resolve("".concat(moduleUrl)).then(function (s) { return require(s); })];
                case 1:
                    importedModule = _a.sent();
                    // Named export
                    if ('testItems' in importedModule) {
                        return [2 /*return*/, importedModule.testItems];
                    }
                    // Default export (if file did `export default testItems` or `export default { testItems }`)
                    if (importedModule.default) {
                        if ('testItems' in importedModule.default) {
                            return [2 /*return*/, importedModule.default.testItems];
                        }
                        // fallback if default is the array itself
                        return [2 /*return*/, importedModule.default];
                    }
                    throw new Error("Could not find 'testItems' export in module: ".concat(filePath));
            }
        });
    });
}
var WRITE_MODES = ['api', 'json'];
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var program, options, ENV, envConfig, testItems, writeMode, token, oystehrClient, requests, adUrlVersionMap, activityDefinitions, _i, testItems_1, testItem, _a, obsDefReferences, contained, _b, activityDefUrl, activityDefVersion, activityDef, oystehrResponse, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    program = new commander_1.Command();
                    program
                        .requiredOption('-d, --data <path>', 'Path to data file')
                        .requiredOption('-e, --env <env>', 'Environment name')
                        .requiredOption('-m, --mode <mode>', 'Write mode', function (val) {
                        if (!WRITE_MODES.includes(val)) {
                            throw new Error("Write mode must be one of: ".concat(WRITE_MODES.join('|')));
                        }
                        return val;
                    });
                    program.parse(process.argv);
                    options = program.opts();
                    ENV = options.env.toLowerCase();
                    ENV = ENV === 'dev' ? 'development' : ENV;
                    try {
                        envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(ENV, ".json"), 'utf8'));
                    }
                    catch (e) {
                        console.error("Unable to read env file. Error: ".concat(JSON.stringify(e)));
                        process.exit(3);
                    }
                    return [4 /*yield*/, loadData(options.data)];
                case 1:
                    testItems = _c.sent();
                    console.log("Loaded ".concat(testItems.length, " items from \"").concat(options.data, "\""));
                    writeMode = options.mode;
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
                case 2:
                    token = _c.sent();
                    if (!token) {
                        console.error('Failed to fetch auth token.');
                        process.exit(4);
                    }
                    console.log("Creating ActivityDefinitions on ".concat(ENV, " environment\n"));
                    oystehrClient = (0, shared_1.createOystehrClient)(token, envConfig);
                    requests = [];
                    adUrlVersionMap = {};
                    activityDefinitions = [];
                    for (_i = 0, testItems_1 = testItems; _i < testItems_1.length; _i++) {
                        testItem = testItems_1[_i];
                        _a = getObservationRequirement(testItem), obsDefReferences = _a.obsDefReferences, contained = _a.contained;
                        _b = getUrlAndVersion(testItem, adUrlVersionMap), activityDefUrl = _b.url, activityDefVersion = _b.version;
                        activityDef = {
                            resourceType: 'ActivityDefinition',
                            status: 'active',
                            kind: 'ServiceRequest',
                            code: {
                                coding: __spreadArray([
                                    {
                                        system: utils_1.IN_HOUSE_TEST_CODE_SYSTEM,
                                        code: testItem.name,
                                    }
                                ], testItem.cptCode.map(function (cptCode) {
                                    return {
                                        system: 'http://www.ama-assn.org/go/cpt',
                                        code: cptCode,
                                    };
                                }), true),
                            },
                            title: testItem.name,
                            name: testItem.name,
                            participant: [
                                {
                                    type: 'device',
                                    role: {
                                        coding: __spreadArray([], Object.entries(testItem.methods)
                                            .filter(function (entry) { return entry[1] !== undefined; })
                                            .map(function (_a) {
                                            var key = _a[0], value = _a[1];
                                            return ({
                                                system: utils_1.IN_HOUSE_PARTICIPANT_ROLE_SYSTEM,
                                                code: key,
                                                display: value.device,
                                            });
                                        }), true),
                                    },
                                },
                            ],
                            // specimenRequirement -- nothing in the test requirements describes this
                            observationRequirement: obsDefReferences,
                            contained: contained,
                            url: activityDefUrl,
                            version: activityDefVersion,
                            meta: {
                                tag: [
                                    {
                                        system: utils_1.IN_HOUSE_TAG_DEFINITION.system,
                                        code: utils_1.IN_HOUSE_TAG_DEFINITION.code,
                                    },
                                ],
                            },
                            relatedArtifact: makeRelatedArtifact(testItem),
                            extension: makeActivityExtension(testItem),
                        };
                        activityDefinitions.push(activityDef);
                    }
                    console.log('ActivityDefinitions: ', JSON.stringify(activityDefinitions, undefined, 2));
                    if (!(writeMode === 'api')) return [3 /*break*/, 8];
                    console.log('write mode is api, preparing fhir requests');
                    return [4 /*yield*/, oystehrClient.fhir.search({
                            resourceType: 'ActivityDefinition',
                            params: [
                                { name: '_tag', value: utils_1.IN_HOUSE_TAG_DEFINITION.code },
                                { name: 'status', value: 'active' },
                            ],
                        })];
                case 3:
                    // make the requests to retire the pre-existing ActivityDefinitions
                    (_c.sent())
                        .unbundle()
                        .forEach(function (activityDef) {
                        if (activityDef.id)
                            requests.push({
                                url: "/ActivityDefinition/".concat(activityDef.id),
                                method: 'PATCH',
                                operations: [
                                    {
                                        op: 'replace',
                                        path: '/status',
                                        value: 'retired',
                                    },
                                ],
                            });
                        if (activityDef.url && activityDef.version) {
                            adUrlVersionMap[activityDef.url] = activityDef.version;
                        }
                    });
                    activityDefinitions.forEach(function (activityDefinition) {
                        // update the URL for the items we made so far in activityDefinitions
                        var _a = getUrlAndVersion(activityDefinition, adUrlVersionMap), activityDefUrl = _a.url, activityDefVersion = _a.version;
                        console.log("Updating new ".concat(activityDefinition.name, " version from ").concat(activityDefinition.version, " -> ").concat(activityDefVersion));
                        console.log("Updating new ".concat(activityDefinition.name, " url from ").concat(activityDefinition.url, " -> ").concat(activityDefUrl));
                        requests.push({
                            method: 'POST',
                            url: '/ActivityDefinition',
                            resource: __assign(__assign({}, activityDefinition), { version: activityDefVersion, url: activityDefUrl }),
                        });
                    });
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, oystehrClient.fhir.transaction({ requests: requests })];
                case 5:
                    oystehrResponse = _c.sent();
                    console.log(JSON.stringify(oystehrResponse));
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _c.sent();
                    console.error(error_1);
                    throw error_1;
                case 7:
                    process.exit(0);
                    return [3 /*break*/, 9];
                case 8:
                    if (writeMode === 'json') {
                        console.log('write mode is json, preparing json output');
                        fs_1.default.writeFileSync('src/scripts/data/inhouse-labs-ad.json', JSON.stringify(activityDefinitions, undefined, 2), 'utf8');
                        console.log('Successfully wrote json file. Exiting');
                        process.exit(0);
                    }
                    _c.label = 9;
                case 9:
                    console.error("write mode not recognized: ".concat(writeMode));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('Script failed:', error);
    process.exit(1);
});
