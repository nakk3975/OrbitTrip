import {cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await cp('public','dist',{recursive:true});
await cp('node_modules/leaflet/dist','dist/vendor',{recursive:true});
console.log('Built static OrbitTrip into dist');
