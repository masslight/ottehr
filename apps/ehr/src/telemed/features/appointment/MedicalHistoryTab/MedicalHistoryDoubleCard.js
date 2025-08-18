"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalHistoryDoubleCard = void 0;
var colors_1 = require("@ehrTheme/colors");
var react_1 = require("react");
var components_1 = require("../../../components");
var MedicalHistoryDoubleCard = function (props) {
    var collapsed = props.collapsed, onSwitch = props.onSwitch, label = props.label, patientSide = props.patientSide, providerSide = props.providerSide, patientSideLabel = props.patientSideLabel, providerSideLabel = props.providerSideLabel;
    return (<components_1.AccordionCard label={label} collapsed={collapsed} onSwitch={onSwitch}>
      <components_1.DoubleColumnContainer divider padding leftColumn={<>
            <components_1.UppercaseCaptionTypography sx={{ pb: 2 }}>{patientSideLabel || 'Patient'}</components_1.UppercaseCaptionTypography>
            {patientSide}
          </>} rightColumn={<>
            <components_1.UppercaseCaptionTypography sx={{ color: colors_1.otherColors.orange700, pb: 2 }}>
              {providerSideLabel || 'Healthcare staff input'}
            </components_1.UppercaseCaptionTypography>
            {providerSide}
          </>}/>
    </components_1.AccordionCard>);
};
exports.MedicalHistoryDoubleCard = MedicalHistoryDoubleCard;
//# sourceMappingURL=MedicalHistoryDoubleCard.js.map