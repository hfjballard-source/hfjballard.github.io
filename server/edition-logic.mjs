export function applySignedEditions(items, signedRecords, mapping) {
  return items.map(item => {
    const spec=mapping[item.sku],shared=Array.isArray(spec)&&spec.length>0;
    const template=spec&&!Array.isArray(spec)&&(spec.placeholder===true||typeof spec.signaturePage==='string')&&item.files.some(f=>f.path.toLowerCase().endsWith('.pdf'));
    const record=signedRecords instanceof Set?(signedRecords.has(item.sku)?{}:null):signedRecords.get(item.sku);
    const current=template&&record?.template_version===(spec?.version||spec?.signaturePage||'placeholder-v1');
    const nameRecord=current&&Array.isArray(record?.files)&&record.files.length===1&&record.files[0]?.kind==='on-demand-v1'?record.files[0]:null;
    const onDemand=!!(nameRecord&&/^personalizations\/[a-f0-9]{64}\.txt$/.test(nameRecord.namePath||''));
    const pdfIndex=item.files.findIndex(file=>file.path.toLowerCase().endsWith('.pdf'));
    const files=onDemand?item.files.map((file,index)=>index===pdfIndex?{...file,label:spec.label||(spec.placeholder?'Personalized PDF preview':'Signed PDF'),namePath:nameRecord.namePath,onDemand:true}:file):shared?spec:current&&Array.isArray(record?.files)&&!nameRecord?record.files:null;
    const signed=!!(record&&files?.length);
    return {...item,signed,onDemand,canResign:!!(signed&&template&&!onDemand),signingAvailable:!!(shared||template),signingPreview:!!(template&&spec.placeholder),signedPreview:!!(signed&&record.placeholder),files:signed?files:item.files};
  });
}
