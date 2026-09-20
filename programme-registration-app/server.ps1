# ================================================================
# PROGRAMME REGISTRATION PORTAL - POWERSHEEL HTTP SERVER
# ================================================================
# Running this script launches a standalone web server on Windows!
# Port: 8080
# Participant Link: http://localhost:8080/register
# Host Link:        http://localhost:8080/host
# ================================================================

param (
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $ScriptDir "data"
$DataFile = Join-Path $DataDir "registrations.json"

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

if (-not (Test-Path $DataFile)) {
    "[]" | Out-File -FilePath $DataFile -Encoding utf8
}

$Listener = New-Object System.Net.HttpListener
$Prefix = "http://localhost:$Port/"
$Listener.Prefixes.Add($Prefix)

try {
    $Listener.Start()
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "  PROGRAMME REGISTRATION WEB SERVER RUNNING SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "  👉 Host Link:         http://localhost:$Port/host" -ForegroundColor Yellow
    Write-Host "  👉 Participant Link:  http://localhost:$Port/register" -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host "  Press Ctrl+C to stop the server.`n" -ForegroundColor Gray
} catch {
    Write-Error "Failed to start listener. Try running PowerShell as Administrator or change the Port."
    exit 1
}

while ($Listener.IsListening) {
    try {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        $UrlPath = $Request.Url.AbsolutePath

        # CORS Headers
        $Response.Headers.Add("Access-Control-Allow-Origin", "*")
        $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($Request.HttpMethod -eq "OPTIONS") {
            $Response.StatusCode = 200
            $Response.Close()
            continue
        }

        # ROUTING & ENDPOINTS
        if ($UrlPath -eq "/api/registrations" -and $Request.HttpMethod -eq "GET") {
            # GET ALL REGISTRATIONS
            $JsonData = Get-Content -Path $DataFile -Raw -Encoding utf8
            $Buffer = [System.Text.Encoding]::UTF8.GetBytes($JsonData)
            $Response.ContentType = "application/json"
            $Response.ContentLength64 = $Buffer.Length
            $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
            $Response.Close()

        } elseif ($UrlPath -eq "/api/register" -and $Request.HttpMethod -eq "POST") {
            # ADD NEW REGISTRATION
            $Reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
            $BodyStr = $Reader.ReadToEnd()
            $Reader.Close()

            $NewRecord = $BodyStr | ConvertFrom-Json
            
            $ExistingJson = Get-Content -Path $DataFile -Raw -Encoding utf8
            $ExistingList = @()
            if ($ExistingJson) {
                $ExistingList = $ExistingJson | ConvertFrom-Json
            }
            if ($null -eq $ExistingList) { $ExistingList = @() }

            $ExistingList += $NewRecord

            $UpdatedJson = $ExistingList | ConvertTo-Json -Depth 10
            $UpdatedJson | Out-File -FilePath $DataFile -Encoding utf8

            $RespMsg = '{"status":"success","message":"Registered successfully"}'
            $Buffer = [System.Text.Encoding]::UTF8.GetBytes($RespMsg)
            $Response.ContentType = "application/json"
            $Response.ContentLength64 = $Buffer.Length
            $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
            $Response.Close()

        } elseif ($UrlPath -eq "/api/clear" -and $Request.HttpMethod -eq "POST") {
            # CLEAR ALL DATA
            "[]" | Out-File -FilePath $DataFile -Encoding utf8
            $RespMsg = '{"status":"success","message":"Cleared all registrations"}'
            $Buffer = [System.Text.Encoding]::UTF8.GetBytes($RespMsg)
            $Response.ContentType = "application/json"
            $Response.ContentLength64 = $Buffer.Length
            $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
            $Response.Close()

        } else {
            # SERVE STATIC FILES (index.html, styles.css, app.js)
            $TargetFile = "index.html"
            if ($UrlPath -eq "/styles.css") { $TargetFile = "styles.css" }
            elseif ($UrlPath -eq "/app.js") { $TargetFile = "app.js" }

            $FilePath = Join-Path $ScriptDir $TargetFile
            if (Test-Path $FilePath) {
                $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
                
                if ($TargetFile -eq "index.html") { $Response.ContentType = "text/html" }
                elseif ($TargetFile -eq "styles.css") { $Response.ContentType = "text/css" }
                elseif ($TargetFile -eq "app.js") { $Response.ContentType = "text/javascript" }

                $Response.ContentLength64 = $Bytes.Length
                $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
                $Response.Close()
            } else {
                $Response.StatusCode = 404
                $Response.Close()
            }
        }
    } catch {
        # Catch unexpected errors to prevent loop crash
        Write-Host "Error processing request: $_" -ForegroundColor Red
    }
}
