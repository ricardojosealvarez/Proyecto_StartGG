param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('start', 'status', 'migrate')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $projectRoot '.postgres-data'
$envPath = Join-Path $projectRoot '.env.local'
$postgresRoot = Get-ChildItem -LiteralPath 'C:\Program Files\PostgreSQL' -Directory |
  Sort-Object { [int]($_.Name -split '\.')[0] } -Descending |
  Select-Object -First 1

if (-not $postgresRoot) {
  throw 'No se encontró PostgreSQL en C:\Program Files\PostgreSQL.'
}

$postgresBin = Join-Path $postgresRoot.FullName 'bin'
$postgresExecutable = Join-Path $postgresBin 'postgres.exe'
$readyExecutable = Join-Path $postgresBin 'pg_isready.exe'
$psqlExecutable = Join-Path $postgresBin 'psql.exe'
$hostName = '127.0.0.1'
$port = 55432

function Test-DatabaseReady {
  & $readyExecutable -h $hostName -p $port -t 1 *> $null
  return $LASTEXITCODE -eq 0
}

function Get-DatabaseUri([string]$variableName) {
  if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Falta .env.local. Inicializa primero la base de datos.'
  }

  $prefix = "$variableName="
  $line = Get-Content -LiteralPath $envPath |
    Where-Object { $_.StartsWith($prefix) } |
    Select-Object -First 1

  if (-not $line) {
    throw "Falta $variableName en .env.local."
  }

  return [Uri]$line.Substring($prefix.Length)
}

switch ($Action) {
  'start' {
    if (Test-DatabaseReady) {
      Write-Output 'PostgreSQL ya está iniciado.'
      break
    }

    if (-not (Test-Path -LiteralPath $dataPath)) {
      throw 'Falta el clúster local .postgres-data.'
    }

    Start-Process `
      -FilePath $postgresExecutable `
      -ArgumentList @('-D', $dataPath, '-h', $hostName, '-p', $port) `
      -WorkingDirectory $projectRoot `
      -WindowStyle Hidden | Out-Null

    for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
      if (Test-DatabaseReady) {
        Write-Output 'PostgreSQL iniciado en 127.0.0.1:55432.'
        break
      }

      Start-Sleep -Milliseconds 500
    }

    if (-not (Test-DatabaseReady)) {
      throw 'PostgreSQL no respondió después del arranque.'
    }
  }

  'status' {
    if (Test-DatabaseReady) {
      Write-Output 'PostgreSQL está aceptando conexiones en 127.0.0.1:55432.'
      break
    }

    throw 'PostgreSQL no está disponible en 127.0.0.1:55432.'
  }

  'migrate' {
    if (-not (Test-DatabaseReady)) {
      throw 'PostgreSQL no está iniciado. Ejecuta npm run db:start.'
    }

    $databaseUri = Get-DatabaseUri 'DATABASE_ADMIN_URL'
    $credentials = $databaseUri.UserInfo.Split(':', 2)
    $env:PGPASSWORD = $credentials[1]
    $databaseName = $databaseUri.AbsolutePath.TrimStart('/')
    $migrationPath = Join-Path $projectRoot 'database\migrations'
    $migrations = Get-ChildItem -LiteralPath $migrationPath -Filter '*.sql' -File |
      Sort-Object Name
    $connectionArguments = @(
      '-h', $databaseUri.Host,
      '-p', $databaseUri.Port,
      '-U', $credentials[0],
      '-d', $databaseName,
      '-v', 'ON_ERROR_STOP=1'
    )

    & $psqlExecutable @connectionArguments -c @'
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
'@

    if ($LASTEXITCODE -ne 0) {
      throw 'No se pudo preparar el registro de migraciones.'
    }

    $appliedCount = 0

    foreach ($migration in $migrations) {
      $migrationName = $migration.Name.Replace("'", "''")
      $isApplied = & $psqlExecutable @connectionArguments -Atc `
        "SELECT 1 FROM schema_migrations WHERE name = '$migrationName';"

      if ($isApplied -eq '1') {
        continue
      }

      & $psqlExecutable @connectionArguments -f $migration.FullName

      if ($LASTEXITCODE -ne 0) {
        throw "Falló la migración $($migration.Name)."
      }

      & $psqlExecutable @connectionArguments -c `
        "INSERT INTO schema_migrations (name) VALUES ('$migrationName');"

      if ($LASTEXITCODE -ne 0) {
        throw "No se pudo registrar la migración $($migration.Name)."
      }

      $appliedCount += 1
    }

    Write-Output "$appliedCount migración(es) nueva(s) aplicada(s)."
  }
}
