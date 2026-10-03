/** Run in script.google.com. Creates improved COPIES; originals stay unchanged. */
function improveKimoSheetCopies() {
  const sources = [
    ['DDO TASK Management', '1pZI6p_251vA_HCpNB4ug-kWmL1j-govFF9vxyQNCn28', improveDDO_],
    ['DD Worksheet 2026', '1XVgcamPm9pwaP3OnwrCiPKB1DxeHwZtOH5GRuwVqzC8', improveDDS_],
    ['BC Pipeline 2026', '1UCq19JWY-KXE6gZQjQQpKEgJDuLlUD-85Qdw2YPpHGg', improveBC_]
  ];
  sources.forEach(([name, id, improve]) => {
    const copy = DriveApp.getFileById(id).makeCopy(name + ' — KIMO Improved ' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HHmmss'));
    const book = SpreadsheetApp.openById(copy.getId());
    improve(book); SpreadsheetApp.flush();
    console.log(name + ': ' + book.getUrl());
  });
}
function styleKimo_(sheet, header) {
  sheet.setFrozenRows(header);
  sheet.getRange(header, 1, 1, sheet.getLastColumn()).setBackground('#173d32').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  if (!sheet.getFilter()) sheet.getRange(header,1,sheet.getLastRow()-header+1,sheet.getLastColumn()).createFilter();
}
function replaceDashboard_(book, name, rows) {
  const previous=book.getSheetByName(name);
  if(previous) {let old=name+' Legacy';while(book.getSheetByName(old))old+=' copy';previous.setName(old);}
  const dashboard=book.insertSheet(name);dashboard.getRange(1,1,rows.length,Math.max(...rows.map(r=>r.length))).setValues(rows.map(r=>{const a=r.slice();while(a.length<Math.max(...rows.map(r=>r.length)))a.push('');return a;}));
  styleKimo_(dashboard,1);dashboard.setColumnWidth(1,380);dashboard.setColumnWidth(2,250);
  if(previous)previous.hideSheet();
  return dashboard;
}
function improveDDO_(book) {
  const s=book.getSheetByName('DDO TASK');if(!s)throw new Error('DDO TASK not found in copy');
  const last=s.getLastRow();if(s.getMaxColumns()<15)s.insertColumnsAfter(s.getMaxColumns(),15-s.getMaxColumns());
  s.getRange('M1:O1').setValues([['KIMO Row Key','Overdue','Data Check']]);
  const formulas=[];for(let r=2;r<=last;r++)formulas.push([
    `=IF(D${r}="","",A${r}&"-R"&ROW())`,
    `=IF(OR(D${r}="",F${r}="Completed",I${r}=""),"",IF(AND(ISNUMBER(I${r}),I${r}<TODAY()),"OVERDUE",""))`,
    `=IF(D${r}="","",IF(COUNTIF($A$2:$A$${last},A${r})>1,"DUPLICATE ID; ","")&IF(E${r}="","MISSING PIC; ","")&IF(AND(ISNUMBER(H${r}),ISNUMBER(I${r}),I${r}<H${r}),"DATE ORDER; ",""))`
  ]);
  s.getRange(2,13,formulas.length,3).setFormulas(formulas);
  s.getRange(2,6,last-1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['In Pipeline','In Progress','Stuck','Completed','To Do','On Hold'],true).setAllowInvalid(false).build());
  styleKimo_(s,1);s.getRange(2,4,last-1,8).setWrap(true);
  const rows=[['DDO DASHBOARD','Count'],['Tasks',`=COUNTA('DDO TASK'!D2:D${last})`]];
  ['Completed','In Progress','On Hold','In Pipeline','Stuck','To Do'].forEach(status=>rows.push([status,`=COUNTIF('DDO TASK'!F2:F${last},"${status}")`]));
  rows.push(['Overdue',`=COUNTIF('DDO TASK'!N2:N${last},"OVERDUE")`],['Review rows',`=COUNTIF('DDO TASK'!O2:O${last},"?*")`]);replaceDashboard_(book,'KIMO Dashboard',rows);
}
function improveDDS_(book) {
  const year=book.getSheetByName('Year');
  if(year){for(let month=1;month<=12;month++){
    const baseRow=4+Math.floor((month-1)/3)*9,baseCol=2+((month-1)%3)*8;
    const formulas=[];for(let week=0;week<6;week++){const row=[];for(let day=0;day<7;day++){
      const candidate=`${week*7+day+2}-WEEKDAY(DATE($Z$1,${month},1))`;
      row.push(`=IF(AND(${candidate}>=1,${candidate}<=DAY(EOMONTH(DATE($Z$1,${month},1),0))),${candidate},"")`);
    }formulas.push(row);}year.getRange(baseRow,baseCol,6,7).setFormulas(formulas);
  }}
  const s=book.getSheetByName('Project Pipeline 2026');if(!s)throw new Error('Project Pipeline 2026 not found in copy');
  styleKimo_(s,1);s.getRange('B:B').setWrap(true);s.getRange('K:K').setWrap(true);
  const lead=book.getSheetByName('Seedlist 2026');if(lead){lead.getRange('F2').setValue('Email');styleKimo_(lead,2);}
  const last=s.getLastRow();const statuses=[...new Set(s.getRange(3,6,last-2,1).getDisplayValues().flat().filter(Boolean))];
  const rows=[['DDS OPERATIONS DASHBOARD','Count'],['Projects',`=COUNTA('Project Pipeline 2026'!B3:B${last})`]];
  statuses.forEach(status=>rows.push([status,`=COUNTIF('Project Pipeline 2026'!F3:F${last},"${status.replace(/"/g,'""')}")`]));
  if(lead)rows.push(['Lead records',`=COUNTA('Seedlist 2026'!B3:B${lead.getLastRow()})`]);replaceDashboard_(book,'KIMO Dashboard',rows);
}
function improveBC_(book) {
  const s=book.getSheetByName('Pipeline 2026 Detail');if(!s)throw new Error('Pipeline 2026 Detail not found in copy');
  // Stop if layout differs; no financial basis is guessed.
  const headers=s.getRange('J12:R12').getDisplayValues()[0].map(x=>x.trim());
  if(headers.join('|')!=='Lost|Pre - Project Value|Project Value|Agency Fee|Tax|Expected Revenue|Total Expenses|Margin|Profit')throw new Error('Financial header layout changed; review copy manually');
  const last=s.getLastRow();for(let c=10;c<=18;c++){const letter=String.fromCharCode(64+c);s.getRange(11,c).setFormula(c===17?'=IF(O11=0,"",R11/O11)':`=SUM(${letter}13:${letter}${last})`);}
  for(let r=13;r<=last;r++)if(s.getRange(r,17).getFormula())s.getRange(r,17).setFormula(`=IF(O${r}=0,"",R${r}/O${r})`);
  // Specific shifted references only when source project identity matches.
  if(s.getRange('A53').getDisplayValue().trim()==='Dunhill'){s.getRange('N53').setFormula('=(L53+M53)*2%');s.getRange('O53').setFormula('=L53-N53');}
  if(s.getRange('A57').getDisplayValue().trim()==='Enervon C Maybank')s.getRange('N57').setFormula('=(L57+M57)*2%');
  [54,55,57].forEach(r=>s.getRange(r,15).setNote('Review revenue/profit basis. Original manual inputs retained; confirm agency fee treatment.'));
  s.getRange('Q11:Q'+last).setNumberFormat('0.00%');styleKimo_(s,12);
  const finance=book.getSheetByName('Budget & Timeline Finance ');
  if(finance){for(let c=8;c<=13;c++)finance.getRange(3,c).setFormula(`=SUM(${String.fromCharCode(64+c)}4:${String.fromCharCode(64+c)}52)`);finance.getRange('N3').setFormula('=IF(L3=0,"",M3/L3)');for(let r=4;r<=52;r++)if(finance.getRange(r,14).getFormula())finance.getRange(r,14).setFormula(`=IF(L${r}=0,"",M${r}/L${r})`);for(let c=17;c<=40;c++){const letter=c<=26?String.fromCharCode(64+c):'A'+String.fromCharCode(64+c-26);finance.getRange(56,c).setFormula(`=SUM(${letter}4:${letter}52)`);}}
  const pipeline=book.getSheetByName('Pipeline 2026');if(pipeline){pipeline.getRange('H1').setFormula('=SUM(H3:H24)');pipeline.getRange('K1').setFormula('=SUM(K3:K24)');pipeline.getRange('J1').setFormula('=IF(H1=0,"",K1/H1)');}
  replaceDashboard_(book,'Achievement 2026',[
    ['COMMERCIAL PIPELINE — SOURCE TOTALS','Value'],['Profit target',"='Pipeline 2026 Detail'!F11"],
    ['Project value',"='Pipeline 2026 Detail'!L11"],['Agency fee',"='Pipeline 2026 Detail'!M11"],['Tax',"='Pipeline 2026 Detail'!N11"],
    ['Expected revenue (source basis)',"='Pipeline 2026 Detail'!O11"],['Expenses',"='Pipeline 2026 Detail'!P11"],['Profit (source basis)',"='Pipeline 2026 Detail'!R11"],['Weighted margin',"='Pipeline 2026 Detail'!Q11"],
    ['Target gap (pipeline, not cash)','=B2-B8'],['Review','Source totals are not cash receipts. Review revenue/profit basis; original Achievement archived.']
  ]);
}
