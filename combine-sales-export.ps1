# Combine sales_export_filtered.json entries by SalesOrderNo
# This script groups records by order number and combines serial numbers and keys

Write-Host "Reading sales_export_filtered.json..." -ForegroundColor Cyan

$inputFile = "sales_export_filtered.json"
$outputFile = "sales_export_filtered.json"

# Read the input file
$salesData = Get-Content $inputFile -Raw | ConvertFrom-Json

Write-Host "Processing $($salesData.Count) records..." -ForegroundColor Cyan

# Group by SalesOrderNo and combine data
$combinedOrders = @{}

foreach ($record in $salesData) {
    $orderNo = [string]$record.SalesOrderNo
    
    # Skip records with non-numeric order numbers (filter out names)
    $orderNoInt = 0
    if (-not [int]::TryParse($orderNo, [ref]$orderNoInt) -or $orderNo.Trim() -eq '') {
        continue
    }
    
    if (-not $combinedOrders.ContainsKey($orderNo)) {
        $combinedOrders[$orderNo] = @{
            SalesOrderNo = $orderNo
            Keys = [System.Collections.Generic.HashSet[string]]::new()
            RackSerialNumbers = [System.Collections.Generic.HashSet[string]]::new()
            AddOnSerialNumbers = [System.Collections.Generic.HashSet[string]]::new()
        }
    }
    
    $order = $combinedOrders[$orderNo]
    
    # Add Keys
    if ($record.Keys) {
        [void]$order.Keys.Add([string]$record.Keys)
    }
    
    # Add RackSerialNumber
    if ($record.RackSerialNumber) {
        [void]$order.RackSerialNumbers.Add([string]$record.RackSerialNumber)
    }
    
    # Add AddOnSerialNumbers
    if ($record.AddOnSerialNumbers -and $record.AddOnSerialNumbers.Count -gt 0) {
        foreach ($serial in $record.AddOnSerialNumbers) {
            if ($serial) {
                [void]$order.AddOnSerialNumbers.Add([string]$serial)
            }
        }
    }
}

Write-Host "Combined into $($combinedOrders.Count) unique orders" -ForegroundColor Green

# Convert to array format
$combinedArray = @()

foreach ($orderKey in $combinedOrders.Keys | Sort-Object { [int]$_ }) {
    $order = $combinedOrders[$orderKey]
    
    # Convert HashSets to arrays
    $keysArray = @()
    foreach ($key in $order.Keys) {
        $keysArray += $key
    }
    
    $rackSerialsArray = @()
    foreach ($serial in $order.RackSerialNumbers) {
        $rackSerialsArray += $serial
    }
    
    $addOnSerialsArray = @()
    foreach ($serial in $order.AddOnSerialNumbers) {
        $addOnSerialsArray += $serial
    }
    
    # Combine all serial numbers into one array
    $allSerials = @()
    $allSerials += $rackSerialsArray
    $allSerials += $addOnSerialsArray
    
    # Create combined entry
    $combinedEntry = @{
        SalesOrderNo = $order.SalesOrderNo
        Keys = $keysArray
        SerialNumbers = $allSerials
    }
    
    $combinedArray += $combinedEntry
}

# Create backup of original file
$backupFile = "sales_export_filtered.json.backup"
Copy-Item $inputFile $backupFile -Force
Write-Host "Created backup: $backupFile" -ForegroundColor Yellow

# Write combined data to file
$combinedArray | ConvertTo-Json -Depth 10 | Set-Content $outputFile -Encoding UTF8

Write-Host "Transformation complete!" -ForegroundColor Green
Write-Host "Output written to: $outputFile" -ForegroundColor Cyan
Write-Host "Total combined orders: $($combinedArray.Count)" -ForegroundColor Cyan

# Show sample of first few orders
Write-Host "`nSample orders (first 3):" -ForegroundColor Yellow
$combinedArray | Select-Object -First 3 | ConvertTo-Json -Depth 10
