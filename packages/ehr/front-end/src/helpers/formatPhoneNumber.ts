export function formatPhoneNumber(phoneNumber: string | undefined): string | undefined {
  // input format:  phoneNumber: string =>  XXXXXXXXXX
  // output format: (XXX) XXX-XXXX
  if (!phoneNumber) {
    return phoneNumber;
  }
  return '(' + phoneNumber.slice(0, 3) + ') ' + phoneNumber.slice(3, 6) + '-' + phoneNumber.slice(6);
}
