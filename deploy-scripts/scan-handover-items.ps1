$dir = Join-Path $env:TEMP 'wbrent-docs'

Get-ChildItem -Path $dir -Filter '*Umowa*.txt' |
    Where-Object { $_.Name -notmatch 'Za\u0142\u0105cznik' } |
    ForEach-Object {
        $lines = (Get-Content $_.FullName -Raw) -split "`n" | ForEach-Object { $_.Trim() }
        $start = ($lines | Select-String -Pattern 'Protok\u00f3\u0142 wydania sprz\u0119tu' | Select-Object -First 1)
        Write-Host "=== $($_.Name -replace '\.docx\.txt$','') ==="
        if (-not $start) { Write-Host '  (brak protokolu)'; Write-Host ''; return }

        $i = $start.LineNumber
        $collected = @()
        while ($i -lt $lines.Count -and $collected.Count -lt 26) {
            $line = $lines[$i]
            if ($line -match 'Potwierdzam odbi\u00f3r') { break }
            if ($line -and $line -notmatch '^(Lp\.|Nazwa|Ilo\u015b\u0107|Podpis najemcy|\d+\.?)$') { $collected += $line }
            $i++
        }
        $collected | ForEach-Object { Write-Host "  - $_" }
        Write-Host ''
    }
