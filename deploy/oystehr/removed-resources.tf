# This file removes global template FHIR resources from Terraform state
# without destroying the actual resources. These resources are now managed
# at runtime by the application.
#
# After a successful `terraform apply`, this file can be deleted.

removed {
  from = oystehr_fhir_resource.LEFT_AOM_ACUTE_OTITIS_MEDIA_WITH_WATCH_AND_WAIT

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.LEFT_AOM

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.RIGHT_AOM_ACUTE_OTITIS_MEDIA_WITH_WATCH_AND_WAIT

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_1

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_2

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_3

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_4

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_5

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_6

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_7

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_8

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_9

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_10

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.RIGHT_AOM

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.BILATERAL_AOM

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.VIRAL_ILLNESS_WITH_FEVER

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_11

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_12

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_14

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_15

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_16

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_17

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_18

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_19

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_20

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.VIRAL_ILLNESS_WITHOUT_FEVER

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.CONJUNCTIVITIS_RIGHT_EYE

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.CONJUNCTIVITIS_LEFT_EYE

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_21

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_22

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_23

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_24

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_25

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_26

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_27

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_28

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_29

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_30

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.CONJUNCTIVITIS_BILATERAL

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.PHARYNGITIS_VIRAL

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.PHARYNGITIS_STREP

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_31

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_32

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_33

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_34

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_35

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_36

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_37

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_38

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_39

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_40

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SINUSITIS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SINUSITIS_WAIT_SEE

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.GASTROENTERITIS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_41

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_42

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_43

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_44

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_45

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_46

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_47

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_48

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_49

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_50

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.GASTROENTERITIS_ZOFRAN

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.ABDOMINAL_PAIN_FOCUS_ON_CONSTIPATION

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.CONSTIPATION

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_51

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_52

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_53

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_54

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_55

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_56

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_57

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_58

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_59

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_60

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.INFLUENZA_TAMIFLU

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.INFLUENZA_NO_TAMIFLU

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.INFLUENZA_DECLINED_TAMIFLU

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_61

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_62

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_63

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_64

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_65

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_66

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_67

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_68

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_69

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_70

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.CROUP

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.CROUP_RAC_EPI

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.BRONCHIOLITIS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_71

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_72

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_73

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_74

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_75

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_76

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_77

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_78

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_79

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_80

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.PNEUMONIA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.ASTHMA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.UTI

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_81

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_82

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_83

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_84

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_85

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_86

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_87

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_88

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_89

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_90

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.DYSURIA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.VAGINITIS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.OTALGIA_RIGHT

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_91

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_92

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_93

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_94

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_95

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_96

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_97

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_98

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_99

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_100

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.OTALGIA_LEFT

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.LACERATION_SCALP

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.LACERATION_FACE_SUTURES

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_101

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_102

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_103

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_104

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_105

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_106

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_107

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_108

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_109

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_110

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.LACERATION_FACE_DERMABOND

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.COXSACKIE_RASH_ONLY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.COXSACKIE_HFM

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_111

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_112

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_113

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_114

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_115

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_116

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_117

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_118

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_119

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_120

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.COXSACKIE_HERPANGINA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.BUG_BITE

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPRAIN_STRAIN_WITH_XRAY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_121

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_122

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_123

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_124

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_125

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_126

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_127

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_128

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_129

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_130

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPRAIN_STRAIN_NO_XRAY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.WRIST_SPRAIN_R

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.WRIST_SPRAIN_L

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_131

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_132

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_133

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_134

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_135

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_136

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_137

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_138

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_139

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_140

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.ANKLE_SPRAIN_R

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.ANKLE_SPRAIN_L

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MINOR_HEAD_INJURY_CLOSED_HEAD_INJURY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_141

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_142

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_143

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_144

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_145

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_146

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_147

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_148

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_149

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_150

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.DIAPER_DERMATITIS_CANDID

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.DIAPER_DERMATITIS_IRRITANT

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.ECZEMA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_151

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_152

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_153

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_154

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_155

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_156

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_157

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_158

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_159

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_160

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.IMPETIGO_TOPICAL

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.IMPETIGO_TOPICAL_ORAL_ANTIBIOTICS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.URTICARIA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_161

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_162

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_163

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_164

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_165

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_166

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_167

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_168

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_169

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_170

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.POISON_IVY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.PHARYNGITIS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.HEADACHE

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_171

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_172

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_173

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_174

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_175

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_176

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_177

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_178

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_179

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_180

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.BAC_SINUSITIS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.ROS_TEMPLATE_GENERAL

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.AUTOMOBILE_ACCIDENT

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.WORKERS_COMP

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_181

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_182

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_183

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_184

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_185

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_186

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_187

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_188

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_189

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.SPACER_190

  lifecycle {
    destroy = false
  }
}


# Resources from in-house-lab-activity-definitions-archive.json

removed {
  from = oystehr_fhir_resource.activity-definition-flu-b-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-glucose-finger-heel-stick-14

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-flu-vid-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-strep-a-9

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-influenza-b-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-urinalysis-14

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-urine-pregnancy-test-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-rsv-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-id-now-strep-5

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-covid-19-antigen-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-flu-a-14

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-monospot-test-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-covid-19-antigen-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-stool-guaiac-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rsv-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-influenza-a-13

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-alcohol-confirmation-test-1_0_0

  lifecycle {
    destroy = false
  }
}


# Resources from in-house-lab-activity-definitions.json

removed {
  from = oystehr_fhir_resource.activity-definition-flu-b-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-glucose-finger-heel-stick-14_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-flu-vid-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-strep-a-9_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-influenza-b-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-urinalysis-14_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-urine-pregnancy-test-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-rsv-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-id-now-strep-5_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-covid-19-antigen-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-flu-a-14_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-monospot-test-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-covid-19-antigen-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-stool-guaiac-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rsv-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-rapid-influenza-a-13_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-snellen-test-1_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-alcohol-test-1_0_0

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.activity-definition-alcohol-confirmation-test-1_0_1

  lifecycle {
    destroy = false
  }
}


# Resources from in-house-medications.json

removed {
  from = oystehr_fhir_resource.MEDICATION_ACETAMINOPHEN_LIQUID

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_ACETAMINOPHEN_TABS

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_ACETAMINOPHEN_80mg_SUPPOSITORY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_ACETAMINOPHEN_325mg_SUPPOSITORY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_ACETAMINOPHEN_120mg_SUPPOSITORY

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_ACTIVATED_CHARCOAL

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_ALBUTEROL

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_VENTOLIN_HFA

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_AMOXICILLIN

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.MEDICATION_AMOXICILLIN_CLAVULANATE

  lifecycle {
    destroy = false
  }
}


removed {
  from = oystehr_fhir_resource.list-external-lab-set-autolab-example

  lifecycle {
    destroy = false
  }
}

removed {
  from = oystehr_fhir_resource.list-in-house-lab-set-upper-respiratory-example

  lifecycle {
    destroy = false
  }
}
