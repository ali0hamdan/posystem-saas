# Stock POS - PostgreSQL Backup Script
# Usage: .\scripts\backup-db.ps1
# Schedule with Task Scheduler for automatic daily backups.

param(
    [string]$Host      = "localhost",
    [string]$Port      = "5432",
    [string]$Database  = "pos",
    [string]$User      = "postgres",
    [string]$BackupDir = "$PSScriptRoot\..\backups",
    [int]   $KeepDays  = 30
)

# Load password from .env if not set in environment
if (-not $env:PGPASSWORD) {
    $envFile = "$PSScriptRoot\..\backend\.env"
    if (Test-Path $envFile) {
        $match = Select-String -Path $envFile -Pattern "DATABASE_URL=postgresql://[^:]+:([^@]+)@" | Select-Object -First 1
        if ($match) {
            $env:PGPASSWORD = $match.Matches[0].Groups[1].Value
        }
    }
}

# Ensure backup directory exists
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $BackupDir "pos_backup_$timestamp.sql.gz"

Write-Host "Starting backup of database '$Database'..."
Write-Host "Output: $backupFile"

# Find pg_dump
$pgDump = "pg_dump"
$candidates = @(
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $pgDump = $c; break }
}

# Run backup
& $pgDump -h $Host -p $Port -U $User -d $Database --format=plain --no-password |
    & { param([System.IO.Stream]$input)
        $gzStream = [System.IO.Compression.GzipStream]::new(
            [System.IO.File]::Create($backupFile),
            [System.IO.Compression.CompressionMode]::Compress
        )
        $input | ForEach-Object {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("$_`n")
            $gzStream.Write($bytes, 0, $bytes.Length)
        }
        $gzStream.Close()
    }

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
    Write-Host "Backup complete: $backupFile ($size MB)"
} else {
    Write-Error "Backup FAILED with exit code $LASTEXITCODE"
    exit 1
}

# Cleanup old backups
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem $BackupDir -Filter "pos_backup_*.sql.gz" |
       Where-Object { $_.LastWriteTime -lt $cutoff }
if ($old.Count -gt 0) {
    Write-Host "Removing $($old.Count) old backup(s) older than $KeepDays days..."
    $old | Remove-Item -Force
}

Write-Host "Done."
