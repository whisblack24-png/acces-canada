import "server-only";

const MIME_BY_EXTENSION:Record<string,string>={
  pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",doc:"application/msword",
  jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",txt:"text/plain; charset=utf-8",csv:"text/csv; charset=utf-8",
  xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function extension(name:string){return name.split(".").pop()?.toLowerCase()||"";}
export function safeDownloadName(name:string){return name.normalize("NFC").replace(/["\r\n\\/]/g,"-").slice(0,240)||"document";}
export function downloadContentType(name:string,stored?:string|null){const ext=extension(name);return MIME_BY_EXTENSION[ext]||stored||"application/octet-stream";}

export function assertDownloadableFile(bytes:Buffer,name:string){
  if(bytes.length<1)throw new Error("Le fichier est vide.");
  const ext=extension(name),latin=bytes.toString("latin1");
  if(ext==="pdf"&&(!latin.startsWith("%PDF-")||!latin.trimEnd().endsWith("%%EOF")))throw new Error("Le fichier PDF est incomplet ou ne contient pas un véritable PDF.");
  if(ext==="docx"&&(bytes[0]!==0x50||bytes[1]!==0x4b||!latin.includes("[Content_Types].xml")||!latin.includes("word/document.xml")||!latin.includes("PK\x05\x06")))throw new Error("Le fichier Word est incomplet ou corrompu.");
  if((ext==="jpg"||ext==="jpeg")&&!(bytes[0]===0xff&&bytes[1]===0xd8))throw new Error("Le contenu ne correspond pas à une image JPEG.");
  if(ext==="png"&&!(bytes[0]===0x89&&bytes.subarray(1,4).toString("ascii")==="PNG"))throw new Error("Le contenu ne correspond pas à une image PNG.");
}

export function downloadHeaders(name:string,storedType?:string|null,disposition:"inline"|"attachment"="attachment"){
  const safe=safeDownloadName(name),encoded=encodeURIComponent(safe).replace(/'/g,"%27");
  return{"Content-Type":downloadContentType(safe,storedType),"Content-Disposition":`${disposition}; filename="${safe.replace(/[^\x20-\x7E]/g,"-")}"; filename*=UTF-8''${encoded}`,"Content-Length":"", "Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
}
