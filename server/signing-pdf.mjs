import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export async function placeholderPage(title) {
  const pdf=await PDFDocument.create(),page=pdf.addPage([612,792]);
  const serif=await pdf.embedFont(StandardFonts.TimesRoman),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({x:0,y:0,width:612,height:792,color:rgb(.97,.95,.89)});
  page.drawRectangle({x:48,y:48,width:516,height:696,borderColor:rgb(.65,.51,.25),borderWidth:2});
  page.drawText('HFJ BALLARD',{x:96,y:680,size:14,font:bold,color:rgb(.25,.3,.24)});
  let size=32;while(serif.widthOfTextAtSize(title,size)>420&&size>12)size--;
  page.drawText(title,{x:96,y:610,size,font:serif,color:rgb(.15,.2,.16)});
  page.drawText('A page for a fellow reader',{x:96,y:550,size:20,font:serif});
  page.drawText('For:',{x:96,y:440,size:13,font:bold});
  page.drawText('SIGNATURE PLACEHOLDER',{x:96,y:300,size:16,font:bold,color:rgb(.48,.39,.2)});
  page.drawText('This is a test page, not an autograph.',{x:96,y:270,size:13,font:serif});
  page.drawText('The author will replace this page with a signed edition.',{x:96,y:245,size:12,font:serif});
  page.drawText('The complete purchased book follows this page.',{x:96,y:150,size:12,font:serif});
  return pdf.save();
}
export async function prependSigningPage(bookBytes,pageBytes,{name='',personalization}={}) {
  const original=await PDFDocument.load(bookBytes),title=await PDFDocument.load(pageBytes),pdf=original;
  const titlePages=await pdf.copyPages(title,title.getPageIndices());titlePages.forEach((p,i)=>pdf.insertPage(i,p));
  if(name&&personalization) {
    const font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.getPage(personalization.page||0);
    let size=personalization.size||18;
    try {while(font.widthOfTextAtSize(name,size)>page.getWidth()-personalization.x-60&&size>8)size--;}
    catch {throw Object.assign(new Error('This signing template supports Latin characters. Try another name or leave it blank.'),{status:400});}
    page.drawText(name,{x:personalization.x,y:personalization.y,size,font,color:rgb(.15,.2,.16)});
  }
  pdf.setTitle(original.getTitle()||'Personal library edition');
  pdf.setAuthor(original.getAuthor()||'HFJ Ballard');
  return pdf.save();
}
