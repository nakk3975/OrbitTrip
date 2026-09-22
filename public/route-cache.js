const routes=new Map();
export const routeKey=(a,b,mode)=>`${mode}:${a.lat.toFixed(6)},${a.lng.toFixed(6)}:${b.lat.toFixed(6)},${b.lng.toFixed(6)}`;
export function rememberRoute(a,b,mode,route){routes.set(routeKey(a,b,mode),{route,until:Date.now()+3600000});if(routes.size>500)routes.delete(routes.keys().next().value);}
export function knownRoute(a,b,mode){if(!a||!b)return null;const entry=routes.get(routeKey(a,b,mode));return entry?.until>Date.now()?entry.route:null;}
