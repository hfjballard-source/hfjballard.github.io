export function applySignedEditions(items, signedRecords, mapping) {
  return items.map(item => {
    const spec=mapping[item.sku],shared=Array.isArray(spec)&&spec.length>0;
    const template=spec&&!Array.isArray(spec)&&(spec.placeholder===true||typeof spec.signaturePage==='string')&&item.files.some(f=>f.path.toLowerCase().endsWith('.pdf'));
    const record=signedRecords instanceof Set?(signedRecords.has(item.sku)?{}:null):signedRecords.get(item.sku);
    const files=shared?spec:template&&record?.template_version===(spec?.version||spec?.signaturePage||'placeholder-v1')&&Array.isArray(record?.files)?record.files:null;
    const signed=!!(record&&files?.length);
    return {...item,signed,signingAvailable:!!(shared||template),signingPreview:!!(template&&spec.placeholder),signedPreview:!!(signed&&record.placeholder),files:signed?files:item.files};
  });
}
