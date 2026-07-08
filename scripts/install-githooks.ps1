# Install repo git hooks that strip Cursor co-author trailers.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$hookSrc = Join-Path $PSScriptRoot "git-hooks\prepare-commit-msg"
$hookDst = Join-Path $repoRoot ".git\hooks\prepare-commit-msg"

if (!(Test-Path $hookSrc)) {
  throw "Missing hook template: $hookSrc"
}
if (!(Test-Path (Join-Path $repoRoot ".git"))) {
  throw "Not a git repository: $repoRoot"
}

Copy-Item -Force $hookSrc $hookDst
Write-Host "Installed prepare-commit-msg hook -> $hookDst"
