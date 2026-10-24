import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {placeholderPage,replaceSigningPage} from '../server/signing-pdf.mjs';
async function fixtures(){
  const book=await PDFDocument.create();book.setTitle('Purchased original');book.setAuthor('HFJ Ballard');
  for(const [w,h] of [[300,450],[300,450],[320,480]])book.addPage([w,h]);
  const title=await PDFDocument.create();title.addPage([300,450]);
  return {book:await book.save(),title:await title.save()};
}
test('only physical page two changes: cover, later pages, count and metadata survive',async()=>{
  const f=await fixtures(),before=await PDFDocument.load(f.book),pdf=await PDFDocument.load(await replaceSigningPage(f.book,f.title));
  assert.equal(pdf.getPageCount(),3);assert.equal(pdf.getTitle(),'Purchased original');assert.equal(pdf.getAuthor(),'HFJ Ballard');
  assert.deepEqual(pdf.getPage(0).getSize(),before.getPage(0).getSize());assert.equal(pdf.getPage(2).getWidth(),320);
  assert.equal(pdf.getPage(0).ref.toString(),before.getPage(0).ref.toString());assert.equal(pdf.getPage(2).ref.toString(),before.getPage(2).ref.toString());
  assert.notEqual(pdf.getPage(1).ref.toString(),before.getPage(1).ref.toString());
  assert.equal((await PDFDocument.load(f.book)).getPageCount(),3);
});
test('personalization always goes on the replacement, even with an older page:0 setting',async()=>{
  const f=await fixtures();
  const pdf=await PDFDocument.load(await replaceSigningPage(f.book,f.title,{name:'Avery',personalization:{page:0,x:40,y:220,width:220,height:80,size:18,text:'For {name},\nEnjoy the adventure.',align:'center'}}));
  assert.equal(pdf.getPage(0).node.Contents(),undefined);assert.notEqual(pdf.getPage(1).node.Contents(),undefined);assert.equal(pdf.getPage(2).node.Contents(),undefined);
});
test('long names wrap or shrink; an impossible layout fails without clipping',async()=>{
  const f=await fixtures();await replaceSigningPage(f.book,f.title,{name:'A reader with a long name',personalization:{x:30,y:260,width:90,height:120,size:20,minSize:10}});
  await assert.rejects(replaceSigningPage(f.book,f.title,{name:'A reader with a long name',personalization:{x:30,y:20,width:5,height:5,size:18}}),{status:400});
});
test('rejects invalid books, multi-page templates and invalid coordinates',async()=>{
  const f=await fixtures(),single=await PDFDocument.create();single.addPage();
  await assert.rejects(replaceSigningPage(await single.save(),f.title),{status:409});
  await assert.rejects(replaceSigningPage(f.book,f.book),{status:409});
  await assert.rejects(replaceSigningPage(f.book,f.title,{name:'Reader',personalization:{x:290,y:200,width:100}}),{status:409});
});
test('standard fonts reject missing glyphs with a clear error',async()=>{
  const f=await fixtures();await assert.rejects(replaceSigningPage(f.book,f.title,{name:'読者',personalization:{x:30,y:200}}),{status:400});
});
test('a supplied custom TTF embeds and supports names outside the standard font character set',async t=>{
  if(!process.env.SIGNING_TEST_FONT){t.skip('Set SIGNING_TEST_FONT to an available TTF or OTF.');return}
  const fontBytes=await readFile(process.env.SIGNING_TEST_FONT),f=await fixtures();
  const pdf=await PDFDocument.load(await replaceSigningPage(f.book,f.title,{name:'Алексей',fontBytes,personalization:{fontPath:'fonts/test.ttf',x:30,y:220,width:240,height:100,text:'For {name}',size:20}}));
  assert.equal(pdf.getPageCount(),3);assert.ok(pdf.getPage(1).node.Resources());
});
test('placeholder is a single clearly labeled title page',async()=>{
  assert.equal((await PDFDocument.load(await placeholderPage('Monster'))).getPageCount(),1);
});
