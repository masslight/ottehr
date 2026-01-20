"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if ((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets) === undefined) {
        throw new Error('"PROJECT_API" configuration not provided');
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');
    if (input.body) {
        var _a = JSON.parse(input.body), patient = _a.patient, visitId = _a.visitId, claimId = _a.claimId, teamMember = _a.teamMember, queue = _a.queue, dayInQueue = _a.dayInQueue, status_1 = _a.status, state = _a.state, facilityGroup = _a.facilityGroup, facility = _a.facility, insurance = _a.insurance, balance = _a.balance, dosFrom = _a.dosFrom, dosTo = _a.dosTo, offset = _a.offset, pageSize = _a.pageSize;
        return {
            secrets: input.secrets,
            patient: patient,
            visitId: visitId,
            claimId: claimId,
            teamMember: teamMember,
            queue: queue,
            dayInQueue: dayInQueue,
            status: status_1,
            state: state,
            facilityGroup: facilityGroup,
            facility: facility,
            insurance: insurance,
            balance: balance,
            dosFrom: dosFrom,
            dosTo: dosTo,
            offset: offset,
            pageSize: pageSize,
        };
    }
    else
        return { secrets: input.secrets };
}
