"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsMergeButton = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var PatientsMergeDifference_1 = require("./PatientsMergeDifference");
var PatientsMergeSelect_1 = require("./PatientsMergeSelect");
var PatientsMergeButton = function (props) {
    var patientIds = props.patientIds;
    var _a = (0, react_1.useState)(undefined), open = _a[0], setOpen = _a[1];
    var _b = (0, react_1.useState)([]), difference = _b[0], setDifference = _b[1];
    var close = function () {
        setDifference([]);
        setOpen(undefined);
    };
    var next = function (patientIds) {
        setDifference(patientIds);
        setOpen('difference');
    };
    return (<>
      <material_1.Button onClick={function () { return setOpen('select'); }}>Open</material_1.Button>
      {open === 'select' && <PatientsMergeSelect_1.PatientsMergeSelect open next={next} close={close} patientIds={patientIds}/>}
      {open === 'difference' && (<PatientsMergeDifference_1.PatientsMergeDifference open close={close} back={function () { return setOpen('select'); }} patientIds={difference}/>)}
    </>);
};
exports.PatientsMergeButton = PatientsMergeButton;
//# sourceMappingURL=PatientsMergeButton.js.map