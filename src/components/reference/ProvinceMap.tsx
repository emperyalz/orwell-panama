import maps from '@/data/province-maps.json';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function ProvinceMap({name}:{name:string}){
 const canonical=name.replace(/Guna Yala/i,'Kuna Yala');
 const map=maps.find(m=>normalize(m.name)===normalize(canonical));
 if(!map)return null;
 return <svg className="province-map" viewBox={map.viewBox} role="img" aria-label={`Mapa de ${name}`}><path d={map.path} fill="currentColor" fillRule="evenodd"/></svg>;
}
