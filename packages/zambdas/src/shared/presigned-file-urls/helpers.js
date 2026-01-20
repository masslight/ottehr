"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeZ3Url = exports.makeZ3UrlForVisitAudio = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var makeZ3UrlForVisitAudio = function (input) {
    var secrets = input.secrets, bucketName = input.bucketName;
    var projectId = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_ID, secrets);
    var dateTimeNow = luxon_1.DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    var fileURL = "".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/z3/").concat(projectId, "-").concat(bucketName, "/").concat(dateTimeNow, "-").concat(input.fileName);
    console.log('created z3 url: ', fileURL);
    return fileURL;
};
exports.makeZ3UrlForVisitAudio = makeZ3UrlForVisitAudio;
var makeZ3Url = function (input) {
    var secrets = input.secrets, bucketName = input.bucketName, patientID = input.patientID;
    var projectId = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_ID, secrets);
    var dateTimeNow = luxon_1.DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    var resolvedFileName;
    if ('fileName' in input) {
        resolvedFileName = input.fileName;
    }
    else {
        resolvedFileName = "".concat(input.fileType, ".").concat(input.fileFormat);
    }
    var fileURL = "".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/z3/").concat(projectId, "-").concat(bucketName, "/").concat(patientID, "/").concat(dateTimeNow, "-").concat(resolvedFileName);
    console.log('created z3 url: ', fileURL);
    return fileURL;
};
exports.makeZ3Url = makeZ3Url;
