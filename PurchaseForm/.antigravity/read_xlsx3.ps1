Add-Type -AssemblyName System.IO.Compression.FileSystem
$p = "c:\Users\Admin\Documents\antigravity\PurchaseForm\Purchase Request.xlsx"
$z = [System.IO.Compression.ZipFile]::OpenRead($p)

# Read shared strings
$ssEntry = $z.Entries | Where-Object { $_.FullName -eq "xl/sharedStrings.xml" }
$strings = @()
if ($ssEntry) {
    $reader = New-Object System.IO.StreamReader($ssEntry.Open())
    $ssXml = $reader.ReadToEnd()
    $reader.Close()
    $matches = [regex]::Matches($ssXml, '<t[^>]*>([^<]*)</t>')
    foreach ($m in $matches) {
        $strings += $m.Groups[1].Value
    }
}

Write-Host "=== ALL SHARED STRINGS ==="
for ($i=0; $i -lt $strings.Count; $i++) {
    Write-Host "$i : $($strings[$i])"
}

# Helper to resolve cell value
function Resolve-Cell($cell, $strings) {
    $t = $cell.GetAttribute("t")
    $v = $cell.SelectSingleNode("*[local-name()='v']")?.InnerText
    if ($t -eq "s" -and $v -ne $null) {
        return $strings[[int]$v]
    }
    return $v
}

# Read & parse a sheet XML
function Read-Sheet($z, $sheetFile, $strings) {
    $entry = $z.Entries | Where-Object { $_.FullName -eq $sheetFile }
    if (-not $entry) { return }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xml = $reader.ReadToEnd()
    $reader.Close()
    
    $doc = New-Object System.Xml.XmlDocument
    $doc.LoadXml($xml)
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    
    $rows = $doc.SelectNodes("//x:row", $ns)
    $data = @{}
    foreach ($row in $rows) {
        $cells = $row.SelectNodes("x:c", $ns)
        foreach ($cell in $cells) {
            $ref = $cell.GetAttribute("r")
            $val = Resolve-Cell $cell $strings
            if ($val) { $data[$ref] = $val }
        }
    }
    return $data
}

Write-Host "`n=== PURCHASE ORDER SHEET CELLS ==="
$po = Read-Sheet $z "xl/worksheets/sheet1.xml" $strings
$po.GetEnumerator() | Sort-Object Name | Format-Table Name, Value -AutoSize

Write-Host "`n=== VENDORS SHEET CELLS ==="
$vendors = Read-Sheet $z "xl/worksheets/sheet2.xml" $strings
$vendors.GetEnumerator() | Sort-Object Name | Format-Table Name, Value -AutoSize

Write-Host "`n=== SHIPTO SHEET CELLS ==="
$shipto = Read-Sheet $z "xl/worksheets/sheet3.xml" $strings
$shipto.GetEnumerator() | Sort-Object Name | Format-Table Name, Value -AutoSize

$z.Dispose()
