export enum ErrorCodes {
  // 10 000: General
  unexpected = 10_001,
  reload = 10_002,
  unauthorized = 10_003,
  timedOut = 10_004,
  notFound = 10_005,
  duplicate = 10_006,
  unauthorizedByThirdParty = 10_007,
  // 11 000: Failed action
  couldNotJoin = 11_001,
  couldNotCreate = 11_002,
  couldNotUpdate = 11_003,
  couldNotDelete = 11_004,
  couldNotSync = 11_005,
  // 20 000: Validation - must match
  mustBeNotEmpty = 20_001,
  mustBeString = 20_002,
  mustBeLetters = 20_003,
  mustBeNumber = 20_004,
  mustBeAlphanumeric = 20_005,
  mustBeAlphanumericWithSpaces = 20_006,
  mustBePhone = 20_007,
  mustBeEmail = 20_008,
  mustBeUuid = 20_009,
  mustBeDate = 20_010,

  mustMatchList = 20_101,
  mustPassPasswordChecks = 20_102,
  // 21 0000: Validation - missing
  missingRequired = 21_001,
  missingProperties = 21_002,
}
