[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$aiDir = Join-Path $repoRoot 'AIEnhancer'
$pipelineFile = Join-Path $aiDir 'voice_pipeline.py'
$requirementsFile = Join-Path $aiDir 'requirements.txt'
$venvDir = Join-Path $aiDir '.venv'
$venvPython = Join-Path $venvDir 'Scripts\python.exe'
$envFile = Join-Path $repoRoot '.env.local'

function Test-Command([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PythonCommand {
    if (Test-Command 'py.exe') {
        return 'py.exe'
    }
    if (Test-Command 'python.exe') {
        return 'python.exe'
    }
    throw 'Python was not found. Install Python 3 and reopen PowerShell.'
}

function Assert-ProjectFiles {
    foreach ($path in @($aiDir, $pipelineFile, $requirementsFile)) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Required AI enhancer file was not found: $path"
        }
    }

    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "Missing $envFile. Create it and set EXPO_PUBLIC_VOICE_SERVER_URL before running this script."
    }

    $envText = Get-Content -LiteralPath $envFile -Raw
    if ($envText -notmatch '(?m)^\s*EXPO_PUBLIC_VOICE_SERVER_URL\s*=\s*\S+') {
        throw "EXPO_PUBLIC_VOICE_SERVER_URL is missing or empty in $envFile."
    }
}

function Assert-Tools {
    if (-not (Test-Command 'npx.cmd')) {
        throw 'npx.cmd was not found. Install Node.js and reopen PowerShell.'
    }
    if (-not (Test-Command 'adb.exe')) {
        throw 'adb.exe was not found. Install Android SDK platform-tools and add them to PATH.'
    }
}

function Prepare-PythonEnvironment([string]$PythonCommand) {
    if (-not (Test-Path -LiteralPath $venvPython)) {
        Write-Host 'Creating the AI enhancer Python virtual environment...'
        & $PythonCommand -m venv $venvDir
        if ($LASTEXITCODE -ne 0) {
            throw 'Python could not create the AI enhancer virtual environment.'
        }
    }

    Write-Host 'Installing or updating AI enhancer Python dependencies...'
    & $venvPython -m pip install -r $requirementsFile
    if ($LASTEXITCODE -ne 0) {
        throw 'The AI enhancer Python dependencies could not be installed.'
    }
}

function Start-VoicePipeline {
    $powershell = (Get-Process -Id $PID).Path
    $pipelineCommand = "& '$venvPython' '$pipelineFile'; if (`$LASTEXITCODE -ne 0) { Write-Host ''; Write-Host 'Voice pipeline exited with an error.' -ForegroundColor Red }; Read-Host 'Press Enter to close this window'"

    Write-Host 'Starting the voice pipeline in a separate PowerShell window...'
    Start-Process -FilePath $powershell `
        -WorkingDirectory $aiDir `
        -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $pipelineCommand)
}

function Start-Expo {
    & adb.exe start-server *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'ADB could not start. Start the Android emulator and try again.'
    }

    if ($SkipBuild) {
        Write-Host 'Starting Expo in development-client mode without rebuilding the native app...'
        & npx.cmd expo start --dev-client
    } else {
        Write-Host 'Building and launching the native Android app...'
        & npx.cmd expo run:android
    }

    if ($LASTEXITCODE -ne 0) {
        throw 'Expo could not start the Android app.'
    }
}

Assert-ProjectFiles
Assert-Tools
$pythonCommand = Get-PythonCommand
Prepare-PythonEnvironment $pythonCommand
Start-VoicePipeline
Start-Expo
