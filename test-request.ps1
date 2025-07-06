# Google Sheets Tool Test Script for PowerShell
# Run this script to test your Google Sheets Writer tool

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$SheetId = "1efj3u3zsHzFfVAvQAySjIemJpHtbsqBvLg3rXCUUpjE",
    [string]$Range = "Sheet1!A1"
)

# Test configuration
$TestData = @{
    sheet_id = $SheetId
    range = $Range
    summary = "Test summary written by Mosaia tool at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

# Helper function to make HTTP requests
function Invoke-TestRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers -Body $jsonBody
        } else {
            $response = Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers
        }
        
        return @{
            Success = $true
            StatusCode = 200
            Body = $response
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.ErrorDetails.Message
        if (-not $errorBody) {
            $errorBody = $_.Exception.Message
        }
        
        return @{
            Success = $false
            StatusCode = $statusCode
            Body = $errorBody
        }
    }
}

# Test functions
function Test-HealthCheck {
    Write-Host "`n🧪 Testing: Server Health Check" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Gray
    
    $response = Invoke-TestRequest -Url "$BaseUrl/health" -Method "GET"
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Response: $($response.Body | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    
    if ($response.Success) {
        Write-Host "✅ Health check PASSED" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Health check FAILED" -ForegroundColor Red
        return $false
    }
}

function Test-WriteToSheet {
    Write-Host "`n🧪 Testing: Write to Google Sheet" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Gray
    
    $response = Invoke-TestRequest -Url "$BaseUrl/write" -Method "POST" -Body $TestData
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Response: $($response.Body | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    
    if ($response.Success) {
        Write-Host "✅ Write test PASSED" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Write test FAILED" -ForegroundColor Red
        return $false
    }
}

function Test-InvalidSheetId {
    Write-Host "`n🧪 Testing: Invalid Sheet ID" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Gray
    
    $invalidData = $TestData.Clone()
    $invalidData.sheet_id = "invalid-sheet-id"
    
    $response = Invoke-TestRequest -Url "$BaseUrl/write" -Method "POST" -Body $invalidData
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Response: $($response.Body | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    
    if (-not $response.Success -and $response.StatusCode -eq 500) {
        Write-Host "✅ Invalid sheet ID test PASSED (expected error)" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Invalid sheet ID test FAILED (should have returned error)" -ForegroundColor Red
        return $false
    }
}

function Test-MissingParameters {
    Write-Host "`n🧪 Testing: Missing Parameters" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor Gray
    
    $testCases = @(
        @{ Name = "Missing sheet_id"; Data = @{ range = $TestData.range; summary = $TestData.summary } },
        @{ Name = "Missing range"; Data = @{ sheet_id = $TestData.sheet_id; summary = $TestData.summary } },
        @{ Name = "Missing summary"; Data = @{ sheet_id = $TestData.sheet_id; range = $TestData.range } }
    )
    
    $allPassed = $true
    
    foreach ($testCase in $testCases) {
        Write-Host "`n$($testCase.Name):" -ForegroundColor Yellow
        
        $response = Invoke-TestRequest -Url "$BaseUrl/write" -Method "POST" -Body $testCase.Data
        
        Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Yellow
        Write-Host "Response: $($response.Body | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
        
        if (-not $response.Success -and $response.StatusCode -eq 400) {
            Write-Host "✅ $($testCase.Name) test PASSED (expected validation error)" -ForegroundColor Green
        } else {
            Write-Host "❌ $($testCase.Name) test FAILED (should have returned 400)" -ForegroundColor Red
            $allPassed = $false
        }
    }
    
    return $allPassed
}

# Main test runner
function Start-TestSuite {
    Write-Host "🚀 Starting Google Sheets Tool Tests" -ForegroundColor Magenta
    Write-Host ("=" * 60) -ForegroundColor Gray
    Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
    Write-Host "Test Sheet ID: $SheetId" -ForegroundColor Yellow
    Write-Host "Test Range: $Range" -ForegroundColor Yellow
    Write-Host ("=" * 60) -ForegroundColor Gray
    
    $results = @{
        Health = Test-HealthCheck
        Write = Test-WriteToSheet
        InvalidSheet = Test-InvalidSheetId
        Validation = Test-MissingParameters
    }
    
    Write-Host "`n📊 Test Results Summary" -ForegroundColor Magenta
    Write-Host ("=" * 60) -ForegroundColor Gray
    Write-Host "Health Check: $(if ($results.Health) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if ($results.Health) { 'Green' } else { 'Red' })
    Write-Host "Write to Sheet: $(if ($results.Write) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if ($results.Write) { 'Green' } else { 'Red' })
    Write-Host "Invalid Sheet ID: $(if ($results.InvalidSheet) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if ($results.InvalidSheet) { 'Green' } else { 'Red' })
    Write-Host "Parameter Validation: $(if ($results.Validation) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if ($results.Validation) { 'Green' } else { 'Red' })
    
    $passedTests = ($results.Values | Where-Object { $_ -eq $true }).Count
    $totalTests = $results.Count
    
    Write-Host "`nOverall: $passedTests/$totalTests tests passed" -ForegroundColor Yellow
    
    if ($passedTests -eq $totalTests) {
        Write-Host "🎉 All tests passed! Your tool is ready for Mosaia." -ForegroundColor Green
    } else {
        Write-Host "⚠️  Some tests failed. Please check the errors above." -ForegroundColor Red
    }
    
    return $results
}

# Run tests if this script is executed directly
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    Start-TestSuite
} 