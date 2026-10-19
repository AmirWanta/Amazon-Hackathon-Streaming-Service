[CmdletBinding()]
param(
    [string]$Distro = $(if ($env:KRAKEND_WSL_DISTRO) { $env:KRAKEND_WSL_DISTRO } else { 'Ubuntu' }),
    [switch]$Foreground
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$krakendDir = Join-Path $repoRoot 'krakend'
$envFile = Join-Path $krakendDir '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing $envFile. Copy krakend/.env.example to krakend/.env and set API KEY."
}

function Test-Command([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Start-WithDocker {
    Push-Location $krakendDir
    try {
        Write-Host 'Starting KrakenD with Docker Compose...'
        if ($Foreground) {
            & docker compose --env-file .env up
        } else {
            & docker compose --env-file .env up -d
            & docker compose ps
        }
    } finally {
        Pop-Location
    }
}

function Get-LinuxPath([string]$WindowsPath) {
    $result = & wsl.exe -d $Distro -- wslpath -a $WindowsPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "WSL could not translate '$WindowsPath' for distro '$Distro'. $result"
    }
    return ($result | Select-Object -Last 1).ToString().Trim()
}

function Start-WithWsl {
    $linuxDir = Get-LinuxPath $krakendDir
    $linuxEnv = Get-LinuxPath $envFile
    $checkCommand = "set -a; . '$linuxEnv'; set +a; FC_ENABLE=1 krakend check --lint --config '$linuxDir/krakend.json'"
    & wsl.exe -d $Distro -- bash -lc $checkCommand
    if ($LASTEXITCODE -ne 0) {
        throw "KrakenD configuration validation failed inside WSL distro '$Distro'."
    }

    Write-Host "Starting KrakenD in WSL2 distro '$Distro' on port 8080..."
    $runCommand = "set -a; . '$linuxEnv'; set +a; FC_ENABLE=1 krakend run --config '$linuxDir/krakend.json'"
    & wsl.exe -d $Distro -- bash -lc $runCommand
}

if (Test-Command 'docker') {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        Start-WithDocker
        exit $LASTEXITCODE
    }
    Write-Warning 'Docker CLI is present, but the Docker engine is not running. Falling back to WSL2.'
}

if (-not (Test-Command 'wsl')) {
    throw 'Neither Docker nor WSL2 is available on PATH. Install Docker Desktop or enable WSL2 first.'
}

& wsl.exe -l -q *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'WSL2 is installed but Windows denied distro enumeration. Run this script from an elevated PowerShell or repair WSL access.'
}

$distroExists = (& wsl.exe -l -q | ForEach-Object { $_.Trim() }) -contains $Distro
if (-not $distroExists) {
    throw "WSL distro '$Distro' was not found. Install it with: wsl --install -d $Distro"
}

if (-not (Test-Command 'docker')) {
    Write-Warning 'Docker is unavailable; using the WSL2 KrakenD installation.'
}
Start-WithWsl
