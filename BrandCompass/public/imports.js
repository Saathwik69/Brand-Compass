export async function extractDocument(file){
  if(file.size>5*1024*1024)throw new Error('Choose a document smaller than 5 MB.');
  const name=file.name.toLowerCase();
  if(/\.(txt|md)$/.test(name)){const text=await file.text();if(text.length>16000)throw new Error('Document exceeds 16,000 characters. Import a shorter excerpt.');return text;}
  if(name.endsWith('.pdf')){
    const pdfjs=await import('/vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;
    try{if(pdf.numPages>25)throw new Error('Choose a PDF with 25 pages or fewer.');
      let text='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();text+=content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('')+'\n\n';if(text.length>16000)throw new Error('Document exceeds 16,000 characters. Import a shorter excerpt.');}
      if(!text.trim())throw new Error('No selectable text found. Scanned PDFs need OCR; paste their text to continue.');return text.trim();
    }finally{await pdf.destroy();}
  }
  if(name.endsWith('.docx')){
    const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
    if(end<0)throw new Error('This file is not a supported DOCX archive.');
    let p=view.getUint32(end+16,true);const count=view.getUint16(end+10,true);let xml;
    for(let n=0;n<count;n++){
      if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw new Error('Invalid DOCX directory.');
      const compression=view.getUint16(p+10,true),size=view.getUint32(p+20,true),plainSize=view.getUint32(p+24,true),nameLen=view.getUint16(p+28,true),extraLen=view.getUint16(p+30,true),commentLen=view.getUint16(p+32,true),offset=view.getUint32(p+42,true);
      const entry=new TextDecoder().decode(bytes.slice(p+46,p+46+nameLen));
      if(entry==='word/document.xml'){
        if(plainSize>2*1024*1024||offset+30>bytes.length)throw new Error('DOCX content exceeds the supported size.');
        const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+size>bytes.length)throw new Error('Truncated DOCX.');
        const payload=bytes.slice(start,start+size);
        if(compression===0)xml=new TextDecoder().decode(payload);
        else if(compression===8){const reader=new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();let length=0,chunks=[];while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2*1024*1024){await reader.cancel();throw new Error('DOCX expands beyond the supported size.');}chunks.push(value);}xml=await new Blob(chunks).text();}
        else throw new Error('Unsupported DOCX compression.');break;
      }
      p+=46+nameLen+extraLen+commentLen;
    }
    if(!xml)throw new Error('Document text could not be found.');
    const dom=new DOMParser().parseFromString(xml,'application/xml');if(dom.querySelector('parsererror'))throw new Error('Invalid document XML.');
    const text=[...dom.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')).join('\n');
    if(text.length>16000)throw new Error('Document exceeds 16,000 characters. Import a shorter excerpt.');if(!text.trim())throw new Error('No document text found.');return text;
  }
  throw new Error('Upload TXT, MD, PDF or DOCX.');
}
export async function inspectImage(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Use PNG, JPEG or WebP, up to 5 MB.');
  const bytes=await file.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>25000000){bitmap.close();throw new Error('Choose an image under 25 megapixels.');}
  const canvas=document.createElement('canvas'),scale=Math.min(1,600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,bins=new Map();for(let i=0;i<data.length;i+=64){const hex='#'+[data[i],data[i+1],data[i+2]].map(x=>(Math.round(x/32)*32>255?255:Math.round(x/32)*32).toString(16).padStart(2,'0')).join('');bins.set(hex,(bins.get(hex)||0)+1);}
  const colors=[...bins].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);
  const result={name:file.name,width:bitmap.width,height:bitmap.height,sha256:hash,colors,thumbnail:canvas.toDataURL('image/jpeg',.65),kind:'graphic',decorative:false};bitmap.close();return result;
}
