import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const fail=(message,status=409)=>Object.assign(new Error(message),{status});
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
  page.drawText('The author will replace this page with a signed title page.',{x:96,y:245,size:11,font:serif});
  page.drawText('Your cover remains first; this replaces the original title page.',{x:96,y:150,size:11,font:serif});
  return pdf.save();
}

function wrap(text,font,size,width){
  const result=[];
  for(const paragraph of text.split('\n')){
    let line='';
    for(const word of paragraph.split(/ +/).filter(Boolean)){
      const combined=line?line+' '+word:word;
      if(font.widthOfTextAtSize(combined,size)<=width){line=combined;continue}
      if(line){result.push(line);line=''}
      for(const char of word){
        if(font.widthOfTextAtSize(line+char,size)>width){if(!line)return null;result.push(line);line=''}
        line+=char;
      }
    }
    result.push(line);
  }
  return result;
}

async function personalize(pdf,page,name,spec,fontBytes){
  let font;
  if(fontBytes){pdf.registerFontkit(fontkit);font=await pdf.embedFont(fontBytes,{subset:true})}
  else {
    if(spec.fontPath)throw fail('The personalization font could not be loaded.');
    const choice=spec.font||'Helvetica';
    if(!Object.hasOwn(StandardFonts,choice))throw fail('Choose a supported standard font or upload a TTF/OTF font.');
    font=await pdf.embedFont(StandardFonts[choice]);
  }
  const pattern=spec.text??'{name}';
  if(typeof pattern!=='string'||pattern.length>1000)throw fail('The personalization text template is invalid.');
  const text=pattern.replaceAll('{name}',name).replace(/\r\n?/g,'\n').normalize('NFC');
  const supported=new Set(font.getCharacterSet());
  if(Array.from(text).some(char=>char!=='\n'&&!supported.has(char.codePointAt(0))))
    throw fail('The selected font does not contain one of these characters. Try another name or contact the author.',400);
  const {x,y}=spec,width=spec.width??page.getWidth()-x-60,height=spec.height??90;
  const startSize=spec.size??18,minSize=spec.minSize??8,lineHeight=spec.lineHeight??1.35,align=spec.align??'left';
  if(![x,y,width,height,startSize,minSize,lineHeight].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||
     x+width>page.getWidth()||startSize<8||startSize>100||minSize<8||minSize>startSize||lineHeight<1||lineHeight>3||
     !['left','center','right'].includes(align))throw fail('The personalization placement settings need adjusting.');
  const hex=spec.color??'#263327';
  if(!/^#[0-9a-f]{6}$/i.test(hex))throw fail('Use a six-digit hex color for personalization.');
  const color=rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));
  for(let size=startSize;size>=minSize;size--){
    const lines=wrap(text,font,size,width);if(!lines)continue;
    const step=size*lineHeight,ascent=font.heightAtSize(size,{descender:false});
    const descent=font.heightAtSize(size)-ascent;
    const lower=y-(lines.length-1)*step-descent;
    if(y+ascent>page.getHeight()||lower<0||(lines.length-1)*step+ascent+descent>height)continue;
    lines.forEach((line,i)=>{
      const measured=font.widthOfTextAtSize(line,size),offset=align==='center'?(width-measured)/2:align==='right'?width-measured:0;
      page.drawText(line,{x:x+offset,y:y-i*step,size,font,color});
    });
    return;
  }
  throw fail('This dedication does not fit the prepared space. Try a shorter name or contact the author.',400);
}

export async function validateSigningTemplate(pageBytes,{name='',personalization,fontBytes}={}) {
  const title=await PDFDocument.load(pageBytes);
  if(title.getPageCount()!==1)throw fail('Upload a signing template containing exactly one title page.');
  if(name&&personalization)await personalize(title,title.getPage(0),name,personalization,fontBytes);
}

export async function replaceSigningPage(bookBytes,pageBytes,{name='',personalization,fontBytes}={}) {
  const original=await PDFDocument.load(bookBytes),title=await PDFDocument.load(pageBytes);
  if(original.getPageCount()<2)throw fail('This book needs a cover and a second-page title page before it can be signed.');
  if(title.getPageCount()!==1)throw fail('Upload a signing template containing exactly one title page.');
  const [replacement]=await original.copyPages(title,[0]);
  original.removePage(1);original.insertPage(1,replacement);
  // Coordinates always refer to the replacement title page, never the cover.
  if(name&&personalization)await personalize(original,replacement,name,personalization,fontBytes);
  original.setTitle(original.getTitle()||'Personal library edition');
  original.setAuthor(original.getAuthor()||'HFJ Ballard');
  return original.save();
}
