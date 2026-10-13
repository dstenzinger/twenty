param(
    [Parameter(Position = 0)]
    [ValidateSet('setup', 'start', 'stop', 'status', 'update', 'backup', 'maintenance', 'dev', 'dev-stop', 'phone', 'logs')]
    [string]$Command = 'status',

    [Parameter(Position = 1)]
    [string]$Branch = ''
)

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$ComposeFile = Join-Path $Root 'docker-compose.yml'
$ProdEnvFile = Join-Path $Root '.env'
$DevEnvFile = Join-Path $Root '.env.dev'
$LogDirectory = Join-Path $Root 'logs'
$Image = 'ghcr.io/dstenzinger/twenty'
$ProdProject = 'twenty-crm'
$DevProject = 'twenty-crm-dev'
$ProdPort = 3000
$DevPort = 3001
$DevTailscalePort = 8443
$BackupsToKeep = 14
$StateDirectory = Join-Path $Root 'state'
$UpdateInterval = New-TimeSpan -Days 7
$BackupInterval = New-TimeSpan -Days 1
$DockerStartupWait = New-TimeSpan -Minutes 5
$MaintenanceTaskName = 'Twenty CRM - Maintenance'
$LegacyTaskNames = @('Twenty CRM - Update', 'Twenty CRM - Backup')

function Write-Log([string]$Message) {
    New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path (Join-Path $LogDirectory 'crm.log') -Value $line
    Write-Host $Message
}

function Test-DockerRunning {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Assert-DockerRunning {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker Desktop is not installed. Install it from https://www.docker.com/products/docker-desktop/ and run this again.'
    }
    if (-not (Test-DockerRunning)) {
        throw 'Docker Desktop is not running. Open Docker Desktop, wait until it says "Engine running", then try again.'
    }
}

function New-RandomSecret([int]$ByteCount, [switch]$Hex) {
    $bytes = New-Object byte[] $ByteCount
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    if ($Hex) { return -join ($bytes | ForEach-Object { $_.ToString('x2') }) }
    return [Convert]::ToBase64String($bytes)
}

function Write-EnvFile([string]$Path, [string[]]$Lines) {
    [System.IO.File]::WriteAllLines($Path, $Lines, (New-Object System.Text.UTF8Encoding $false))
}

function Get-EnvValue([string]$Path, [string]$Key) {
    $line = Get-Content $Path | Where-Object { $_ -like "$Key=*" } | Select-Object -First 1
    if ($null -eq $line) { return $null }
    return $line.Substring($Key.Length + 1)
}

function Set-EnvValue([string]$Path, [string]$Key, [string]$Value) {
    $lines = @(Get-Content $Path)
    $found = $false
    $updated = foreach ($line in $lines) {
        if ($line -like "$Key=*") { $found = $true; "$Key=$Value" } else { $line }
    }
    if (-not $found) { $updated = @($updated) + "$Key=$Value" }
    Write-EnvFile $Path $updated
}

function New-EnvFileIfMissing([string]$Path, [string]$Tag, [int]$Port) {
    if (Test-Path $Path) { return }
    Write-EnvFile $Path @(
        "IMAGE=$Image",
        "TAG=$Tag",
        "HOST_PORT=$Port",
        "SERVER_URL=http://localhost:$Port",
        "PG_DATABASE_PASSWORD=$(New-RandomSecret 24 -Hex)",
        "ENCRYPTION_KEY=$(New-RandomSecret 32)",
        "APP_SECRET=$(New-RandomSecret 32)"
    )
    Write-Log "Created $([System.IO.Path]::GetFileName($Path)) with fresh secrets."
}

function Invoke-Compose([string]$Project, [string]$EnvFile, [string[]]$Arguments) {
    & docker compose -p $Project --env-file $EnvFile -f $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($Arguments -join ' ') failed for $Project." }
}

function Test-ProjectRunning([string]$Project) {
    $containers = docker ps --filter "label=com.docker.compose.project=$Project" -q
    return -not [string]::IsNullOrWhiteSpace(($containers -join ''))
}

function Update-Project([string]$Project, [string]$EnvFile) {
    Invoke-Compose $Project $EnvFile @('pull', '--quiet', 'server', 'worker')
    Invoke-Compose $Project $EnvFile @('up', '-d', '--remove-orphans')
}

