import {normalizePartyCode} from './constants';

/** Contrast-aware foreground for a sourced party colour (WCAG relative luminance). */
export function foregroundFor(hex: string): string {
 const rgb = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255) : [0.2,0.2,0.2];
 const linear=rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 const luminance=linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
 return (luminance+0.05)/0.05 >= 1.05/(luminance+0.05) ? '#101010' : '#ffffff';
}
export function profileTheme(code:string,party?:{color:string;secondaryColor?:string}|null){
 const pan=normalizePartyCode(code)==='PAN';
 const primary=pan?'#59348b':party?.color||'#52525b';
 const secondary=pan?'#fdc80c':party?.secondaryColor||primary;
 return {primary,secondary,accentInk:foregroundFor(primary)==='#101010'?'#28232e':primary,ink:pan?'#fff1a4':foregroundFor(primary),secondaryInk:foregroundFor(secondary)};
}
// Presentation-only line breaks; preserve every character of the public display name.
const givenNames=['José Luis','José Raúl','Luis Eduardo','Luis Omar','Miguel A.','Stefany Dayan',"Omaira 'Mayín'"];
export function profileName(name:string){
 const given=givenNames.find(n=>name.startsWith(n+' '))||name.split(' ')[0];
 return {given,surname:name.slice(given.length).trim()||given};
}
