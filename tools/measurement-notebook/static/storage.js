/* Atomic IndexedDB records, with optimistic revisions to protect edits in other tabs. */
(function(){
  'use strict';
  const P=window.MeasurementProjects;
  let connection;
  function open(){
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      let blocked=false;
      const r=indexedDB.open('plenty-measurement-notebook',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'id'});
      r.onerror=()=>reject(r.error);
      r.onblocked=()=>{blocked=true;reject(new Error('Close other notebook tabs and retry. Storage is blocked.'));};
      r.onsuccess=()=>{const db=r.result;if(blocked){db.close();return;}db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
    }).catch(error=>{connection=null;throw error;});return connection;
  }
  function valid(row){return !!row&&P.metadata(row.project)&&row.id===row.project.id&&row.image instanceof Blob&&(row.original===null||row.original instanceof Blob)&&row.image.size<=P.LIMITS.image&&(!row.original||row.original.size<=P.LIMITS.original);}
  async function read(id){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readonly'),r=tx.objectStore('projects').get(id);tx.oncomplete=()=>{if(!valid(r.result))reject(new Error('This saved project is missing or damaged. Import a backup to recover it.'));else resolve(r.result);};tx.onabort=()=>reject(tx.error||new Error('Could not read project.'));});}
  async function list(){
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction('projects','readonly'),r=tx.objectStore('projects').openCursor(),rows=[];let damaged=0;
      r.onsuccess=()=>{const cursor=r.result;if(!cursor)return;const row=cursor.value;if(valid(row))rows.push({project:row.project,bytes:row.image.size+(row.original?.size||0)+new Blob([JSON.stringify(row.project)]).size});else damaged++;cursor.continue();};
      tx.oncomplete=()=>resolve({rows:rows.sort((a,b)=>b.project.updated-a.project.updated),damaged});tx.onabort=()=>reject(tx.error||new Error('Could not list projects.'));
    });
  }
  async function write(project,image,original,expectedRevision){
    if(!P.metadata(project)||!(image instanceof Blob)||image.type!=='image/png'||!image.size||image.size>P.LIMITS.image||(original!==null&&(!(original instanceof Blob)||!original.size||original.size>P.LIMITS.original)))throw new Error('Invalid project or photo exceeds the storage limit.');
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects'),get=store.get(project.id);let problem,next;
      get.onsuccess=()=>{
        const old=get.result;
        if((expectedRevision===null&&old)||(expectedRevision!==null&&(!valid(old)||old.project.revision!==expectedRevision))){problem=new Error('This project changed or was deleted in another tab. Export your current work as a backup, then reopen the saved project.');tx.abort();return;}
        next={...project,revision:(expectedRevision??0)+1,updated:Math.max(project.created,Date.now())};
        try{store.put({id:next.id,project:next,image,original});}catch(error){problem=error;tx.abort();}
      };
      tx.oncomplete=()=>resolve(next);tx.onabort=()=>reject(problem||tx.error||new Error('Save transaction was cancelled.'));
    });
  }
  async function remove(id,revision){
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects'),r=store.get(id);let problem;
      r.onsuccess=()=>{if(!valid(r.result)||r.result.project.revision!==revision){problem=new Error('Project changed in another tab. Refresh the project list before deleting.');tx.abort();}else store.delete(id);};
      tx.oncomplete=resolve;tx.onabort=()=>reject(problem||tx.error||new Error('Could not delete project.'));
    });
  }
  window.MeasurementStorage={list,read,write,remove};
})();
