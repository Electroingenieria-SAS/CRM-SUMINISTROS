

export function sourceKey(row){return [row.reference,row.warehouse,row.location,row.lot,row.ext1||"",row.ext2||""].join("|")}
