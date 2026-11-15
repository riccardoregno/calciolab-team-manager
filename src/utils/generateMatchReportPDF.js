import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadBrandingAssets } from './pdfBranding';
import { buildMatchReportSummary, formatMatchReportSummary } from './matchReportSummary';
import { it } from '../i18n/locales/it.js';
import { en } from '../i18n/locales/en.js';

const C = { dark:[15,23,42], mid:[30,41,59], accent:[37,99,235], light:[96,165,250],
  white:[255,255,255], muted:[148,163,184], green:[34,197,94], red:[239,68,68], border:[51,65,85] };
const clean = value => String(value ?? '').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"');
function dateLabel(date,language) {
  const parsed = new Date(String(date || '').slice(0,10)+'T12:00:00');
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString(language==='en'?'en-GB':'it-IT');
}
function chrome(doc,teamName,logos) {
  const W=doc.internal.pageSize.width,H=doc.internal.pageSize.height;
  doc.setFillColor(...C.dark);doc.rect(0,0,W,H,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...C.light);
  if(logos.calciolabLogo) { try {doc.addImage(logos.calciolabLogo,'PNG',14,2,10,10);} catch { /* Text brand remains. */ } }
  doc.text('CalcioLab',logos.calciolabLogo?26:14,9);
  if(logos.teamLogo) {try {doc.addImage(logos.teamLogo,'PNG',W-24,2,10,10);} catch { /* Body identifies the team. */ }}
  else {doc.setFont('helvetica','normal');doc.setTextColor(...C.muted);doc.text(doc.splitTextToSize(clean(teamName),125).slice(0,2),W-14,6,{align:'right'});}
  doc.setDrawColor(...C.border);doc.line(14,H-11,W-14,H-11);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...C.muted);
  doc.text(String(doc.internal.getCurrentPageInfo().pageNumber),W/2,H-5,{align:'center'});
  doc.text('calciolab.org',W-14,H-5,{align:'right'});
}

