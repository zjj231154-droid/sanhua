$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteUrl = 'http://127.0.0.1:5173/'
function Test-Site {
  try {
    $status = & curl.exe --noproxy '*' --silent --output NUL --write-out '%{http_code}' --max-time 5 $siteUrl
    return ($LASTEXITCODE -eq 0 -and $status -eq '200')
  } catch { return $false }
}
if (-not (Test-Site)) {
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $logFolder = Join-Path $projectRoot 'storage\server-logs'
  New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
  $logStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Start-Process -FilePath $nodePath -ArgumentList 'scripts/local-server.mjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logFolder "$logStamp.out.log") -RedirectStandardError (Join-Path $logFolder "$logStamp.err.log")
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (Test-Site) { break }
    Start-Sleep -Seconds 1
  }
}
if (Test-Site) { Start-Process $siteUrl } else { throw 'Local server did not start. See storage/server-logs.' }
