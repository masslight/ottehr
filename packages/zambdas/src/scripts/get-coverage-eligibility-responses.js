"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// cSpell:ignore elig, inplan, mesg
var sdk_1 = require("@oystehr/sdk");
var fs = require("fs");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function getCoverageEligibilityResponsesByPatient(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var bundledResponse, unbundled, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Fetching most recent CoverageEligibilityResponse for patient: ".concat(patientId));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'CoverageEligibilityResponse',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: '_sort',
                                    value: '-_lastUpdated',
                                },
                                {
                                    name: '_count',
                                    value: 1,
                                },
                            ],
                        })];
                case 2:
                    bundledResponse = _a.sent();
                    unbundled = bundledResponse.unbundle();
                    console.log("Found ".concat(unbundled.length, " most recent CoverageEligibilityResponse for patient: ").concat(patientId));
                    return [2 /*return*/, unbundled];
                case 3:
                    error_1 = _a.sent();
                    console.error("Error fetching CoverageEligibilityResponse for patient ".concat(patientId, ":"), error_1);
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Function to extract and parse raw response from CoverageEligibilityResponse
function extractRawResponse(eligibilityResponse) {
    var _a;
    if (!eligibilityResponse.extension) {
        console.log("No extensions found in CoverageEligibilityResponse ".concat(eligibilityResponse.id));
        return null;
    }
    // Find the extension with the specific URL
    var rawResponseExtension = eligibilityResponse.extension.find(function (ext) { return ext.url === 'https://extensions.fhir.oystehr.com/raw-response'; });
    if (!rawResponseExtension) {
        console.log("Raw response extension not found in CoverageEligibilityResponse ".concat(eligibilityResponse.id));
        return null;
    }
    // Extract the value (could be valueString, valueAttachment, etc.)
    var rawResponseValue = rawResponseExtension.valueString ||
        ((_a = rawResponseExtension.valueAttachment) === null || _a === void 0 ? void 0 : _a.data) ||
        rawResponseExtension.valueBase64Binary;
    if (!rawResponseValue) {
        console.log("Raw response extension has no value in CoverageEligibilityResponse ".concat(eligibilityResponse.id));
        return null;
    }
    try {
        // Parse the JSON
        var parsedResponse = JSON.parse(rawResponseValue);
        console.log("\u2705 Successfully parsed raw response for CoverageEligibilityResponse ".concat(eligibilityResponse.id));
        return parsedResponse;
    }
    catch (error) {
        console.error("\u274C Error parsing raw response JSON for CoverageEligibilityResponse ".concat(eligibilityResponse.id, ":"), error);
        return null;
    }
}
// Enhanced function to get responses with parsed raw data
function getCoverageEligibilityResponsesWithRawData(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var eligibilityResponses, responsesWithRawData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getCoverageEligibilityResponsesByPatient(oystehr, patientId)];
                case 1:
                    eligibilityResponses = _a.sent();
                    responsesWithRawData = eligibilityResponses.map(function (response) { return ({
                        response: response,
                        rawData: extractRawResponse(response),
                    }); });
                    return [2 /*return*/, responsesWithRawData];
            }
        });
    });
}
// Function to get insurance type information from raw data
function getInsuranceTypeInfo(rawData) {
    if (!rawData || !rawData.elig || !rawData.elig.benefit) {
        return { type: 'N/A', isMedicaid: false };
    }
    // Look for the first benefit with insurance type information
    var benefitWithInsType = rawData.elig.benefit.find(function (benefit) { return benefit.insurance_type_code || benefit.insurance_type_description; });
    if (!benefitWithInsType) {
        return { type: 'N/A', isMedicaid: false };
    }
    var typeCode = benefitWithInsType.insurance_type_code || '';
    var typeDescription = benefitWithInsType.insurance_type_description || '';
    // Determine display text
    var displayType = 'N/A';
    if (typeCode && typeDescription) {
        displayType = "".concat(typeCode, " (").concat(typeDescription, ")");
    }
    else if (typeCode) {
        displayType = typeCode;
    }
    else if (typeDescription) {
        displayType = typeDescription;
    }
    // Check if it's Medicaid
    var isMedicaid = typeCode === 'MC' || (typeDescription === null || typeDescription === void 0 ? void 0 : typeDescription.toLowerCase().includes('medicaid')) || false;
    return { type: displayType, isMedicaid: isMedicaid };
}
// Function to format and display eligibility response data
function displayEligibilityData(rawData, responseId, patientId) {
    if (!rawData) {
        console.log("No raw data found for response ".concat(responseId));
        return;
    }
    // Write raw data to file
    var filename = "".concat(process.env.HOME || '~', "/Downloads/").concat(patientId, ".json");
    try {
        fs.writeFileSync(filename, JSON.stringify(rawData, null, 2), 'utf8');
        console.log("\n\uD83D\uDCC4 Raw response data written to: ".concat(filename));
    }
    catch (error) {
        console.error("\u274C Error writing raw response to file:", error);
    }
    // Check if response contains an error
    if (rawData.error) {
        console.log("\n\u274C Error Response for ".concat(responseId, ":"));
        console.log('=====================================');
        console.log("Error Code: ".concat(rawData.error.error_code || 'N/A'));
        console.log("Error Message: ".concat(rawData.error.error_mesg || 'N/A'));
        return;
    }
    // Check if response contains eligibility data
    if (!rawData.elig) {
        console.log("\n\u26A0\uFE0F  No eligibility data found for response ".concat(responseId));
        return;
    }
    var elig = rawData.elig;
    // Get insurance type information
    var insuranceInfo = getInsuranceTypeInfo(rawData);
    console.log("\n\uD83C\uDFE5 Eligibility Details for Response ".concat(responseId, ":"));
    console.log('=====================================');
    // Display insurance type with Medicaid highlighting
    if (insuranceInfo.isMedicaid) {
        console.log('🚨 MEDICAID COVERAGE DETECTED');
        console.log('=====================================');
    }
    console.log("\uD83C\uDFF7\uFE0F  Insurance Type: ".concat(insuranceInfo.isMedicaid ? '🚨 ' : '').concat(insuranceInfo.type));
    console.log('');
    // Member Information
    console.log('👤 Member Information:');
    console.log("   Name: ".concat(elig.ins_name_f || 'N/A', " ").concat(elig.ins_name_l || 'N/A'));
    console.log("   Member ID: ".concat(elig.ins_number || 'N/A'));
    console.log("   DOB: ".concat(formatDate(elig.ins_dob) || 'N/A'));
    console.log("   Sex: ".concat(elig.ins_sex || 'N/A'));
    console.log("   Address: ".concat(elig.ins_addr_1 || 'N/A', ", ").concat(elig.ins_city || 'N/A', ", ").concat(elig.ins_state || 'N/A', " ").concat(elig.ins_zip || 'N/A'));
    // Group Information
    console.log('\n🏢 Group Information:');
    console.log("   Group Name: ".concat(elig.group_name || 'N/A'));
    console.log("   Group Number: ".concat(elig.group_number || 'N/A'));
    // Eligibility Information
    console.log('\n📅 Eligibility Information:');
    console.log("   Begin Date: ".concat(formatDate(elig.eligibility_begin_date) || 'N/A'));
    console.log("   Result Date: ".concat(formatDate(elig.elig_result_date) || 'N/A'));
    console.log("   Result Time: ".concat(elig.elig_result_time || 'N/A'));
    // Benefits Information
    if (elig.benefit && Array.isArray(elig.benefit)) {
        console.log('\n💰 Benefits:');
        console.log('Code\tDescription\t\t\tCoverage\t\tAmount\t\tLevel\tPeriod\tIns Type');
        console.log('-------------------------------------------------------------------------------------');
        elig.benefit.forEach(function (benefit) {
            var _a;
            var code = benefit.benefit_code || 'N/A';
            var description = benefit.benefit_description || 'N/A';
            var coverage = benefit.benefit_coverage_description || 'N/A';
            var amount = benefit.benefit_amount ? "$".concat(parseInt(benefit.benefit_amount).toLocaleString()) : 'N/A';
            var level = benefit.benefit_level_description || 'N/A';
            var period = benefit.benefit_period_description || 'N/A';
            // Get insurance type for this benefit
            var benefitInsType = benefit.insurance_type_code || benefit.insurance_type_description || 'N/A';
            var isBenefitMedicaid = benefit.insurance_type_code === 'MC' || ((_a = benefit.insurance_type_description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes('medicaid'));
            var insTypeDisplay = isBenefitMedicaid ? "\uD83D\uDEA8 ".concat(benefitInsType) : benefitInsType;
            console.log("".concat(code, "\t").concat(description, "\t").concat(coverage, "\t").concat(amount, "\t\t").concat(level, "\t").concat(period, "\t").concat(insTypeDisplay));
            if (benefit.benefit_notes) {
                console.log("   Notes: ".concat(benefit.benefit_notes));
            }
            if (benefit.insurance_plan) {
                console.log("   Plan: ".concat(benefit.insurance_plan));
            }
            if (benefit.inplan_network) {
                console.log("   In-Network: ".concat(benefit.inplan_network === 'Y' ? 'Yes' : 'No'));
            }
            console.log('');
        });
    }
}
// Helper function to format date from YYYYMMDD to YYYY-MM-DD
function formatDate(dateString) {
    if (!dateString || dateString.length !== 8) {
        return null;
    }
    var year = dateString.substring(0, 4);
    var month = dateString.substring(4, 6);
    var day = dateString.substring(6, 8);
    return "".concat(year, "-").concat(month, "-").concat(day);
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, patientId, secrets, token, oystehr, responsesWithRawData, _i, responsesWithRawData_1, _a, response, rawData, id, status_1, hasRawData, memberName, insuranceTypeDisplay, firstName, lastName, insuranceInfo, responsesWithRawData_count, medicaidCount;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    env = process.argv[2];
                    patientId = process.argv[3];
                    if (!patientId) {
                        throw new Error('❌ Patient ID is required. Usage: npm run script get-coverage-eligibility-responses <env> <patientId>');
                    }
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _b.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, getCoverageEligibilityResponsesWithRawData(oystehr, patientId)];
                case 2:
                    responsesWithRawData = _b.sent();
                    if (responsesWithRawData.length === 0) {
                        console.log('No coverage eligibility responses found for this patient.');
                        return [2 /*return*/];
                    }
                    console.log("\n\uD83D\uDCCB Coverage Eligibility Responses for Patient ".concat(patientId, ":"));
                    console.log('ID\t\t\tStatus\t\tHas Raw Data\tMember Name\t\tInsurance Type');
                    console.log('------------------------------------------------------------------------------------');
                    for (_i = 0, responsesWithRawData_1 = responsesWithRawData; _i < responsesWithRawData_1.length; _i++) {
                        _a = responsesWithRawData_1[_i], response = _a.response, rawData = _a.rawData;
                        id = response.id || 'N/A';
                        status_1 = response.status || 'N/A';
                        hasRawData = rawData ? '✅' : '❌';
                        memberName = 'N/A';
                        insuranceTypeDisplay = 'N/A';
                        if (rawData && rawData.elig) {
                            firstName = rawData.elig.ins_name_f || '';
                            lastName = rawData.elig.ins_name_l || '';
                            memberName = "".concat(firstName, " ").concat(lastName).trim() || 'N/A';
                            insuranceInfo = getInsuranceTypeInfo(rawData);
                            insuranceTypeDisplay = insuranceInfo.isMedicaid ? "\uD83D\uDEA8 ".concat(insuranceInfo.type) : insuranceInfo.type;
                        }
                        console.log("".concat(id, "\t").concat(status_1, "\t\t").concat(hasRawData, "\t\t").concat(memberName, "\t\t").concat(insuranceTypeDisplay));
                        // Display detailed eligibility data if raw data is available
                        if (rawData) {
                            displayEligibilityData(rawData, id, patientId);
                        }
                    }
                    responsesWithRawData_count = responsesWithRawData.filter(function (_a) {
                        var rawData = _a.rawData;
                        return rawData !== null;
                    }).length;
                    medicaidCount = responsesWithRawData.filter(function (_a) {
                        var rawData = _a.rawData;
                        var insuranceInfo = getInsuranceTypeInfo(rawData);
                        return insuranceInfo.isMedicaid;
                    }).length;
                    console.log("\n\uD83D\uDCCA Summary:");
                    console.log("Total Responses: ".concat(responsesWithRawData.length));
                    console.log("With Raw Data: ".concat(responsesWithRawData_count));
                    console.log("Medicaid Coverage: ".concat(medicaidCount));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ This is all the coverage eligibilities for the specified patient.'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});
