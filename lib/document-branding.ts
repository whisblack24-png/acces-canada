import QRCode from "qrcode";
import { formatDateFr } from "./format.ts";
import { brand } from "./site.ts";
import { directorSignatureHeight, directorSignatureRuns, directorSignatureWidth } from "./signature-director-data.ts";

export const PDF_NAVY = "0.051 0.106 0.165";
export const PDF_GOLD = "0.831 0.686 0.216";
export const PDF_RED = "0.816 0 0";
export const PDF_INK = "0.105 0.133 0.170";
export const PDF_MUTED = "0.390 0.425 0.470";

export type DocumentBrandMetadata = {
  documentNumber: string;
  verificationToken?: string | null;
  authenticityHash?: string | null;
  version?: number;
  status?: "active" | "replaced" | "deleted" | "cancelled";
  createdAt?: string | null;
  digitallySigned?: boolean;
};
export type SignatureVector = { width:number; height:number; runs:ReadonlyArray<readonly [number,number,number]> };
export type DocumentSignatureConfig = { director?:{enabled:boolean;vector?:SignatureVector|null}; counsel?:{enabled:boolean;vector?:SignatureVector|null} };

export function pdfEscape(value: unknown) {
  return String(value ?? "").normalize("NFC").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
export function pdfText(value:string,x:number,y:number,size=9,font="F1",color=PDF_INK){return `BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${pdfEscape(value)}) Tj ET\n`;}
export function pdfRect(x:number,y:number,w:number,h:number,color:string){return `q ${color} rg ${x} ${y} ${w} ${h} re f Q\n`;}
export function pdfLine(x1:number,y1:number,x2:number,y2:number,color=PDF_GOLD,width=1){return `q ${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q\n`;}
function pdfCircle(cx:number,cy:number,r:number,color:string,fill=false,width=1){const k=r*.55228475;const path=`${cx+r} ${cy} m ${cx+r} ${cy+k} ${cx+k} ${cy+r} ${cx} ${cy+r} c ${cx-k} ${cy+r} ${cx-r} ${cy+k} ${cx-r} ${cy} c ${cx-r} ${cy-k} ${cx-k} ${cy-r} ${cx} ${cy-r} c ${cx+k} ${cy-r} ${cx+r} ${cy-k} ${cx+r} ${cy} c`;return fill?`q ${color} rg ${path} f Q\n`:`q ${color} RG ${width} w ${path} S Q\n`;}
export function documentDate(value?:string|null){return formatDateFr(value || new Date());}
export function verificationUrl(token?:string|null){const base=(process.env.NEXT_PUBLIC_SITE_URL||process.env.APP_URL||"https://acces-canada.vercel.app").replace(/\/$/,"");return token?`${base}/document/verifier/${encodeURIComponent(token)}`:`${base}/document/verifier`;}

export function qrCodeCommands(value:string,x:number,y:number,size:number){const qr=QRCode.create(value,{errorCorrectionLevel:"Q"}),count=qr.modules.size,quiet=4,cell=size/(count+quiet*2);let out=pdfRect(x,y,size,size,"1 1 1");for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.modules.get(row,col))out+=pdfRect(x+(col+quiet)*cell,y+size-(row+quiet+1)*cell,cell+.04,cell+.04,PDF_NAVY);return out;}

export function watermarkCommands(pageWidth=612,pageHeight=792){const cx=pageWidth/2,cy=pageHeight/2;return [
  pdfCircle(cx,cy,128,"0.955 0.960 0.968",true),
  pdfCircle(cx,cy,102,"0.982 0.976 0.945",true),
  pdfText("AC",cx-76,cy-30,78,"F2","0.885 0.895 0.910"),
].join("");
}

// The fourth argument remains for compatibility with existing document templates.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function officialSealCommands(x:number,y:number,size:number,_digitallySigned=false){const c=size/2;let out=pdfCircle(x+c,y+c,c-3,"1 1 1",true);out+=pdfCircle(x+c,y+c,c-3,PDF_GOLD,false,3);out+=pdfCircle(x+c,y+c,c-11,PDF_NAVY,false,3);out+=pdfCircle(x+c,y+c,c-23,PDF_GOLD,false,1.3);out+=pdfText("ACCÈS CANADA",x+size*.19,y+size*.76,size*.065,"F2",PDF_NAVY);out+=pdfText("AC",x+size*.31,y+size*.38,size*.22,"F2",PDF_NAVY);out+=pdfText("DOCUMENT OFFICIEL",x+size*.16,y+size*.15,size*.048,"F2",PDF_GOLD);out+=pdfText("*",x+size*.47,y+size*.60,size*.13,"F2",PDF_RED);return out;}

