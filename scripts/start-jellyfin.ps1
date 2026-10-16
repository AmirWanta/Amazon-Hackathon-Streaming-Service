[CmdletBinding()]
param(
    [switch]$Foreground
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeDir = Join-Path $repoRoot 'krakend'
$composeFile = Join-Path $composeDir 'docker-compose.yml'
$envFile = Join-Path $composeDir '.env'

function Test-Command([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Assert-DockerReady {
    if (-not (Test-Command 'docker')) {
        throw 'Docker CLI was not found. Install Docker Desktop and restart PowerShell.'
    }

    & docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is installed but the engine is not running. Start Docker Desktop and try again.'
    }

    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose is unavailable. Update Docker Desktop or install the Compose plugin.'
    }
}

function Assert-ProjectFiles {
    if (-not (Test-Path -LiteralPath $composeFile)) {
        throw "Compose file was not found: $composeFile"
    }

    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "Missing $envFile. Copy krakend/.env.example to krakend/.env and set JELLYFIN_API_KEY after Jellyfin setup."
    }
}

function Start-JellyfinContainer {
    Push-Location $composeDir
    try {
        Write-Host 'Starting the Jellyfin Docker service...'
        if ($Foreground) {
            & docker compose --env-file .env up jellyfin
        } else {
            & docker compose --env-file .env up -d jellyfin
            if ($LASTEXITCODE -ne 0) {
                throw 'Docker Compose could not start Jellyfin.'
            }
            & docker compose --env-file .env ps jellyfin
        }
    } finally {
        Pop-Location
    }
}

Assert-DockerReady
Assert-ProjectFiles
Start-JellyfinContainer

if (-not $Foreground) {
    Write-Host ''
    Write-Host 'Jellyfin is available at http://localhost:8096'
    Write-Host 'Complete Jellyfin first-run setup there, create an API key, and place it in krakend/.env.'
    Write-Host 'Then start KrakenD with .\scripts\start-krakend.ps1.'
}
