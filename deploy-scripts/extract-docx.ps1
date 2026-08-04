Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-DocxText {
    param([string]$Path)
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
        if (-not $entry) { return '' }
        $reader = New-Object System.IO.StreamReader($entry.Open())
        $xml = $reader.ReadToEnd()
        $reader.Close()
    } finally { $zip.Dispose() }

    $xml = $xml -replace '<w:tab[^>]*/>', "`t"
    $xml = $xml -replace '<w:br[^>]*/>', "`n"
    $xml = $xml -replace '</w:p>', "`n"
    $xml = $xml -replace '<[^>]+>', ''
    [System.Net.WebUtility]::HtmlDecode($xml)
}

$root = 'c:\Users\praco\Desktop\test\FULL-AUDYT\WB-Rent\Dokumenty wynajem'
$out = Join-Path $env:TEMP 'wbrent-docs'
New-Item -ItemType Directory -Force -Path $out | Out-Null

Get-ChildItem -Path $root -Recurse -Filter *.docx | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1) -replace '[\\/:*?"<>|]', '_'
    $text = Get-DocxText $_.FullName
    $target = Join-Path $out ($rel + '.txt')
    $text | Out-File -FilePath $target -Encoding utf8
    [pscustomobject]@{ Plik = $rel; Znaki = $text.Length }
}
