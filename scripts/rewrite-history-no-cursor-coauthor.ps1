# Rewrite current branch history: remove Cursor Co-authored-by trailers from all commits.
$ErrorActionPreference = "Stop"

$commits = @(git rev-list --reverse HEAD)
if ($commits.Count -eq 0) {
  Write-Host "No commits to rewrite."
  exit 0
}

$newParent = $null
foreach ($old in $commits) {
  $tree = (git rev-parse "${old}^{tree}").Trim()
  $msg = git log -1 --format=%B $old
  $lines = $msg -split "`r?`n" | Where-Object {
    $_ -notmatch 'cursoragent@cursor\.com' -and $_ -notmatch '^Co-authored-by:\s*Cursor'
  }
  $cleanMsg = ($lines -join "`n").Trim()

  $env:GIT_AUTHOR_NAME = (git log -1 --format=%an $old).Trim()
  $env:GIT_AUTHOR_EMAIL = (git log -1 --format=%ae $old).Trim()
  $env:GIT_AUTHOR_DATE = (git log -1 --format=%ad --date=raw $old).Trim()
  $env:GIT_COMMITTER_NAME = (git log -1 --format=%cn $old).Trim()
  $env:GIT_COMMITTER_EMAIL = (git log -1 --format=%ce $old).Trim()
  $env:GIT_COMMITTER_DATE = (git log -1 --format=%cd --date=raw $old).Trim()

  $msgFile = New-TemporaryFile
  try {
    [System.IO.File]::WriteAllText($msgFile.FullName, $cleanMsg)
    if ($newParent) {
      $newCommit = (git commit-tree $tree -p $newParent -F $msgFile.FullName).Trim()
    } else {
      $newCommit = (git commit-tree $tree -F $msgFile.FullName).Trim()
    }
    $newParent = $newCommit
  } finally {
    Remove-Item $msgFile -Force -ErrorAction SilentlyContinue
  }
}

git reset --hard $newParent
Write-Host "Rewrote $($commits.Count) commit(s). New HEAD: $newParent"
