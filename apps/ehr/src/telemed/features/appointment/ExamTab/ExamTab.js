"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamTab = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var hooks_1 = require("../../../hooks");
var AbdomenCard_1 = require("./AbdomenCard");
var BackCard_1 = require("./BackCard");
var ChestCard_1 = require("./ChestCard");
var EarsCard_1 = require("./EarsCard");
var EyesCard_1 = require("./EyesCard");
var GeneralCard_1 = require("./GeneralCard");
var HeadCard_1 = require("./HeadCard");
var MouthCard_1 = require("./MouthCard");
var MusculoskeletalCard_1 = require("./MusculoskeletalCard");
var NeckCard_1 = require("./NeckCard");
var NeurologicalCard_1 = require("./NeurologicalCard");
var NoseCard_1 = require("./NoseCard");
var PsychCard_1 = require("./PsychCard");
var ReadOnlyCard_1 = require("./ReadOnlyCard");
var SkinCard_1 = require("./SkinCard");
var ExamTab = function () {
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      {isReadOnly ? (<ReadOnlyCard_1.ReadOnlyCard />) : (<>
          {/*<VitalsCard />*/}
          <GeneralCard_1.GeneralCard />
          <HeadCard_1.HeadCard />
          <EyesCard_1.EyesCard />
          <NoseCard_1.NoseCard />
          <EarsCard_1.EarsCard />
          <MouthCard_1.MouthCard />
          <NeckCard_1.NeckCard />
          <ChestCard_1.ChestCard />
          <BackCard_1.BackCard />
          <SkinCard_1.SkinCard />
          <AbdomenCard_1.AbdomenCard />
          <MusculoskeletalCard_1.MusculoskeletalCard />
          <NeurologicalCard_1.NeurologicalCard />
          <PsychCard_1.PsychCard />
        </>)}
    </material_1.Box>);
};
exports.ExamTab = ExamTab;
//# sourceMappingURL=ExamTab.js.map