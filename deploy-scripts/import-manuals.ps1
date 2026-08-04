$root = 'c:\Users\praco\Desktop\test\FULL-AUDYT\WB-Rent\Dokumenty wynajem'
$dest = 'c:\Users\praco\Desktop\test\FULL-AUDYT\WB-Rent\server\assets\manuals'
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Wzorce bez polskich znakow - PowerShell 5.1 czyta ten plik jako ANSI.
$map = @(
    @{ Pattern = 'Puzzi 10-1';   Target = 'instrukcja-puzzi-10-1.pdf' }
    @{ Pattern = 'Puzzi 8-1';    Target = 'instrukcja-puzzi-8-1.pdf' }
    @{ Pattern = 'NT 22-1';      Target = 'instrukcja-nt-22-1.pdf' }
    @{ Pattern = 'NT 30-1';      Target = 'instrukcja-nt-30-1.pdf' }
    @{ Pattern = 'AD 4 Premium'; Target = 'instrukcja-ad-4-premium.pdf' }
    @{ Pattern = 'WVP 10';       Target = 'instrukcja-wvp-10-adv.pdf' }
    @{ Pattern = 'SG 4-4';       Target = 'instrukcja-sg-4-4.pdf' }
    @{ Pattern = 'Ozonmed';      Target = 'instrukcja-ozonmed-pro-10g.pdf' }
)

foreach ($entry in $map) {
    $folder = Get-ChildItem -Path $root -Directory | Where-Object { $_.Name -like "*$($entry.Pattern)*" } | Select-Object -First 1
    if (-not $folder) { Write-Host "BRAK katalogu: $($entry.Pattern)"; continue }

    $src = Get-ChildItem -Path $folder.FullName -Filter '*.pdf' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'Instrukcja' } |
        Sort-Object Length -Descending |
        Select-Object -First 1

    if (-not $src) { Write-Host "BRAK instrukcji PDF w: $($folder.Name)"; continue }

    Copy-Item $src.FullName (Join-Path $dest $entry.Target) -Force
    Write-Host ("OK  {0,-34} <- {1}" -f $entry.Target, $folder.Name)
}

$rodo = Get-ChildItem -Path $root -Recurse -Filter '*.pdf' |
    Where-Object { $_.Name -match 'RODO' } |
    Sort-Object Length -Descending |
    Select-Object -First 1
if ($rodo) {
    Copy-Item $rodo.FullName (Join-Path $dest 'klauzula-rodo.pdf') -Force
    Write-Host ("OK  {0,-34} <- {1}" -f 'klauzula-rodo.pdf', $rodo.Name)
}

Write-Host ''
Get-ChildItem $dest | Select-Object Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB, 1) } } | Format-Table -AutoSize
