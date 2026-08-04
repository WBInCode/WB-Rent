$dir = Join-Path $env:TEMP 'wbrent-docs'

Get-ChildItem -Path $dir -Filter '*Umowa*.txt' | ForEach-Object {
    $text = Get-Content $_.FullName -Raw

    $value = [regex]::Match($text, 'uzgadniaj\u0105 na kwot\u0119\s*([\d\s\u00A0]+,\d{2})\s*z\u0142').Groups[1].Value
    $daily = [regex]::Match($text, 'Stawka najmu \(dobowa\):\s*([\d\s,\.]+)\s*z\u0142').Groups[1].Value
    $penalty = [regex]::Match($text, 'przetrzymanie Sprz\u0119tu:\s*([\d\s,\.]+)\s*z\u0142').Groups[1].Value
    $included = [regex]::Match($text, 'W cen\u0119 wliczone jest ([^;\.]+)').Groups[1].Value

    [pscustomobject]@{
        Plik      = $_.Name -replace '\.docx\.txt$', ''
        Wartosc   = $value
        Doba      = $daily
        Kara      = $penalty
        WCenie    = $included.Trim()
    }
} | Format-List
