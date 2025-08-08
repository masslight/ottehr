import * as branding from './branding';
import * as sg from './sendgrid';

console.log('SendGrid config:', JSON.stringify(sg.default));
console.log('Branding config:', JSON.stringify(branding.default));

export const OVERRIDES = {
  sendgrid: sg.default || {},
  branding: branding.default || {},
};
