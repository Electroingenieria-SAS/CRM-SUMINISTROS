

export const state={
  tab:"records",
  search:"",
  source:"ALL",
  status:"ALL",
  orderType:"ALL",
  route:"ALL",
  city:"",
  from:"",
  to:"",
  page:1,
  pageSize:50,
  data:null,
  batches:[],
  root:null
};

export function filtersPayload(extra={}){
  return {
    search:state.search||null,source:state.source,status:state.status,orderType:state.orderType,route:state.route,city:state.city||null,
    from:state.from||null,to:state.to||null,page:state.page,pageSize:state.pageSize,...extra
  };
}