export async function generateMatchReportPDF({match,players=[],appSettings={},rows=[],statsUnavailable=false,
  language='it',doc:sharedDoc,save=true,brandingAssets}) {
  if(!match) return;
  const profile=appSettings.workspaceProfile || {};
  const teamName=profile.teamName || profile.clubName || 'CalcioLab';
  const summary=buildMatchReportSummary({match,players,rows,statsUnavailable,teamName});
  const view=formatMatchReportSummary(summary,language);
  const labels=view.labels;
  const messages=(language==='en'?en:it).pages.postMatch;
  const logos=brandingAssets || await loadBrandingAssets(profile.logo || null);
  const doc=sharedDoc || new jsPDF({unit:'mm',format:'a4',putOnlyUsedFonts:true});
  const W=doc.internal.pageSize.width,H=doc.internal.pageSize.height;
  if(sharedDoc) doc.addPage();
  const painted=new Set();
  const paint=()=>{const n=doc.internal.getCurrentPageInfo().pageNumber;if(!painted.has(n)){chrome(doc,teamName,logos);painted.add(n);}};
  const newPage=()=>{doc.addPage();paint();};
  paint();let y=23;
  const reserve=height=>{if(y+height>H-20){newPage();y=24;}};
  const paragraph=(value,color=C.white)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...color);
    for(const line of doc.splitTextToSize(clean(value),W-28)){reserve(6);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...color);doc.text(line,14,y);y+=5;}
  };
  const section=title=>{reserve(28);doc.setFillColor(...C.accent);doc.roundedRect(14,y,W-28,8,2,2,'F');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...C.white);doc.text(clean(title).toUpperCase(),18,y+5.5);y+=13;};
  const table=(head,body,columnStyles={})=>{
    reserve(20);
    autoTable(doc,{startY:y,head:[head.map(clean)],body:body.map(row=>row.map(clean)),theme:'plain',
      margin:{left:14,right:14,top:24,bottom:20},styles:{font:'helvetica',fontSize:8.5,cellPadding:3,fillColor:C.dark,textColor:C.white,overflow:'linebreak'},
      headStyles:{fillColor:C.mid,textColor:C.light,fontStyle:'bold'},alternateRowStyles:{fillColor:[20,30,48]},
      columnStyles,willDrawPage:paint});
    y=doc.lastAutoTable.finalY+9;
  };
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...C.light);doc.text(language==='en'?'MATCH REPORT':'REFERTO GARA',14,y);y+=8;
  doc.setFontSize(17);doc.setTextColor(...C.white);
  const title=doc.splitTextToSize(clean(view.title),W-78);doc.text(title,14,y);y+=title.length*7+2;
  doc.setFontSize(summary.score?25:9);
  doc.setTextColor(...(summary.score ? summary.score.goalsFor>summary.score.goalsAgainst?C.green:summary.score.goalsFor<summary.score.goalsAgainst?C.red:C.muted : C.muted));
  doc.text(doc.splitTextToSize(clean(view.scoreLabel),45),W-14,31,{align:'right'});
  paragraph([dateLabel(match.date,language),match.competition,match.location].filter(Boolean).join(' - '),C.muted);y+=4;

  section(labels.title);
  paragraph(view.countLabel,C.muted);
  paragraph(view.totalLabel);
  if(view.pendingLabel) paragraph(view.pendingLabel,C.light);
  if(summary.unresolvedCount) paragraph(labels.unresolved.replace('{{count}}',summary.unresolvedCount),C.light);
  y+=3;
  if(view.entries.length) table([labels.player,labels.role,labels.minutes],view.entries.map(entry=>[entry.name,entry.roleLabel,entry.minutesLabel]),{1:{cellWidth:31},2:{cellWidth:54}});
  else paragraph(labels.noPlayers,C.muted);

  section(labels.changes);
  if(view.changes.length) table([labels.changes],view.changes.map(change=>[change.label]));
  else paragraph(labels.noChanges,C.muted);
  y+=3;

  const report=match.postMatch || {};
  const positivePlayers=Array.isArray(report.positivePlayers)
    ? report.positivePlayers.map(id=>players.find(player=>String(player.id)===String(id))?.name || labels.unknownPlayer).join(', ')
    : report.positivePlayers;
  const fields=[
    [messages.sectionWorked,report.worked],[messages.sectionNotWorked,report.notWorked],[messages.sectionKeyMoments,report.keyMoments],
    [messages.sectionPerformanceScore,report.performanceScore],[messages.sectionGameModelScore,report.gameModelScore],
    [messages.sectionIntensityScore,report.intensityScore],[messages.scoreStaff,report.staffRating],[messages.sectionTacticalCorrections,report.tacticalCorrections],
    [messages.sectionNextWeekFocus,report.nextWeekFocus],[messages.sectionTrainingActions,report.trainingActions],
    [messages.sectionRecoveryPlan,report.recoveryPlan],[messages.sectionPositivePlayers,positivePlayers],
    [messages.sectionPhysicalAlerts,report.physicalAlerts],[messages.sectionSetPiecesReview,report.setPiecesReview],
    [messages.sectionOpponentLessons,report.opponentLessons],[labels.staffDecisions,report.staffDecisions],[messages.sectionVideoAnalysis,report.videoClips],
  ].filter(([,value])=>String(value??'').trim());
  section(messages.reportTitle);
  if(fields.length) table([labels.analysisTopic,labels.analysisNotes],fields,{0:{cellWidth:48}});
  else paragraph(labels.analysisPending,C.muted);

  const clips=match.videoAnalysis || [];
  if(clips.length){section(messages.sectionVideoAnalysis);table([labels.clipMinute,labels.clipCategory,labels.player,labels.analysisNotes],clips.map(clip=>[
    clip.minute??'-',clip.category||'-',players.find(player=>String(player.id)===String(clip.playerId))?.name || '-',[clip.note,clip.tags,clip.url].filter(Boolean).join('\n') || '-'
  ]),{0:{cellWidth:18},1:{cellWidth:28},2:{cellWidth:45}});}
  if(!save) return doc;
  const opponent=(match.opponent||'Avversario').replace(/[^a-zA-Z0-9\s]/g,'').trim().replace(/\s+/g,'_');
  doc.save(`Referto_${opponent}_${String(match.date||'senza-data').slice(0,10)}.pdf`);
  return doc;
}