function Get-TailscaleExecutable {
    $command = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $defaultPath = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path $defaultPath) { return $defaultPath }
    return $null
}

function Get-BackupDirectory {
    $base = $env:OneDriveCommercial
    if ([string]::IsNullOrWhiteSpace($base)) { $base = $env:OneDrive }
    if ([string]::IsNullOrWhiteSpace($base)) { $base = [Environment]::GetFolderPath('MyDocuments') }
    $directory = Join-Path $base 'Twenty CRM Backups'
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    return $directory
}

function Get-LastRun([string]$Name) {
    $path = Join-Path $StateDirectory "last-$Name.txt"
    if (-not (Test-Path $path)) { return [datetime]::MinValue }
    return [datetime]::Parse((Get-Content $path -Raw).Trim(), [System.Globalization.CultureInfo]::InvariantCulture)
}

function Set-LastRun([string]$Name) {
    New-Item -ItemType Directory -Force -Path $StateDirectory | Out-Null
    Set-Content -Path (Join-Path $StateDirectory "last-$Name.txt") -Value ((Get-Date).ToString('o'))
}

function Test-Due([string]$Name, [timespan]$Interval) {
    return ((Get-Date) - (Get-LastRun $Name)) -ge $Interval
}

function Wait-ForDocker {
    $deadline = (Get-Date) + $DockerStartupWait
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerRunning) { return $true }
        Start-Sleep -Seconds 15
    }
    return (Test-DockerRunning)
}

function Invoke-Update {
    Update-Project $ProdProject $ProdEnvFile
    if (Test-ProjectRunning $DevProject) { Update-Project $DevProject $DevEnvFile }
    Set-LastRun 'update'
}

function Invoke-Backup {
    $directory = Get-BackupDirectory
    $stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
    Invoke-Compose $ProdProject $ProdEnvFile @('exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '-d', 'default', '-Fc', '-f', '/tmp/crm-backup.dump')
    Invoke-Compose $ProdProject $ProdEnvFile @('cp', 'db:/tmp/crm-backup.dump', (Join-Path $directory "crm-database_$stamp.dump"))
    Invoke-Compose $ProdProject $ProdEnvFile @('exec', '-T', 'server', 'tar', 'czf', '/tmp/crm-files.tgz', '-C', '/app/packages/twenty-server', '.local-storage')
    Invoke-Compose $ProdProject $ProdEnvFile @('cp', 'server:/tmp/crm-files.tgz', (Join-Path $directory "crm-files_$stamp.tgz"))
    foreach ($pattern in @('crm-database_*.dump', 'crm-files_*.tgz')) {
        Get-ChildItem $directory -Filter $pattern | Sort-Object Name -Descending | Select-Object -Skip $BackupsToKeep | Remove-Item -Force
    }
    Set-LastRun 'backup'
    Write-Log "Backup saved to $directory"
}

function Register-CrmTasks {
    foreach ($taskName in $LegacyTaskNames) {
        if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        }
    }

    $scriptPath = Join-Path $Root 'crm.ps1'
    # conhost --headless keeps PowerShell from flashing a console window when the task fires
    $action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" maintenance"
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours((Get-Date).Hour + 1) -RepetitionInterval (New-TimeSpan -Hours 1)
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName $MaintenanceTaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

    Write-Log 'Background maintenance scheduled: updates once a week has passed, backups once a day has passed.'
}

