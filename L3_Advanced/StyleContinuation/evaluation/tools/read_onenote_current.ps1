param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$interop = 'C:\Windows\assembly\GAC_MSIL\Microsoft.Office.Interop.OneNote\15.0.0.0__71e9bce111e9429c\Microsoft.Office.Interop.OneNote.dll'
Add-Type -Path $interop
$source = @'
using System;
using Microsoft.Office.Interop.OneNote;
public static class OneNoteReadCurrent {
    public static string[] Read() {
        Application app = new Application();
        Window window = app.Windows.CurrentWindow;
        if (window == null) throw new InvalidOperationException("OneNote has no current window.");
        string pageId = window.CurrentPageId;
        if (String.IsNullOrEmpty(pageId)) throw new InvalidOperationException("OneNote has no current page.");
        string pageXml;
        app.GetPageContent(pageId, out pageXml, PageInfo.piBasic, XMLSchema.xs2013);
        string hierarchy;
        app.GetHierarchy(window.CurrentSectionId, HierarchyScope.hsPages, out hierarchy, XMLSchema.xs2013);
        return new string[]{pageId, window.CurrentSectionId, pageXml, hierarchy};
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies $interop
$result = [OneNoteReadCurrent]::Read()
$directory = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($directory) | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $directory 'current-page.xml'), $result[2], $utf8)
[IO.File]::WriteAllText((Join-Path $directory 'current-section-titles.xml'), $result[3], $utf8)
[xml]$doc = $result[2]
$ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
$ns.AddNamespace('one', $doc.DocumentElement.NamespaceURI)
$summary = [ordered]@{
    page_id = $result[0]
    section_id = $result[1]
    page_title = $doc.DocumentElement.GetAttribute('name')
    xml_chars = $result[2].Length
    outline_count = $doc.SelectNodes('//one:Outline',$ns).Count
    text_element_count = $doc.SelectNodes('//one:T',$ns).Count
    method = 'Read-only strong-typed OneNote COM: GetPageContent(piBasic,xs2013); GetHierarchy(current section,hsPages)'
}
$json = $summary | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $directory 'source-summary.json'),$json,$utf8)
Write-Output $json