function vectorSignatureCommands(vector:SignatureVector,x:number,y:number,width:number){const scale=width/vector.width;return vector.runs.map(([rx,ry,rw])=>pdfRect(x+rx*scale,y+(vector.height-ry-1)*scale,Math.max(rw*scale,.2),Math.max(scale,.2),PDF_NAVY)).join("");}
const builtInDirector:SignatureVector={width:directorSignatureWidth,height:directorSignatureHeight,runs:directorSignatureRuns};
export function companySignatureCommands(kind:"director"|"counsel",x:number,y:number,width=190,config?:DocumentSignatureConfig){const director=kind==="director",setting=director?config?.director:config?.counsel;const vector=setting?.vector||(director&&setting?.enabled!==false?builtInDirector:null);const mark=setting?.enabled!==false&&vector?vectorSignatureCommands(vector,x,y+28,width):pdfLine(x,y+45,x+width,y+45,"0.70 0.72 0.75",.8);return mark+pdfText(director?"Christian Nkuli Mboyo":"Me Régine Sifa Buledi",x,y+20,9,"F2",PDF_NAVY)+pdfText(director?"Directeur général":"Conseillère juridique",x,y+7,7.5,"F1",PDF_MUTED)+pdfText("Accès Canada",x,y-5,7.5,"F1",PDF_MUTED);}
export function clientSignaturePlaceholder(x:number,y:number,width=190){return pdfLine(x,y+38,x+width,y+38,"0.70 0.72 0.75",.8)+pdfText("Signature du client",x,y+20,8,"F2",PDF_NAVY)+pdfText("Date : __________________",x,y+6,7.5,"F1",PDF_MUTED);}

export function digitalSignatureCertificateCommands(meta:DocumentBrandMetadata,x:number,y:number,width=540){
  const fingerprint=(meta.authenticityHash||"Empreinte générée lors de l'enregistrement").toUpperCase();
  const first=fingerprint.slice(0,32);
  const second=fingerprint.slice(32,64);
  return [
    pdfRect(x,y,width,54,"0.955 0.965 0.975"),
    pdfRect(x,y,width,3,PDF_GOLD),
    pdfText("VÉRIFICATION DU DOCUMENT",x+12,y+37,8,"F2",PDF_NAVY),
    pdfText(`Empreinte SHA-256 : ${first}`,x+12,y+21,6.5,"F1",PDF_MUTED),
    second?pdfText(second,x+105,y+9,6.5,"F1",PDF_MUTED):"",
  ].join("");
}

export function premiumFooterCommands(meta:DocumentBrandMetadata,page:number,total:number,pageWidth=612){const url=verificationUrl(meta.verificationToken);return [pdfLine(32,64,pageWidth-32,64,PDF_GOLD,1),pdfText("AC",32,39,12,"F2",PDF_GOLD),pdfText(`${brand.phone}  |  ${brand.email}`,58,42,7.5,"F1",PDF_MUTED),pdfText(meta.documentNumber,58,30,7,"F2",PDF_NAVY),pdfText("Document confidentiel - Acces Canada",238,30,6.5,"F1",PDF_MUTED),pdfText(`Page ${page} sur ${total}`,pageWidth-150,36,7.5,"F2",PDF_NAVY),meta.verificationToken?qrCodeCommands(url,pageWidth-78,6,54):""].join("");}

export class BrandedPdfBuilder {
  private pages:string[]=[];
  addPage(commands:string){this.pages.push(commands);}
  finish(){const header=Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n","latin1"),objects:Buffer[]=[];const offsets:number[]=[0];let cursor=header.length;const add=(id:number,body:string|Buffer)=>{offsets[id]=cursor;const h=Buffer.from(`${id} 0 obj\n`,"latin1"),b=Buffer.isBuffer(body)?body:Buffer.from(body,"latin1"),t=Buffer.from("\nendobj\n","latin1");objects.push(h,b,t);cursor+=h.length+b.length+t.length;};const pageIds=this.pages.map((_,i)=>5+i*2);add(1,"<< /Type /Catalog /Pages 2 0 R >>");add(2,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);add(3,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");add(4,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");this.pages.forEach((content,i)=>{const p=pageIds[i],s=p+1,data=Buffer.from(content,"latin1");add(p,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${s} 0 R >>`);add(s,Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`,"latin1"),data,Buffer.from("\nendstream","latin1")]));});const size=5+this.pages.length*2,xref=cursor,trailer=[`xref\n0 ${size}\n0000000000 65535 f \n`,...Array.from({length:size-1},(_,i)=>`${String(offsets[i+1]).padStart(10,"0")} 00000 n \n`),`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`].join("");return Buffer.concat([header,...objects,Buffer.from(trailer,"latin1")]);}
}