switch ($Command) {
    'setup' {
        Assert-DockerRunning
        New-EnvFileIfMissing $ProdEnvFile 'main' $ProdPort
        New-EnvFileIfMissing $DevEnvFile 'main' $DevPort
        Write-Log 'Downloading and starting your CRM. The first start takes a few minutes...'
        Update-Project $ProdProject $ProdEnvFile
        Set-LastRun 'update'
        Register-CrmTasks
        Write-Log "Done. Open http://localhost:$ProdPort to create your login."
    }

    'start' {
        Assert-DockerRunning
        Invoke-Compose $ProdProject $ProdEnvFile @('up', '-d')
        Write-Log "CRM started at http://localhost:$ProdPort"
    }

    'stop' {
        Assert-DockerRunning
        Invoke-Compose $ProdProject $ProdEnvFile @('stop')
        Write-Log 'CRM stopped. Your data is kept.'
    }

    'status' {
        Assert-DockerRunning
        Write-Host "`nProduction ($ProdProject, tag $(Get-EnvValue $ProdEnvFile 'TAG')):"
        Invoke-Compose $ProdProject $ProdEnvFile @('ps')
        if (Test-ProjectRunning $DevProject) {
            Write-Host "`nWorking copy ($DevProject, tag $(Get-EnvValue $DevEnvFile 'TAG')):"
            Invoke-Compose $DevProject $DevEnvFile @('ps')
        }
    }

    'update' {
        Assert-DockerRunning
        Invoke-Update
        Write-Log 'CRM updated to the latest version.'
    }

    'backup' {
        Assert-DockerRunning
        if (-not (Test-ProjectRunning $ProdProject)) { throw 'The CRM is not running, so there is nothing to back up.' }
        Invoke-Backup
    }

    'maintenance' {
        if (-not (Test-Path $ProdEnvFile)) { exit 0 }
        $isBackupDue = Test-Due 'backup' $BackupInterval
        $isUpdateDue = Test-Due 'update' $UpdateInterval
        if (-not ($isBackupDue -or $isUpdateDue)) { exit 0 }
        if (-not (Wait-ForDocker)) { exit 0 }
        if (-not (Test-ProjectRunning $ProdProject)) { exit 0 }
        if ($isBackupDue) {
            try { Invoke-Backup } catch { Write-Log "Backup failed: $($_.Exception.Message)" }
        }
        if ($isUpdateDue) {
            try { Invoke-Update; Write-Log 'Weekly update installed.' } catch { Write-Log "Update failed: $($_.Exception.Message)" }
        }
    }

    'dev' {
        Assert-DockerRunning
        if ([string]::IsNullOrWhiteSpace($Branch)) { throw 'Say which branch to run, for example: .\crm.ps1 dev open-tasks-panel' }
        New-EnvFileIfMissing $DevEnvFile 'main' $DevPort
        Set-EnvValue $DevEnvFile 'TAG' (($Branch -replace '/', '-').ToLower())
        Write-Log "Starting the working copy on branch '$Branch'..."
        Update-Project $DevProject $DevEnvFile
        Write-Log "Working copy running at http://localhost:$DevPort (separate data from production)."
    }

    'dev-stop' {
        Assert-DockerRunning
        Invoke-Compose $DevProject $DevEnvFile @('stop')
        Write-Log 'Working copy stopped. Its data is kept for next time.'
    }

    'phone' {
        Assert-DockerRunning
        $tailscale = Get-TailscaleExecutable
        if ($null -eq $tailscale) { throw 'Tailscale is not installed. Install it from https://tailscale.com/download/windows, sign in, then run this again.' }
        $tailscaleStatus = & $tailscale status --json | ConvertFrom-Json
        $dnsName = $tailscaleStatus.Self.DNSName.TrimEnd('.')
        if ([string]::IsNullOrWhiteSpace($dnsName)) { throw 'Tailscale is not signed in. Open Tailscale, sign in, then run this again.' }

        & $tailscale serve --bg --https=443 "http://127.0.0.1:$ProdPort"
        & $tailscale serve --bg "--https=$DevTailscalePort" "http://127.0.0.1:$DevPort"

        Set-EnvValue $ProdEnvFile 'SERVER_URL' "https://$dnsName"
        Set-EnvValue $DevEnvFile 'SERVER_URL' "https://${dnsName}:$DevTailscalePort"
        Invoke-Compose $ProdProject $ProdEnvFile @('up', '-d')
        if (Test-ProjectRunning $DevProject) { Invoke-Compose $DevProject $DevEnvFile @('up', '-d') }

        Write-Log "Phone access ready. Production: https://$dnsName  Working copy: https://${dnsName}:$DevTailscalePort"
    }

    'logs' {
        Assert-DockerRunning
        Invoke-Compose $ProdProject $ProdEnvFile @('logs', '--tail', '200', 'server', 'worker')
    }
}
