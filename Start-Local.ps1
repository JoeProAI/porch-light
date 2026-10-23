param(
    [ValidateRange(1, 288)][int]$Captures = 288,
    [ValidateRange(300, 3600)][int]$Interval = 300,
    [string]$EngineRoot,
    [switch]$SkipWeather
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$web = Join-Path $root "web"
if (-not $EngineRoot) {
    $EngineRoot = if (Test-Path (Join-Path $root "engines\national_jobs.py")) { $root } else {
        Join-Path (Split-Path $root -Parent) "porch-light-engines"
    }
}
if (-not (Test-Path (Join-Path $EngineRoot "engines\national_jobs.py"))) {
    throw "The national engine source isn't available. Set -EngineRoot to the integrated engine checkout."
}
$env:PORCHLIGHT_ENGINE_ROOT = (Resolve-Path $EngineRoot).Path
if (-not (Test-Path (Join-Path $web ".next\BUILD_ID"))) {
    throw "A production build is required. Run npm run build from $web, then run this launcher again."
}
$logs = Join-Path $env:USERPROFILE ".porchlight\runlogs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$listener = Get-NetTCPConnection -State Listen -LocalPort 3101 -ErrorAction SilentlyContinue
if (-not $listener) {
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $app = Start-Process -FilePath $npm -ArgumentList @("run", "start") -WorkingDirectory $web `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logs "$stamp-web.out.log") `
        -RedirectStandardError (Join-Path $logs "$stamp-web.err.log")
    Write-Output "Started local web process $($app.Id)."
} else {
    Write-Output "Port 3101 already has a listener. No duplicate web server started."
}

if (-not $SkipWeather) {
    $worker = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match "^python(w)?(.exe)?$" -and
        $_.CommandLine -match "-m\s+data\.adapters\.us\.capture_live_weather"
    }
    if ($worker) {
        Write-Output "Weather capture worker already running: $($worker.ProcessId -join ', '). No duplicate started."
    } else {
        $python = (Get-Command python -ErrorAction Stop).Source
        $capture = Start-Process -FilePath $python `
            -ArgumentList @("-u", "-m", "data.adapters.us.capture_live_weather", "--interval", "$Interval", "--max-captures", "$Captures") `
            -WorkingDirectory $env:PORCHLIGHT_ENGINE_ROOT -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs "$stamp-weather.out.log") `
            -RedirectStandardError (Join-Path $logs "$stamp-weather.err.log")
        Write-Output "Started official weather worker $($capture.Id): $Captures attempts, at least $Interval seconds apart."
    }
    Write-Output "Source captures use public NWS/NOAA endpoints. Source times and failed reads remain visible."
    Write-Output "The bounded worker stops after its configured attempts. This is not continuous hosting."
}
Write-Output "Porch Light: http://127.0.0.1:3101"
Write-Output "Local startup logs: $logs"
