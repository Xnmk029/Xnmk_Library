$ErrorActionPreference='Stop'
$one=New-Object -ComObject OneNote.Application.15
$pageId='{6978D275-24B3-4A43-8EA4-7CC480126648}{1}{E19510744204563913218320143050620336921117651}'
$xml=''
$one.GetPageContent($pageId,[ref]$xml,[Microsoft.Office.Interop.OneNote.PageInfo]::piAll)
Set-Content -LiteralPath (Join-Path $d 'page-Grok4.7.xml') -Value $xml -Encoding utf8NoBOM
[xml]$doc=$xml
$ns=New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
$ns.AddNamespace('one','http://schemas.microsoft.com/office/onenote/2013/onenote')
function Get-OeText($oe) {
  $parts=New-Object System.Collections.Generic.List[string]
  foreach($n in $oe.SelectNodes('.//one:T/node()',$ns)) {
    if($n.LocalName -eq 'Newline') {[void]$parts.Add("`n")} elseif($n.NodeType -eq 'Text') {[void]$parts.Add($n.Value)}
  }
  return ($parts -join '')
}
$items=New-Object System.Collections.Generic.List[object]
$oi=0
foreach($outline in $doc.SelectNodes('//one:Outline',$ns)) {
  $oi++
  $oes=$outline.SelectNodes('./one:OEChildren/one:OE',$ns)
  $paras=New-Object System.Collections.Generic.List[object]
  $pi=0
  foreach($oe in $oes) {
    $pi++
    $ts=$oe.SelectNodes('.//one:T',$ns)
    $rawT=($ts | ForEach-Object {$_.OuterXml}) -join ''
    $txt=Get-OeText $oe
    [void]$paras.Add([pscustomobject]@{paragraph_index=$pi;text=$txt;blank=[string]::IsNullOrWhiteSpace($txt);raw_t_xml=$rawT})
  }
  $first=($paras | Select-Object -First 1).text
  [void]$items.Add([pscustomobject]@{outline_index=$oi;paragraph_count=$paras.Count;first_paragraph=$first;paragraphs=$paras})
}
$payload=[pscustomobject]@{page_title='Grok4.7';source_page_id=$pageId;outline_count=$items.Count;outlines=$items}
$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $d 'extracted.json') -Encoding utf8NoBOM
$summary=[pscustomobject]@{page_title='Grok4.7';source_page_id=$pageId;xml_chars=$xml.Length;outline_count=$items.Count;paragraph_count=($items|Measure-Object paragraph_count -Sum).Sum;outline_summaries=@($items|ForEach-Object {[pscustomobject]@{outline_index=$_.outline_index;paragraph_count=$_.paragraph_count;first_paragraph=$_.first_paragraph}})}
$summary | ConvertTo-Json -Depth 6
