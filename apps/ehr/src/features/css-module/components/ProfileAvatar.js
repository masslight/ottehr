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
exports.ProfileAvatar = void 0;
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var dialogs_1 = require("../../../components/dialogs");
var ProfilePhotoImagePicker_1 = require("../../../components/ProfilePhotoImagePicker");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var useAppointment_1 = require("../hooks/useAppointment");
var css_queries_1 = require("../queries/css.queries");
var ProfileAvatar = function (_a) {
    var appointmentID = _a.appointmentID, embracingSquareSize = _a.embracingSquareSize, hasEditableInfo = _a.hasEditableInfo;
    var mappedData = (0, useAppointment_1.useAppointment)(appointmentID).mappedData;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(false), isProfileImagePickerOpen = _b[0], setProfileImagePickerOpen = _b[1];
    var _c = (0, react_1.useState)(false), isEditDialogOpen = _c[0], setIsEditDialogOpen = _c[1];
    var _d = (0, react_1.useState)(undefined), profilePhotoUrl = _d[0], setProfilePhotoUrl = _d[1];
    var patientPhoto = mappedData === null || mappedData === void 0 ? void 0 : mappedData.patientAvatarPhotoUrl;
    (0, react_1.useEffect)(function () {
        if (!patientPhoto) {
            setProfilePhotoUrl(undefined);
        }
    }, [patientPhoto]);
    (0, css_queries_1.useGetSignedPatientProfilePhotoUrlQuery)(patientPhoto, function (profilePhotoResponse) {
        var presignedImageUrl = profilePhotoResponse.presignedImageUrl;
        setProfilePhotoUrl(presignedImageUrl);
    });
    var avatarSquareSize = embracingSquareSize !== null && embracingSquareSize !== void 0 ? embracingSquareSize : 50;
    var editBubbleSize = Math.floor(0.3 * avatarSquareSize);
    return (<>
      {isProfileImagePickerOpen && (<ProfilePhotoImagePickerForCSS open={isProfileImagePickerOpen} setOpen={setProfileImagePickerOpen}/>)}
      {hasEditableInfo && isEditDialogOpen && (<dialogs_1.EditPatientDialog modalOpen={isEditDialogOpen} onClose={function () { return setIsEditDialogOpen(false); }}/>)}
      <material_1.Box sx={{ position: 'relative' }}>
        <material_1.Avatar src={profilePhotoUrl} sx={{ width: avatarSquareSize, height: avatarSquareSize }} alt="Patient" onClick={function () {
            setProfileImagePickerOpen(true);
        }}/>
        {hasEditableInfo && (<material_1.IconButton size="small" aria-label="edit" sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: theme.palette.primary.main,
                color: 'white',
                width: editBubbleSize,
                height: editBubbleSize,
                '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                },
            }} onClick={function () {
                setIsEditDialogOpen(true);
            }}>
            <EditOutlined_1.default fontSize="small"/>
          </material_1.IconButton>)}
      </material_1.Box>
    </>);
};
exports.ProfileAvatar = ProfileAvatar;
var ProfilePhotoImagePickerForCSS = function (props) {
    var open = props.open, setOpen = props.setOpen;
    var patient = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['patient']).patient;
    return (<ProfilePhotoImagePicker_1.default open={open} setOpen={setOpen} patient={patient} onUpdate={function (patientData) {
            return telemed_1.useAppointmentStore.setState({
                patient: __assign({}, patientData),
            });
        }}/>);
};
//# sourceMappingURL=ProfileAvatar.js.map