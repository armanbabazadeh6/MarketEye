import { DataLayerManager,layerFeedState } from '../data/manager.js';
// Reuse upstream lifecycle, provider adapters, renderer and tracking code.
// Lazy imports keep the financial workspace fast when these layers are off.
const definitions=[
  {id:'flights',label:'Aircraft',load:()=>import('../data/flights.js')},
  {id:'ais-live-vessels',label:'Ships · AIS key',load:()=>import('../data/aisLiveVessels.js')},
  {id:'satellites',label:'Satellites',load:()=>import('../data/satellites.js')},
  {id:'local-datacenters',label:'Datacenters · OSM snapshot',load:()=>import('../data/localLayers.js')},
  {id:'local-firms',label:'Fires · NASA key',load:()=>import('../data/localLayers.js')},
];
export function attachContextLayers(globe,container){
  const manager=new DataLayerManager(globe.viewer);
  container.innerHTML=definitions.map(d=>`<label class="layer"><input type="checkbox" data-context-layer="${d.id}"/>${d.label}<small id="layer-state-${d.id}"></small></label>`).join('');
  manager.subscribe(()=>{
    for(const layer of manager.getAll()){
      const label=document.getElementById(`layer-state-${layer.id}`);
      if(label){label.textContent=layer.enabled?layerFeedState(layer.stats):'';label.title=layer.stats?.error||layer.stats?.lastError||`${layer.stats?.count??0} records`;}
    }
  });
  container.querySelectorAll('input').forEach(input=>input.onchange=async()=>{
    const definition=definitions.find(d=>d.id===input.dataset.contextLayer),label=document.getElementById(`layer-state-${definition.id}`);
    input.disabled=true;label.textContent='Loading';
    try{
      if(!manager.layers.has(definition.id)){const module=await definition.load();const layer=Array.isArray(module.default)?module.default.find(l=>l.id===definition.id):module.default;manager.register(layer);}
      await manager.setEnabled(definition.id,input.checked,{origin:'user'});input.checked=manager.isEnabled(definition.id);
      const state=manager.getAll().find(l=>l.id===definition.id);label.textContent=input.checked?layerFeedState(state.stats):'Off';
    }catch(error){input.checked=false;label.textContent='Unavailable';label.title=error.message;}
    finally{input.disabled=false;}
  });
  return manager;
}
