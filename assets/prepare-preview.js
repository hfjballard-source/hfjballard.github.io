import {PDFDocument} from '/assets/vendor/pdf-lib-preview.mjs';
import {getDocument,GlobalWorkerOptions} from '/assets/vendor/pdfjs-6.4.299/pdf.min.mjs';
GlobalWorkerOptions.workerSrc='/assets/vendor/pdfjs-6.4.299/pdf.worker.min.mjs';
const button=document.querySelector('#prepare'),message=document.querySelector('#status'),result=document.querySelector('#result');let blobURL;
addEventListener('pagehide',()=>{if(blobURL)URL.revokeObjectURL(blobURL)});
button.onclick=async()=>{
 const file=document.querySelector('#file').files[0];if(!file){message.textContent='Choose the original PDF first.';return;}
 if(file.size>150*1024*1024){message.textContent='Please choose a PDF smaller than 150 MB.';return;}
 button.disabled=true;result.replaceChildren();if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}
 let task;
 try{
  task=getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,standardFontDataUrl:'/assets/vendor/pdfjs-6.4.299/standard_fonts/',wasmUrl:'/assets/vendor/pdfjs-6.4.299/wasm/',iccUrl:'/assets/vendor/pdfjs-6.4.299/iccs/'});
  const source=await task.promise,sample=await PDFDocument.create(),count=Math.min(15,source.numPages);
  for(let i=1;i<=count;i++){
   message.textContent='Preparing page '+i+' of '+count+' on this computer…';
   const page=await source.getPage(i),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:2});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
   const jpg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!jpg)throw new Error('Image could not be prepared');
   const image=await sample.embedJpg(await jpg.arrayBuffer());sample.addPage([base.width,base.height]).drawImage(image,{x:0,y:0,width:base.width,height:base.height});
   canvas.width=canvas.height=1;page.cleanup();
  }
  const selection=document.querySelector('#book');sample.setTitle(selection.selectedOptions[0].textContent+' — preview');sample.setAuthor('HFJ Ballard');
  blobURL=URL.createObjectURL(new Blob([await sample.save()],{type:'application/pdf'}));
  const link=document.createElement('a');link.href=blobURL;link.download=selection.value+'-preview.pdf';link.textContent='Save '+count+'-page preview';result.append(link);message.textContent='Ready. Save the sample, then upload it to GitHub.';
 }catch(error){message.textContent='The sample could not be prepared. Use an unlocked original PDF and try again.';}
 finally{await task?.destroy().catch(()=>{});button.disabled=false;}
};
