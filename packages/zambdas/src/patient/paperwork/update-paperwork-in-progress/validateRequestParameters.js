"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdatePaperworkParams = validateUpdatePaperworkParams;
var luxon_1 = require("luxon");
function validateUpdatePaperworkParams(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var inputJSON = JSON.parse(input.body);
    console.log('inputJSON', JSON.stringify(inputJSON));
    var appointmentID = inputJSON.appointmentID, inProgress = inputJSON.inProgress;
    if (inProgress === undefined || !luxon_1.DateTime.fromISO(inProgress).isValid) {
        throw new Error('Paperwork in progress update must supply a valid iso string for inProgress param');
    }
    return {
        appointmentID: appointmentID,
        inProgress: inProgress,
    };
}
