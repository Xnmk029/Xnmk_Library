$d='F:\benchmark\L3_Advanced\StyleContinuation\evaluation\intake\20260922-onenote-com'
$j=Get-Content -Raw -Encoding UTF8 (Join-Path $d 'extracted.json')|ConvertFrom-Json
function CleanFragment($s){$x=$s -replace '(?is)<br\s*/?>',"`n"; $x=$x -replace '(?is)</p\s*>',"`n"; $x=$x -replace '(?is)<[^>]+>',''; $x=[System.Net.WebUtility]::HtmlDecode($x); return $x.Trim()}
foreach($o in $j.outlines){
 $full=@($o.paragraphs|ForEach-Object{CleanFragment $_.text})
 $clean=($full -join "`r`n`r`n")
 $label=''; if($o.role -eq 'candidate_response'){$label=CleanFragment $o.first_paragraph; if($label -match '(?s)^(.+?)(?:\r?\n){2,}'){$label=$Matches[1].Trim()}}
 $body=$clean
 if($label){$first=$full[0]; if($first.StartsWith($label)){$rest=$first.Substring($label.Length).Trim(); $tail=if($full.Count -gt 1){"`r`n`r`n"+($full[1..($full.Count-1)] -join "`r`n`r`n")}else{''}; $body=$rest+$tail}}
 $id=('outline-{0:d2}' -f $o.outline_index)
 Set-Content (Join-Path $d "$id-clean-response.md") $clean -Encoding UTF8
 Set-Content (Join-Path $d "$id-body.md") $body -Encoding UTF8
}
