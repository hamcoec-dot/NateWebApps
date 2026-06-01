Add-Type -AssemblyName System.IO.Compression.FileSystem
$p = "c:\Users\Admin\Documents\antigravity\PurchaseForm\Purchase Request.xlsx"
$z = [System.IO.Compression.ZipFile]::OpenRead($p)
Write-Host "=== ENTRIES ==="
$z.Entries | Format-Table FullName, Length -AutoSize

# Read shared strings
$ssEntry = $z.Entries | Where-Object { $_.FullName -eq "xl/sharedStrings.xml" }
if ($ssEntry) {
    $reader = New-Object System.IO.StreamReader($ssEntry.Open())
    $ssXml = $reader.ReadToEnd()
    $reader.Close()
    Write-Host "=== SHARED STRINGS ==="
    Write-Host $ssXml
}

# Read sheet1
$sh1Entry = $z.Entries | Where-Object { $_.FullName -eq "xl/worksheets/sheet1.xml" }
if ($sh1Entry) {
    $reader = New-Object System.IO.StreamReader($sh1Entry.Open())
    $shXml = $reader.ReadToEnd()
    $reader.Close()
    Write-Host "=== SHEET1 XML ==="
    Write-Host $shXml
}

$z.Dispose()
