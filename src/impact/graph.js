export function buildImpactGraph(company,event,exposure) {
  if(!exposure||!event)return {nodes:[],edges:[]};
  const row=exposure.rows[0], location=row.location;
  const nodes=[{id:event.id,type:'event',label:event.title,evidence:event.evidenceType||'observation',sourceUrl:event.sourceUrl,latitude:event.latitude,longitude:event.longitude},
    {id:location.id,type:location.type,label:location.name,evidence:'proximity inference',sourceUrl:location.sourceUrl,latitude:location.latitude,longitude:location.longitude}];
  if(row.supplier)nodes.push({id:`supplier:${row.supplier.id}`,type:'supplier',label:row.supplier.name,evidence:'documented relationship; allocation unknown',sourceUrl:row.supplier.sourceUrl});
  nodes.push({id:`company:${company.ticker}`,type:'company',label:company.name,evidence:'potential exposure, not confirmed loss'});
  const edges=nodes.slice(1).map((node,i)=>({from:nodes[i].id,to:node.id,type:i===0?'near':node.type==='supplier'?'operated_by':row.supplier?'supplies':'owned_by',confidence:exposure.confidence}));
  return {nodes,edges,potentialImpact:row.dependency?.potentialImpact||'Operational consequences are unconfirmed.'};
}
