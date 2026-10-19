[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mediaRoot = Join-Path $repoRoot 'krakend\media'
$moviesRoot = Join-Path $mediaRoot 'movies'
$showsRoot = Join-Path $mediaRoot 'shows'

function Ensure-Directory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-NfoIfMissing([string]$Path, [string]$Content) {
    if (-not (Test-Path -LiteralPath $Path)) {
        Set-Content -LiteralPath $Path -Value $Content -Encoding utf8
        Write-Host "Created $Path"
    } else {
        Write-Host "Keeping existing $Path"
    }
}

function Download-Media(
    [string]$Url,
    [string]$TargetPath
) {
    if (Test-Path -LiteralPath $TargetPath) {
        Write-Host "Keeping existing $TargetPath"
        return
    }

    Ensure-Directory (Split-Path -Parent $TargetPath)
    $partialPath = "$TargetPath.download"

    Write-Host "Downloading $Url"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $partialPath -UseBasicParsing
        $downloadedFile = Get-Item -LiteralPath $partialPath
        if ($downloadedFile.Length -lt 1MB) {
            throw "The download was unexpectedly small and may be an error page: $Url"
        }

        Move-Item -LiteralPath $partialPath -Destination $TargetPath -Force
        Write-Host "Installed $TargetPath"
    } finally {
        if (Test-Path -LiteralPath $partialPath) {
            Remove-Item -LiteralPath $partialPath -Force
        }
    }
}

Ensure-Directory $moviesRoot
Ensure-Directory $showsRoot

$movieDir = Join-Path $moviesRoot 'Big Buck Bunny (2008)'
$movieFile = Join-Path $movieDir 'Big Buck Bunny (2008).mp4'
$movieNfo = Join-Path $movieDir 'Big Buck Bunny (2008).nfo'
Download-Media `
    'https://video.blender.org/download/web-videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4' `
    $movieFile
Write-NfoIfMissing $movieNfo @'
<movie>
  <title>Big Buck Bunny</title>
  <originaltitle>Big Buck Bunny</originaltitle>
  <year>2008</year>
  <plot>A giant rabbit faces unexpected trouble while enjoying a peaceful day in the forest.</plot>
  <genre>Animation</genre>
  <genre>Comedy</genre>
  <studio>Blender Foundation</studio>
  <runtime>10</runtime>
  <ratings>
    <rating name="community">
      <value>8.1</value>
      <votes>1250</votes>
    </rating>
  </ratings>
</movie>
'@

$showDir = Join-Path $showsRoot 'Caminandes'
$seasonDir = Join-Path $showDir 'Season 01'
$episodeFile = Join-Path $seasonDir 'Caminandes - S01E01 - Gran Dillama.mp4'
$episodeNfo = Join-Path $seasonDir 'Caminandes - S01E01 - Gran Dillama.nfo'
$showNfo = Join-Path $showDir 'tvshow.nfo'
Download-Media `
    'https://video.blender.org/download/web-videos/fb70d459-48d2-4db5-adba-813c84f9200a-720.mp4' `
    $episodeFile
Write-NfoIfMissing $showNfo @'
<tvshow>
  <title>Caminandes</title>
  <plot>A short animated series following Koro the llama through playful adventures.</plot>
  <genre>Animation</genre>
  <genre>Comedy</genre>
  <studio>Blender Foundation</studio>
  <ratings>
    <rating name="community">
      <value>8.0</value>
      <votes>420</votes>
    </rating>
  </ratings>
</tvshow>
'@
Write-NfoIfMissing $episodeNfo @'
<episodedetails>
  <title>Gran Dillama</title>
  <showtitle>Caminandes</showtitle>
  <season>1</season>
  <episode>1</episode>
  <aired>2013-09-11</aired>
  <plot>Koro the llama tries to reach a tempting berry while facing an unexpected rival.</plot>
  <genre>Animation</genre>
  <genre>Comedy</genre>
  <studio>Blender Foundation</studio>
  <ratings>
    <rating name="community">
      <value>8.0</value>
      <votes>180</votes>
    </rating>
  </ratings>
</episodedetails>
'@

Write-Host ''
Write-Host 'Demo media setup is complete.' -ForegroundColor Green
Write-Host 'Refresh or scan the Movies and Shows libraries in Jellyfin before starting KrakenD.'
