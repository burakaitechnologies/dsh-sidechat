$ErrorActionPreference = "Continue"
$ws = "C:\Users\ahmet\Documents\deepseek-harness\default-workspace"
$env:npm_config_cache = "$ws\.npm-cache"
$dest = "$ws\analysis\npm"
New-Item -ItemType Directory -Force -Path $dest, "$dest\extracted" | Out-Null
$specs = @(
  "@deepseek-ai/dsh-client-ui-primitives@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-conversation@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-chat@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-session@0.2.1-rc.2",
  "@deepseek-ai/dsh-api-session-controller@0.2.1-rc.2",
  "@deepseek-ai/dsh-api-remotes@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-model-selection@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-input-trigger@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-workspace@0.2.1-rc.2",
  "@deepseek-ai/dsh-client-ui-slots@0.2.1-rc.2",
  "@deepseek-ai/dsh-session@0.2.1-rc.2",
  "@deepseek-ai/dsh-llm@0.2.1-rc.2",
  "@deepseek-ai/dsh-typert-protocol@0.2.1-rc.2",
  "@deepseek-ai/dsh-package-manifest@0.2.1-rc.2",
  "@deepseek-ai/dsh-app-boot@0.2.1-rc.2",
  "@deepseek-ai/cordis@4.0.5"
)
$i = 0
foreach ($s in $specs) {
  $i++
  Write-Host "[$i/$($specs.Count)] npm pack $s"
  npm pack $s --pack-destination $dest 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "    $_" }
}
Write-Host "=== extract ==="
Get-ChildItem "$dest\*.tgz" | ForEach-Object {
  $base = $_.BaseName -replace '\.tgz$', ''
  $out = "$dest\extracted\$base"
  New-Item -ItemType Directory -Force -Path $out | Out-Null
  tar -xzf $_.FullName -C $out 2>&1 | Out-Null
  $pkg = "$out\package\package.json"
  if (Test-Path $pkg) {
    $j = Get-Content $pkg -Raw | ConvertFrom-Json
    Write-Host ("extracted {0}@{1}" -f $j.name, $j.version)
  } else { Write-Host ("MISSING package.json in {0}" -f $_.Name) }
}
Write-Host "=== done fetch-types ==="
