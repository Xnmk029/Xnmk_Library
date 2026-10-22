$ErrorActionPreference='Stop'
$d='F:\benchmark\L3_Advanced\StyleContinuation\evaluation\intake\20260922-onenote-com'
$xml=Get-Content -Raw -Encoding UTF8 (Join-Path $d 'current-page-latest.xml')
[xml]$doc=$xml
$ns=New-Object System.Xml.XmlNamespaceManager($doc.NameTable); $ns.AddNamespace('one','http://schemas.microsoft.com/office/onenote/2013/onenote')
function Get-OeText($oe) { $ts=$oe.SelectNodes('.//one:T',$ns); return (($ts | ForEach-Object {$_.InnerText}) -join "`n") }
$items=New-Object System.Collections.Generic.List[object]; $oi=0
foreach($outline in $doc.SelectNodes('//one:Outline',$ns)) {
 $oi++; $oes=$outline.SelectNodes('./one:OEChildren/one:OE',$ns); $paras=New-Object System.Collections.Generic.List[object]; $pi=0
 foreach($oe in $oes) { $pi++; $txt=Get-OeText $oe; [void]$paras.Add([pscustomobject]@{paragraph_index=$pi;text=$txt;blank=[string]::IsNullOrWhiteSpace($txt);raw_oe_xml=$oe.OuterXml}) }
 $pos=$outline.SelectSingleNode('.//one:Position',$ns)
 $first=($paras|Select-Object -First 1).text
 $role=if($oi -eq 1){'prompt'}elseif($oi -eq 31){'page_note_or_evaluation'}else{'candidate_response'}
 [void]$items.Add([pscustomobject]@{outline_index=$oi;role=$role;position_x=[double]$pos.x;position_y=[double]$pos.y;position_z=[int]$pos.z;paragraph_count=$paras.Count;first_paragraph=$first;paragraphs=$paras})
 $rawPath=Join-Path $d (('outline-{0:d2}-raw.xml' -f $oi)); Set-Content $rawPath $outline.OuterXml -Encoding UTF8
 $mdPath=Join-Path $d (('outline-{0:d2}-response.md' -f $oi)); (($paras|ForEach-Object{$_.text}) -join "`r`n`r`n") | Set-Content $mdPath -Encoding UTF8
}
$payload=[pscustomobject]@{page_title='Grok4.7';source_page_id='{6978D275-24B3-4A43-8EA4-7CC480126648}{1}{E19510744204563913218320143050620336921117651}';xml_chars=$xml.Length;outline_count=$items.Count;text_element_count=$doc.SelectNodes('//one:T',$ns).Count;outlines=$items}
$payload|ConvertTo-Json -Depth 8|Set-Content (Join-Path $d 'extracted.json') -Encoding UTF8
$summary=[pscustomobject]@{page_title=$payload.page_title;source_page_id=$payload.source_page_id;xml_chars=$payload.xml_chars;outline_count=$payload.outline_count;text_element_count=$payload.text_element_count;outline_summaries=@($items|ForEach-Object{[pscustomobject]@{outline_index=$_.outline_index;role=$_.role;paragraph_count=$_.paragraph_count;first_paragraph=$_.first_paragraph.Substring(0,[Math]::Min(160,$_.first_paragraph.Length))}})}
$summary|ConvertTo-Json -Depth 6

