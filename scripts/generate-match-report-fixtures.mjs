import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const destination=resolve(process.argv[2] || '../../output/pdf');
const server=await createServer({cacheDir:'node_modules/.vite-pdf-fixtures',server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
  const {generateMatchReportPDF}=await server.ssrLoadModule('/src/utils/generateMatchReportPDF.js');
  const {generateMatchPackagePDF}=await server.ssrLoadModule('/src/utils/generateMatchPackagePDF.js');
  const players=Array.from({length:25},(_,i)=>({id:String(i+1),name:`Luca ${i===2?'Della Valle Castiglioni':`Fittizio ${i+1}`}`,role:i===0?'Portiere':'Centrocampista',shirtNumber:i+1}));
  const match={id:'pdf-fixture',date:'2026-11-14',location:'Trasferta',opponent:'AS Cronaca fittizia',result:'1-2',competition:'Campionato fittizio',
    lineup:{starterIds:players.slice(0,11).map(p=>p.id),benchIds:players.slice(11).map(p=>p.id),calledUpIds:players.map(p=>p.id),formationPlans:{firstHalf:{formation:'3-4-1-2',slots:Object.fromEntries(players.slice(0,11).map((p,i)=>[i,p.id]))}}},
    convocazione:{playerIds:players.map(p=>p.id)},liveEvents:[{id:'c1',type:'substitution',minute:60,playerId:'12',playerOutId:'3'},{id:'c2',type:'substitution',minute:75,playerId:'13',playerOutId:'12'}],
    postMatch:{worked:'Circolazione rapida e recupero della posizione. '.repeat(80)+'FINE_NOTA_COMPLETA',notWorked:'Distanze da migliorare sui cambi di gioco.',staffDecisions:'Confronto dello staff prima della prossima seduta.'}};
  const rows=players.map((p,i)=>({match_id:match.id,player_id:p.id,minutes_played:i===2?60:i===11||i===12?15:i<11?90:0}));
  const appSettings={workspaceProfile:{teamName:'CalcioLab Team fittizio'}};
  const base={match,players,appSettings,rows,save:false,brandingAssets:{calciolabLogo:null,teamLogo:null}};
  await mkdir(destination,{recursive:true});
  const partial={...match,attendance:{'4':{minutes:90}}};
  const partialRows=rows.filter(row=>row.player_id!=='3').map(row=>row.player_id==='4'?{...row,minutes_cleared:true}:row);
  const outputs=[
    ['calciolab-referto-completo.pdf',await generateMatchReportPDF(base)],
    ['calciolab-referto-parziale.pdf',await generateMatchReportPDF({...base,match:partial,rows:partialRows})],
    ['calciolab-pacchetto-partita.pdf',await generateMatchPackagePDF({...base,allPlayers:players,profile:appSettings.workspaceProfile})],
  ];
  for(const [filename,doc] of outputs){await writeFile(resolve(destination,filename),Buffer.from(doc.output('arraybuffer')));console.log(`${filename}: ${doc.internal.getNumberOfPages()} pagine`);}
} finally {await server.close();}
