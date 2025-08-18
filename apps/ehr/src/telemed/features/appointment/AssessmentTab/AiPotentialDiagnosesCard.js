"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPotentialDiagnosesCard = void 0;
var colors_1 = require("@ehrTheme/colors");
var icons_1 = require("@ehrTheme/icons");
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var AiPotentialDiagnosesCard = function () {
    var _a;
    var theme = (0, material_1.useTheme)();
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var _b = (0, react_1.useState)(true), visible = _b[0], setVisible = _b[1];
    var aiPotentialDiagnoses = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.aiPotentialDiagnosis) !== null && _a !== void 0 ? _a : [];
    var handleClose = function () {
        setVisible(false);
    };
    return visible && aiPotentialDiagnoses.length > 0 ? (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            backgroundColor: theme.palette.background.paper,
            border: "1px solid ".concat(colors_1.otherColors.solidLine),
            borderRadius: 1,
            marginBottom: '16px',
            padding: '16px',
        }}>
      <material_1.Box style={{
            display: 'flex',
            borderRadius: '8px',
            marginBottom: '8px',
            alignItems: 'center',
            justifyContent: 'space-between',
        }}>
        <material_1.Box style={{
            display: 'flex',
            alignItems: 'center',
        }}>
          <img src={icons_1.ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }}/>
          <material_1.Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </material_1.Typography>
        </material_1.Box>
        <material_1.IconButton onClick={handleClose} aria-label="Close">
          <Close_1.default />
        </material_1.IconButton>
      </material_1.Box>
      <material_1.Box style={{
            background: '#FFF9EF',
            borderRadius: '8px',
            padding: '8px',
        }}>
        <material_1.Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
          Potential Diagnoses with ICD-10 Codes
        </material_1.Typography>
        <ul>
          {aiPotentialDiagnoses.map(function (diagnosis) {
            return (<li key={diagnosis.code}>
                <material_1.Typography variant="body1">{diagnosis.code + ': ' + diagnosis.display}</material_1.Typography>
              </li>);
        })}
        </ul>
      </material_1.Box>
    </material_1.Box>) : (<></>);
};
exports.AiPotentialDiagnosesCard = AiPotentialDiagnosesCard;
//# sourceMappingURL=AiPotentialDiagnosesCard.js.map