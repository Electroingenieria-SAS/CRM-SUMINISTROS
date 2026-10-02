

export function pdfFiles(files){return files.filter(isPdf)}

export function isPdf(file){return /pdf/i.test(file.mime_type||"")||/\.pdf$/i.test(file.file_name||"")}

export function formatBytes(value){const bytes=Number(value||0);if(!bytes)return "Tamaño no informado";if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`}
