Add-Type -AssemblyName System.IO.Compression.FileSystem
$p = "c:\Users\Admin\Documents\antigravity\PurchaseForm\Purchase Request.xlsx"
$z = [System.IO.Compression.ZipFile]::OpenRead($p)

# List all entries
Write-Host "=== ENTRIES ==="
$z.Entries | Format-Table FullName, Length -AutoSize

# Read shared strings
$ssEntry = $z.Entries | Where-Object { $_.FullName -eq "xl/sharedStrings.xml" }
if ($ssEntry) {
    $reader = New-Object System.IO.StreamReader($ssEntry.Open())
    $ssXml = $reader.ReadToEnd()
    $reader.Close()
    # Parse shared strings - extract <t> values
    $matches = [regex]::Matches($ssXml, '<t[^>]*>([^<]*)</t>')
    Write-Host "=== SHARED STRINGS ==="
    $i = 0
    foreach ($m in $matches) {
        Write-Host "$i : $($m.Groups[1].Value)"
        $i++
    }
}

# Read Vendors sheet
$vEntry = $z.Entries | Where-Object { $_.FullName -like "xl/worksheets/sheet2.xml" }
if ($vEntry) {
    $reader = New-Object System.IO.StreamReader($vEntry.Open())
    Write-Host "=== SHEET 2 XML ===" 
    Write-Host $reader.ReadToEnd()
    $reader.Close()
}

# Read ShipTo sheet
$sEntry = $z.Entries | Where-Object { $_.FullName -like "xl/worksheets/sheet3.xml" }
if ($sEntry) {
    $reader = New-Object System.IO.StreamReader($sEntry.Open())
    Write-Host "=== SHEET 3 XML ===" 
    Write-Host $reader.ReadToEnd()
    $reader.Close()
}

# Read workbook to understand sheet names
$wbEntry = $z.Entries | Where-Object { $_.FullName -eq "xl/workbook.xml" }
if ($wbEntry) {
    $reader = New-Object System.IO.StreamReader($wbEntry.Open())
    Write-Host "=== WORKBOOK XML ===" 
    Write-Host $reader.ReadToEnd()
    $reader.Close()
}

$z.Dispose()
