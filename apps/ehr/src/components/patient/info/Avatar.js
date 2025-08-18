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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientAvatar = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var css_queries_1 = require("../../../features/css-module/queries/css.queries");
var useGetPatient_1 = require("../../../hooks/useGetPatient");
var ProfilePhotoImagePicker_1 = require("../../ProfilePhotoImagePicker");
var PatientAvatar = function (_a) {
    var id = _a.id, sx = _a.sx;
    var _b = (0, react_1.useState)(false), isProfileImagePickerOpen = _b[0], setProfileImagePickerOpen = _b[1];
    var _c = (0, react_1.useState)(undefined), profilePhotoUrl = _c[0], setProfilePhotoUrl = _c[1];
    var _d = (0, useGetPatient_1.useGetPatient)(id), patient = _d.patient, setPatient = _d.setPatient;
    var patientPhoto = (0, react_1.useMemo)(function () {
        var _a, _b;
        return ((_b = (_a = patient === null || patient === void 0 ? void 0 : patient.photo) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.url) || '';
    }, [patient === null || patient === void 0 ? void 0 : patient.photo]);
    (0, css_queries_1.useGetSignedPatientProfilePhotoUrlQuery)(patientPhoto, function (profilePhotoResponse) {
        var presignedImageUrl = profilePhotoResponse.presignedImageUrl;
        setProfilePhotoUrl(presignedImageUrl);
    });
    return (<>
      <material_1.Avatar src={patientPhoto ? profilePhotoUrl : undefined} alt="Patient" sx={__assign({ width: 150, height: 150, cursor: patient ? 'pointer' : 'inherit' }, sx)} onClick={function () { return patient && setProfileImagePickerOpen(true); }}/>
      {isProfileImagePickerOpen && (<ProfilePhotoImagePicker_1.default open={isProfileImagePickerOpen} setOpen={setProfileImagePickerOpen} patient={patient} onUpdate={setPatient}/>)}
    </>);
};
exports.PatientAvatar = PatientAvatar;
//# sourceMappingURL=Avatar.js.map