
# Wait a bit for server to start
Start-Sleep -Seconds 2

# Test the /ask endpoint
try {
    $body = @{
        question = "Do I have rent transactions in 2030?"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:3000/ask" -Method POST -ContentType "application/json" -Body $body

    Write-Host "Response:"
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error occurred: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody"
    }
}
