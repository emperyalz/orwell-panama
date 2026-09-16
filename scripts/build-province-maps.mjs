import {readFileSync} from 'node:fs';
// Source: IGN Tommy Guardia province layer, simplified by ArcGIS.
const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
const groups=new Map();
for(const f of data.features){const name=f.properties.nomb_prov;groups.set(name,[...(groups.get(name)||[]),...(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates])]);}
const maps=[...groups].map(([name,polygons])=>{
 const points=polygons.flat(2);const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxY=Math.max(...ys);const width=Math.max(...xs)-minX,height=maxY-Math.min(...ys);const scale=100/Math.max(width,height);
 const path=polygons.map(p=>p.map(ring=>ring.map(([x,y],i)=>`${i?'L':'M'}${((x-minX)*scale+2).toFixed(2)},${((maxY-y)*scale+2).toFixed(2)}`).join('')+'Z').join('')).join('');
 return {name,viewBox:`0 0 ${width*scale+4} ${height*scale+4}`,path};
});
console.log(JSON.stringify(maps));
