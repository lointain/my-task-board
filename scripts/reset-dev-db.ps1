# 重置开发实例的测试数据库（只影响 com.yao.taskboard.dev，不动正式数据）
$ErrorActionPreference = "Stop"

$dir = Join-Path $env:APPDATA "com.yao.taskboard.dev"
$expected = Join-Path $env:APPDATA "com.yao.taskboard.dev"
if ($dir -ne $expected) {
    throw "unexpected data dir: $dir"
}

if (-not (Test-Path $dir)) {
    Write-Output "no dev data dir yet: $dir"
    exit 0
}

foreach ($name in "data.db", "data.db-wal", "data.db-shm") {
    $path = Join-Path $dir $name
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Force
        Write-Output "removed $path"
    }
}

Get-ChildItem $dir -Force | Select-Object Name
Write-Output "dev database reset."
