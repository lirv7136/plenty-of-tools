(() => {
  'use strict';
  const C = window.GPXCore, $ = id => document.getElementById(id);
  let activities = [], route = [], undo = [], redo = [], drawing = false, importing = false;
  const clone = value => JSON.parse(JSON.stringify(value));
  const metres = value => value < 1000 ? `${Math.round(value)} m` : `${(value/1000).toFixed(2)} km`;
  function status(message) { $('gp-status').textContent = message; }
  function error(message = '') { $('gp-error').hidden = !message; $('gp-error').textContent = message; }
  const map = L.map('gp-map', {preferCanvas:true, minZoom:2, maxZoom:19, attributionControl:true}).setView([-33.86,151.21],13);
  const Grid = L.GridLayer.extend({createTile(coords) {
    const tile = document.createElement('canvas'); tile.width = tile.height = 256;
    const ctx = tile.getContext('2d'); ctx.fillStyle = '#edf2ed'; ctx.fillRect(0,0,256,256);
    ctx.strokeStyle = '#d5dfd6'; ctx.lineWidth = 1; ctx.strokeRect(.5,.5,255,255);
    ctx.strokeStyle = '#e0e7e0'; ctx.beginPath(); ctx.moveTo(128,0);ctx.lineTo(128,256);ctx.moveTo(0,128);ctx.lineTo(256,128);ctx.stroke();
    const loc = map.unproject([coords.x*256,coords.y*256],coords.z).wrap();
    ctx.fillStyle = '#738376'; ctx.font = '11px system-ui'; ctx.fillText(`${loc.lat.toFixed(3)}°, ${loc.lng.toFixed(3)}°`,10,20);
    return tile;
  }});
  new Grid().addTo(map);
  const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'});
  let tileErrorReported = false;
  streets.on('tileerror', () => { if (!tileErrorReported && $('gp-streets').checked) { tileErrorReported = true; status('Street tiles could not load. The coordinate grid and your tracks still work.'); } });
  const tracks = L.layerGroup().addTo(map), editor = L.layerGroup().addTo(map);
  const heat = L.heatLayer([], {radius:22,blur:18,maxZoom:15,minOpacity:.25}).addTo(map);
  const handle = L.divIcon({className:'gp-handle',iconSize:[12,12],iconAnchor:[6,6]});
  function anchor() { return route[0]?.[0]?.lon ?? activities.find(a=>a.visible)?.segments[0]?.[0]?.lon ?? 151.21; }
  function selectedSegments() { return activities.filter(a=>a.visible).flatMap(a=>a.segments); }
  function allCoordinates() { const a = anchor(); return [...selectedSegments(),...route].flatMap(s=>C.unwrap(s,a)); }
  function fit() { const points = allCoordinates(); if (points.length) map.fitBounds(L.latLngBounds(points),{padding:[35,35],maxZoom:16}); }
  function commit(next) { undo.push(clone(route)); if (undo.length > 80) undo.shift(); redo = []; route = next; error(); renderRoute(); }
  function renderRoute() {
    editor.clearLayers(); const a = anchor(), n = C.count(route);
    route.forEach((segment, si) => {
      const coords = C.unwrap(segment,a); L.polyline(coords,{color:'#0b7a5a',weight:4,opacity:1}).addTo(editor);
      coords.forEach((p,pi) => {
        const marker = L.marker(p,{icon:handle,draggable:true,title:`Route point ${si+1}.${pi+1}`,autoPan:true}).addTo(editor);
        marker.on('dragend', () => {
          try {
            const pos = marker.getLatLng().wrap(), next = clone(route);
            // Moving a point invalidates any imported elevation at that position.
            next[si][pi] = C.point(pos.lat,pos.lng); commit(next);
          } catch(e) { error(e.message); renderRoute(); }
        });
      });
    });
    $('gp-distance').textContent = metres(C.length(route));
    $('gp-points').textContent = `${n} points${route.length > 1 ? ` · ${route.length} segments` : ''}`;
    $('gp-export').disabled = n < 2;
    $('gp-undo').disabled = !undo.length; $('gp-redo').disabled = !redo.length;
    $('gp-reverse').disabled = n < 2; $('gp-route-clear').disabled = !n;
    $('gp-loop').disabled = route.length !== 1 || n < 2 || n >= C.EDIT_LIMIT;
    $('gp-new-segment').disabled = !route.at(-1)?.length || n >= C.EDIT_LIMIT;
  }
  function renderActivities() {
    tracks.clearLayers(); const a = anchor(), selected = activities.filter(x=>x.visible), hot = [];
    selected.forEach(activity => activity.segments.forEach(segment => {
      const coords = C.unwrap(segment,a); hot.push(...coords);
      L.polyline(coords,{color:'#725ac1',weight:3,opacity:.65}).addTo(tracks);
      if (coords.length === 1) L.circleMarker(coords[0],{radius:3,color:'#725ac1'}).addTo(tracks);
    }));
    heat.setLatLngs(hot);
    $('gp-list').replaceChildren();
    activities.forEach(activity => {
      const li = document.createElement('li'), label = document.createElement('label'), check = document.createElement('input');
      check.type = 'checkbox'; check.checked = activity.visible;
      check.addEventListener('change',()=>{activity.visible = check.checked; renderActivities(); renderRoute();});
      const details = document.createElement('span'); details.className = 'gp-file-text';
      const name = document.createElement('strong'); name.textContent = activity.name;
      const stats = document.createElement('small'); stats.textContent = `${metres(C.length(activity.segments))} · ${C.count(activity.segments).toLocaleString()} points · ${activity.segments.length} segment${activity.segments.length === 1 ? '' : 's'}`;
      details.append(name,stats); label.append(check,details);
      const copy = document.createElement('button'); copy.className = 'btn'; copy.textContent = 'Edit a copy';
      copy.disabled = C.count(activity.segments) > C.EDIT_LIMIT;
      copy.title = copy.disabled ? 'This activity exceeds the 500-point editing limit. It can still be viewed as a track and heatmap.' : `Edit ${activity.name}`;
      copy.addEventListener('click',()=>{ commit(clone(activity.segments)); $('gp-name').value = activity.name; renderActivities(); fit(); status('Activity copied to the route editor. Undo restores your previous route.'); });
      const remove = document.createElement('button'); remove.className = 'btn'; remove.textContent = 'Remove'; remove.setAttribute('aria-label',`Remove ${activity.name}`);
      remove.addEventListener('click',()=>{activities = activities.filter(x=>x !== activity);renderActivities();renderRoute();});
      li.append(label,copy,remove); $('gp-list').append(li);
    });
    $('gp-empty').hidden = !!activities.length;
    $('gp-activity-stats').textContent = activities.length ? `${selected.length} of ${activities.length} shown · ${metres(C.length(selected.flatMap(a=>a.segments)))}` : 'No activities loaded';
  }
  function appendPoint(p) {
    if (C.count(route) >= C.EDIT_LIMIT) throw new Error('The editor supports up to 500 points. Undo or clear the route to add more.');
    const next = clone(route); if (!next.length) next.push([]); next.at(-1).push(p); commit(next);
  }
  map.on('click', e => { if (drawing) { try { const p = e.latlng.wrap();appendPoint(C.point(p.lat,p.lng)); } catch(err) { error(err.message); } } });
  $('gp-draw').addEventListener('click',()=>{
    drawing = !drawing; $('gp-draw').setAttribute('aria-pressed',String(drawing)); $('gp-draw').textContent = drawing ? 'Stop drawing' : 'Start drawing';
    $('gp-map').classList.toggle('gp-drawing',drawing); drawing ? map.doubleClickZoom.disable() : map.doubleClickZoom.enable();
    status(drawing ? 'Drawing is on. Click the map to add route points; drag a handle to adjust a point.' : 'Drawing is off. You can pan and explore the map.');
  });
  $('gp-coordinates').addEventListener('submit',e=>{
    e.preventDefault(); try { const p = C.point($('gp-lat').value,$('gp-lon').value); appendPoint(p);map.panTo([p.lat,p.lon]);status('Point added to your route.'); } catch(err) {error(err.message);}
  });
  $('gp-undo').addEventListener('click',()=>{if(undo.length){redo.push(clone(route));route=undo.pop();error();renderRoute();}});
  $('gp-redo').addEventListener('click',()=>{if(redo.length){undo.push(clone(route));route=redo.pop();error();renderRoute();}});
  $('gp-reverse').addEventListener('click',()=>{commit(clone(route).reverse().map(s=>s.reverse()).filter(s=>s.length));});
  $('gp-loop').addEventListener('click',()=>{const next = clone(route); if (next.length === 1 && next[0].length > 1 && C.count(next) < C.EDIT_LIMIT) { if (C.distance(next[0][0],next[0].at(-1)) > .001) {next[0].push(clone(next[0][0]));commit(next);} status('Route is closed.');}});
  $('gp-new-segment').addEventListener('click',()=>{if(route.at(-1)?.length){commit([...clone(route),[]]);status('A new segment is ready. The next point will not connect to the previous segment.');}});
  $('gp-route-clear').addEventListener('click',()=>{commit([]);status('Route cleared. Undo can restore it.');});
  $('gp-export').addEventListener('click',()=>{
    try {
      const xml = C.exportGPX($('gp-name').value,route), url = URL.createObjectURL(new Blob([xml],{type:'application/gpx+xml'})), link = document.createElement('a');
      link.href = url; link.download = ($('gp-name').value.trim().replace(/[^a-z0-9_-]+/gi,'-').slice(0,80) || 'my-route') + '.gpx';
      link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);status('GPX downloaded. Keep this file to open your route again.');
    } catch(e) {error(e.message);}
  });
  $('gp-streets').addEventListener('change',()=>{
    tileErrorReported = false;
    if ($('gp-streets').checked) streets.addTo(map); else streets.remove();
    $('gp-map-mode').textContent = $('gp-streets').checked ? 'OpenStreetMap streets · online' : 'Offline coordinate grid';
  });
  $('gp-tracks').addEventListener('change',()=>{$('gp-tracks').checked ? tracks.addTo(map) : tracks.remove();});
  $('gp-heat').addEventListener('change',()=>{$('gp-heat').checked ? heat.addTo(map) : heat.remove();});
  $('gp-fit').addEventListener('click',fit);
  $('gp-import').addEventListener('click',()=>$('gp-files').click());
  $('gp-files').addEventListener('change',async()=>{
    if(importing) return;
    const files = Array.from($('gp-files').files); $('gp-files').value=''; if(!files.length)return;
    importing=true; $('gp-import').disabled=true; $('gp-demo').disabled=true; $('gp-clear').disabled=true; error();
    try {
      if(activities.length+files.length > 20) throw new Error('Open at most 20 files at once. Remove an activity to make space.');
      const loaded = []; let total = C.count(activities.flatMap(a=>a.segments));
      for(const file of files) {
        if(file.size > 10*1024*1024) throw new Error(`${file.name}: the file exceeds 10 MB.`);
        status(`Reading ${file.name} locally…`);
        let activity; try { activity = C.parse(await file.text(),file.name.replace(/\.gpx$/i,'')); } catch(e) {throw new Error(`${file.name}: ${e.message}`);}
        total += C.count(activity.segments); if(total > C.LIMIT) throw new Error('These files exceed the total limit of 50,000 points. Remove an activity or open fewer files.');
        loaded.push({...activity,visible:true});
      }
      activities.push(...loaded);renderActivities();renderRoute();fit();status(`Opened ${loaded.length} GPX file${loaded.length===1?'':'s'} locally.`);
    } catch(e) {error(e.message);status('No files from this selection were added. Your existing work is unchanged.');}
    finally {importing=false;$('gp-import').disabled=false;$('gp-demo').disabled=false;$('gp-clear').disabled=false;}
  });
  $('gp-demo').addEventListener('click',()=>{
    if(activities.length > 17 || C.count(activities.flatMap(a=>a.segments)) > C.LIMIT-300) {error('Remove some activities to make room for the examples.');return;}
    const paths = [
      [[-33.861,151.209],[-33.857,151.211],[-33.857,151.215],[-33.861,151.217],[-33.864,151.214]],
      [[-33.864,151.207],[-33.861,151.209],[-33.857,151.211],[-33.857,151.215],[-33.854,151.218]],
      [[-33.861,151.209],[-33.857,151.211],[-33.858,151.216],[-33.863,151.219],[-33.864,151.214]]
    ];
    paths.forEach((path,i)=>{const points=[];path.forEach((p,j)=>{if(j)for(let k=1;k<=20;k++) points.push(C.point(path[j-1][0]+(p[0]-path[j-1][0])*k/20,path[j-1][1]+(p[1]-path[j-1][1])*k/20));else points.push(C.point(...p));});activities.push({name:`Example ${i+1} · fictional Sydney track`,segments:[points],visible:true});});
    renderActivities();renderRoute();fit();status('Three fictional example tracks loaded. These illustrate the tool and are not route recommendations.');
  });
  $('gp-clear').addEventListener('click',()=>{activities=[];route=[];undo=[];redo=[];$('gp-name').value='My route';error();renderActivities();renderRoute();status('All activities and route edits cleared from this tab.');});
  new ResizeObserver(()=>map.invalidateSize()).observe($('gp-map'));
  renderActivities();renderRoute();
})();
