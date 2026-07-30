[CmdletBinding()]
param(
  [Parameter()]
  [string]$InstallerPath,

  [Parameter()]
  [string]$LogDirectory = "test-results\desktop-installer"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $IsWindows) {
  throw "The Verto installer smoke is Windows-only."
}
if ($env:GITHUB_ACTIONS -ne "true" -or $env:CI -ne "true") {
  throw "Refusing to install the production Verto MSI outside a clean GitHub Actions runner."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$logDirectorySegments = @($LogDirectory -split "[\\/]")
if (
  [System.IO.Path]::IsPathRooted($LogDirectory) -or
  $logDirectorySegments -contains ".."
) {
  throw "LogDirectory must be a relative path beneath the repository."
}
$logs = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $LogDirectory))
$relativeLogs = [System.IO.Path]::GetRelativePath($repoRoot, $logs)
if (
  $relativeLogs -eq ".." -or
  $relativeLogs.StartsWith("..$([System.IO.Path]::DirectorySeparatorChar)") -or
  [System.IO.Path]::IsPathRooted($relativeLogs)
) {
  throw "LogDirectory escapes the repository."
}
New-Item -ItemType Directory -Force -Path $logs | Out-Null

if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
  $bundleRoot = Join-Path $repoRoot "src-tauri\target\release\bundle\msi"
  $installer = Get-ChildItem -LiteralPath $bundleRoot -Filter "*.msi" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if ($null -eq $installer) {
    throw "No MSI installer was found under $bundleRoot. Run npm run package:local first."
  }
  $InstallerPath = $installer.FullName
}

$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
if ([System.IO.Path]::GetExtension($resolvedInstaller) -ne ".msi") {
  throw "InstallerPath must identify an MSI file."
}

$installLog = Join-Path $logs "msi-install.log"
$uninstallLog = Join-Path $logs "msi-uninstall.log"
$installAttempted = $false
$installed = $false
$installedExecutable = $null
$installedDirectory = $null
$smokeExercised = $false
$preservedFiles = @()
$profileSentinels = @()
$runError = $null
$teardownErrors = [System.Collections.Generic.List[System.Exception]]::new()

function Invoke-MsiExec {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $process = Start-Process `
    -FilePath "msiexec.exe" `
    -ArgumentList $Arguments `
    -PassThru `
    -Wait `
    -WindowStyle Hidden

  if ($process.ExitCode -ne 0) {
    throw "msiexec exited with code $($process.ExitCode); reboot-required results are not accepted by this clean-runner gate."
  }
}

function Get-MsiProductCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $installer = $null
  $database = $null
  $view = $null
  $record = $null
  try {
    $installer = New-Object -ComObject WindowsInstaller.Installer
    $database = $installer.GetType().InvokeMember(
      "OpenDatabase",
      "InvokeMethod",
      $null,
      $installer,
      @($Path, 0)
    )
    $query = "SELECT ``Value`` FROM ``Property`` WHERE ``Property`` = 'ProductCode'"
    $view = $database.GetType().InvokeMember(
      "OpenView",
      "InvokeMethod",
      $null,
      $database,
      @($query)
    )
    $null = $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, @())
    $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, @())
    if ($null -eq $record) {
      throw "The MSI does not define a ProductCode."
    }
    $productCode = [string]$record.GetType().InvokeMember(
      "StringData",
      "GetProperty",
      $null,
      $record,
      @(1)
    )
  }
  finally {
    foreach ($comObject in @($record, $view, $database, $installer)) {
      if ($null -ne $comObject -and [System.Runtime.InteropServices.Marshal]::IsComObject($comObject)) {
        $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($comObject)
      }
    }
  }

  if (
    $productCode -notmatch
    "^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$"
  ) {
    throw "The MSI ProductCode is not a valid braced GUID."
  }
  return $productCode.ToUpperInvariant()
}

function Get-MsiExecutableComponentId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $installer = $null
  $database = $null
  $fileView = $null
  $componentView = $null
  $record = $null
  try {
    $installer = New-Object -ComObject WindowsInstaller.Installer
    $database = $installer.GetType().InvokeMember(
      "OpenDatabase",
      "InvokeMethod",
      $null,
      $installer,
      @($Path, 0)
    )
    $fileView = $database.GetType().InvokeMember(
      "OpenView",
      "InvokeMethod",
      $null,
      $database,
      @("SELECT ``Component_``, ``FileName`` FROM ``File``")
    )
    $null = $fileView.GetType().InvokeMember(
      "Execute",
      "InvokeMethod",
      $null,
      $fileView,
      @()
    )
    $componentName = $null
    while (
      $null -ne (
        $record = $fileView.GetType().InvokeMember(
          "Fetch",
          "InvokeMethod",
          $null,
          $fileView,
          @()
        )
      )
    ) {
      $fileName = [string]$record.GetType().InvokeMember(
        "StringData",
        "GetProperty",
        $null,
        $record,
        @(2)
      )
      $longFileName = ($fileName -split "\|")[-1]
      if ($longFileName -eq "verto.exe") {
        $componentName = [string]$record.GetType().InvokeMember(
          "StringData",
          "GetProperty",
          $null,
          $record,
          @(1)
        )
      }
      $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($record)
      $record = $null
    }
    if ([string]::IsNullOrWhiteSpace($componentName)) {
      throw "The MSI does not contain the Verto executable."
    }

    $componentView = $database.GetType().InvokeMember(
      "OpenView",
      "InvokeMethod",
      $null,
      $database,
      @("SELECT ``Component``, ``ComponentId`` FROM ``Component``")
    )
    $null = $componentView.GetType().InvokeMember(
      "Execute",
      "InvokeMethod",
      $null,
      $componentView,
      @()
    )
    $componentId = $null
    while (
      $null -ne (
        $record = $componentView.GetType().InvokeMember(
          "Fetch",
          "InvokeMethod",
          $null,
          $componentView,
          @()
        )
      )
    ) {
      $candidateName = [string]$record.GetType().InvokeMember(
        "StringData",
        "GetProperty",
        $null,
        $record,
        @(1)
      )
      if ($candidateName -ceq $componentName) {
        $componentId = [string]$record.GetType().InvokeMember(
          "StringData",
          "GetProperty",
          $null,
          $record,
          @(2)
        )
      }
      $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($record)
      $record = $null
    }
  }
  finally {
    foreach ($comObject in @($record, $componentView, $fileView, $database, $installer)) {
      if ($null -ne $comObject -and [System.Runtime.InteropServices.Marshal]::IsComObject($comObject)) {
        $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($comObject)
      }
    }
  }

  if (
    $componentId -notmatch
    "^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$"
  ) {
    throw "The Verto executable component does not have a valid component GUID."
  }
  return $componentId.ToUpperInvariant()
}

function Get-UninstallEntries {
  $registryPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )

  return @(
    foreach ($registryPath in $registryPaths) {
      Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue
    }
  )
}

function Get-OptionalProperty {
  param(
    [Parameter()]
    $InputObject,

    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if ($null -eq $InputObject) {
    return $null
  }
  $property = $InputObject.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }
  return $property.Value
}

function Test-EntryProductCode {
  param(
    [Parameter(Mandatory = $true)]
    $Entry,

    [Parameter(Mandatory = $true)]
    [string]$ProductCode
  )

  $registryKey = [string](Get-OptionalProperty -InputObject $Entry -Name "PSChildName")
  $entryProductCode = [string](Get-OptionalProperty -InputObject $Entry -Name "ProductCode")
  return (
    $registryKey.Equals($ProductCode, [System.StringComparison]::OrdinalIgnoreCase) -or
    $entryProductCode.Equals($ProductCode, [System.StringComparison]::OrdinalIgnoreCase)
  )
}

function Get-ExactProductEntry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProductCode
  )

  return @(
    Get-UninstallEntries | Where-Object {
      Test-EntryProductCode -Entry $_ -ProductCode $ProductCode
    }
  ) | Select-Object -First 1
}

function Get-ExistingVertoEntries {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProductCode
  )

  return @(
    Get-UninstallEntries | Where-Object {
      $displayName = [string](Get-OptionalProperty -InputObject $_ -Name "DisplayName")
      $displayName -eq "Verto" -or (Test-EntryProductCode -Entry $_ -ProductCode $ProductCode)
    }
  )
}

function Get-InstalledVertoExecutable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProductCode,

    [Parameter(Mandatory = $true)]
    [string]$ComponentId
  )

  $installer = $null
  try {
    $installer = New-Object -ComObject WindowsInstaller.Installer
    $componentPath = [string]$installer.GetType().InvokeMember(
      "ComponentPath",
      "GetProperty",
      $null,
      $installer,
      @($ProductCode, $ComponentId)
    )
  }
  finally {
    if ($null -ne $installer -and [System.Runtime.InteropServices.Marshal]::IsComObject($installer)) {
      $null = [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer)
    }
  }

  if (
    [System.IO.Path]::GetExtension($componentPath) -eq ".exe" -and
    (Test-Path -LiteralPath $componentPath -PathType Leaf)
  ) {
    return (Resolve-Path -LiteralPath $componentPath).Path
  }
  return $null
}

function Test-ExactChildPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Base,

    [Parameter(Mandatory = $true)]
    [string]$Candidate,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedLeaf
  )

  $fullBase = [System.IO.Path]::GetFullPath($Base).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar
  )
  $fullCandidate = [System.IO.Path]::GetFullPath($Candidate)
  $parent = [System.IO.Path]::GetDirectoryName($fullCandidate).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar
  )
  $leaf = [System.IO.Path]::GetFileName($fullCandidate)
  return (
    $parent.Equals($fullBase, [System.StringComparison]::OrdinalIgnoreCase) -and
    $leaf -ceq $ExpectedLeaf
  )
}

function Remove-VerifiedIsolationRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Base,

    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [string]$RunId,

    [Parameter(Mandatory = $true)]
    [string]$MarkerContent
  )

  if (-not (Test-ExactChildPath -Base $Base -Candidate $Root -ExpectedLeaf $RunId)) {
    throw "Refusing to remove an installer smoke path outside its fixed temporary base."
  }
  if (-not (Test-Path -LiteralPath $Root)) {
    return
  }

  $rootItem = Get-Item -LiteralPath $Root -Force
  if (
    -not $rootItem.PSIsContainer -or
    ($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
  ) {
    throw "Refusing to remove an installer smoke root that is not a real directory."
  }
  $markerPath = Join-Path $Root ".verto-installer-smoke-root"
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw "Refusing to remove an unmarked installer smoke root."
  }
  if ((Get-Content -LiteralPath $markerPath -Raw) -cne $MarkerContent) {
    throw "Refusing to remove an installer smoke root with an invalid marker."
  }

  Remove-Item -LiteralPath $Root -Recurse -Force
}

function Remove-VerifiedNativeSmokeProfile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Base,

    [Parameter(Mandatory = $true)]
    [string]$Profile,

    [Parameter(Mandatory = $true)]
    [string]$Identifier,

    [Parameter(Mandatory = $true)]
    [string]$MarkerContent
  )

  if (-not (Test-ExactChildPath -Base $Base -Candidate $Profile -ExpectedLeaf $Identifier)) {
    throw "Refusing to remove a native profile outside its exact Known Folder identifier."
  }
  if (-not (Test-Path -LiteralPath $Profile)) {
    return
  }

  $profileItem = Get-Item -LiteralPath $Profile -Force
  if (
    -not $profileItem.PSIsContainer -or
    ($profileItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
  ) {
    throw "Refusing to remove a native smoke profile that is not a real directory."
  }
  $markerPath = Join-Path $Profile ".verto-desktop-smoke-root"
  if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw "Refusing to remove an unmarked native smoke profile."
  }
  if ((Get-Content -LiteralPath $markerPath -Raw) -cne $MarkerContent) {
    throw "Refusing to remove a native smoke profile with an invalid marker."
  }

  Remove-Item -LiteralPath $Profile -Recurse -Force
}

function Invoke-InstalledDesktopSmoke {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,

    [Parameter(Mandatory = $true)]
    [string]$RunId,

    [Parameter(Mandatory = $true)]
    [string]$TempDirectory,

    [Parameter(Mandatory = $true)]
    [string]$ProfileDirectory
  )

  # setup-node and the runner image can both expose npm.cmd. Select one
  # CommandInfo before reading Source so PowerShell does not join both paths.
  $npm = (
    Get-Command "npm.cmd" -CommandType Application |
      Select-Object -First 1
  ).Source
  $environment = @{
    TEMP                                           = $TempDirectory
    TMP                                            = $TempDirectory
    USERPROFILE                                    = $ProfileDirectory
    VERTO_DESKTOP_APP_BINARY                       = $Executable
    VERTO_DESKTOP_SMOKE                            = "1"
    VERTO_DESKTOP_SMOKE_RUN_ID                     = $RunId
    VERTO_DESKTOP_SMOKE_APP_IDENTIFIER             = "com.tsaiggo.verto"
    VERTO_DESKTOP_SMOKE_ALLOW_PRODUCTION_PROFILE   = "1"
    VERTO_DESKTOP_SMOKE_DEFER_CLEANUP              = "1"
  }
  $previousValues = @{}
  foreach ($name in $Environment.Keys) {
    $previousValues[$name] = [System.Environment]::GetEnvironmentVariable($name, "Process")
    [System.Environment]::SetEnvironmentVariable(
      $name,
      [string]$Environment[$name],
      "Process"
    )
  }
  try {
    & $npm run test:desktop
    if ($LASTEXITCODE -ne 0) {
      throw "Installed-product WebDriver smoke exited with code $LASTEXITCODE."
    }
  }
  finally {
    foreach ($name in $Environment.Keys) {
      [System.Environment]::SetEnvironmentVariable(
        $name,
        $previousValues[$name],
        "Process"
      )
    }
  }
}

$productCode = Get-MsiProductCode -Path $resolvedInstaller
$executableComponentId = Get-MsiExecutableComponentId -Path $resolvedInstaller
$existingVerto = @(Get-ExistingVertoEntries -ProductCode $productCode)
if ($existingVerto.Count -gt 0) {
  $descriptions = $existingVerto | ForEach-Object {
    $name = [string](Get-OptionalProperty -InputObject $_ -Name "DisplayName")
    $key = [string](Get-OptionalProperty -InputObject $_ -Name "PSChildName")
    "$name [$key]"
  }
  throw "Refusing to run while a Verto installation already exists: $($descriptions -join ', ')"
}

# Tauri and WebView2 resolve Windows Known Folders directly. An installer
# launch is therefore restricted to a disposable CI user and must also begin
# without a pre-existing production profile.
$roamingKnownFolder = [System.IO.Path]::GetFullPath($env:APPDATA)
$localKnownFolder = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA)
$productionProfiles = @(
  [pscustomobject]@{
    Base = $roamingKnownFolder
    Path = Join-Path $roamingKnownFolder "com.tsaiggo.verto"
  },
  [pscustomobject]@{
    Base = $localKnownFolder
    Path = Join-Path $localKnownFolder "com.tsaiggo.verto"
  }
)
foreach ($profile in $productionProfiles) {
  if (Test-Path -LiteralPath $profile.Path) {
    throw "Refusing to run while a production Verto profile already exists: $($profile.Path)"
  }
}

$isolationBase = [System.IO.Path]::GetFullPath(
  (Join-Path ([System.IO.Path]::GetTempPath()) "verto-desktop-installer-smoke")
)
$isolationRunId = [System.Guid]::NewGuid().ToString("N")
$isolationRoot = [System.IO.Path]::GetFullPath((Join-Path $isolationBase $isolationRunId))
if (
  -not (
    Test-ExactChildPath `
      -Base $isolationBase `
      -Candidate $isolationRoot `
      -ExpectedLeaf $isolationRunId
  )
) {
  throw "Could not create a validated installer smoke isolation root."
}
$isolationMarker = "verto-installer-smoke:$isolationRunId"
$desktopSmokeProfileMarker =
  "verto-desktop-smoke-native:com.tsaiggo.verto:$isolationRunId`n"

try {
  New-Item -ItemType Directory -Force -Path $isolationBase | Out-Null
  New-Item -ItemType Directory -Path $isolationRoot | Out-Null
  Set-Content `
    -LiteralPath (Join-Path $isolationRoot ".verto-installer-smoke-root") `
    -Value $isolationMarker `
    -NoNewline

  $isolatedProfile = New-Item -ItemType Directory -Path (Join-Path $isolationRoot "profile")
  $isolatedTemp = New-Item -ItemType Directory -Path (Join-Path $isolationRoot "temp")

  Write-Host "Installing unsigned Verto MSI with ProductCode $productCode"
  $installAttempted = $true
  Invoke-MsiExec -Arguments @(
    "/i",
    "`"$resolvedInstaller`"",
    "/qn",
    "/norestart",
    "/l*v",
    "`"$installLog`""
  )
  $installed = $true

  $exactProductEntry = Get-ExactProductEntry -ProductCode $productCode
  if ($null -eq $exactProductEntry) {
    throw "The MSI completed, but its exact ProductCode was not registered."
  }
  $installedExecutable = Get-InstalledVertoExecutable `
    -ProductCode $productCode `
    -ComponentId $executableComponentId
  if ($null -eq $installedExecutable) {
    throw "The exact MSI product was registered, but its executable could not be located."
  }
  $installedDirectory = Split-Path -Parent $installedExecutable

  $installedExecutable | Set-Content -LiteralPath (Join-Path $logs "installed-executable.txt")
  $productCode | Set-Content -LiteralPath (Join-Path $logs "installed-product-code.txt")
  $executableComponentId |
    Set-Content -LiteralPath (Join-Path $logs "installed-executable-component.txt")
  Write-Host "Running the full desktop vault smoke against exact installed executable."
  Invoke-InstalledDesktopSmoke `
    -Executable $installedExecutable `
    -RunId $isolationRunId `
    -TempDirectory $isolatedTemp.FullName `
    -ProfileDirectory $isolatedProfile.FullName

  # Leave product data in place across uninstall so this gate can prove that
  # the uninstaller removes binaries without deleting a user's Vault or
  # profile. Cleanup happens only after those assertions.
  foreach ($profile in $productionProfiles) {
    $markerPath = Join-Path $profile.Path ".verto-desktop-smoke-root"
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
      throw "The desktop smoke did not leave its owned native profile marker at $markerPath."
    }
    if ((Get-Content -LiteralPath $markerPath -Raw) -cne $desktopSmokeProfileMarker) {
      throw "The desktop smoke native profile marker changed before uninstall."
    }
    $sentinelPath = Join-Path $profile.Path ".verto-uninstall-preservation-sentinel"
    $sentinelContent = "preserve-profile:${isolationRunId}:$($profile.Path)"
    Set-Content -LiteralPath $sentinelPath -Value $sentinelContent -NoNewline
    $profileSentinels += [pscustomobject]@{
      Path = $sentinelPath
      Content = $sentinelContent
    }
  }

  $smokeVault = Join-Path `
    $isolatedTemp.FullName `
    "verto-desktop-smoke\$isolationRunId\vault"
  $preservedFiles = @(
    [pscustomobject]@{
      Label = "edited Markdown document"
      Path = Join-Path $smokeVault "desktop-smoke-note.md"
    },
    [pscustomobject]@{
      Label = "portable bookmark state"
      Path = Join-Path $smokeVault ".verto\bookmarks.json"
    }
  )
  foreach ($artifact in $preservedFiles) {
    if (-not (Test-Path -LiteralPath $artifact.Path -PathType Leaf)) {
      throw "The desktop smoke did not produce its $($artifact.Label) at $($artifact.Path)."
    }
    $artifact | Add-Member `
      -NotePropertyName Hash `
      -NotePropertyValue (Get-FileHash -LiteralPath $artifact.Path -Algorithm SHA256).Hash
  }
  $smokeExercised = $true
}
catch {
  $runError = $_.Exception
}
finally {
  try {
    $exactProductEntry = Get-ExactProductEntry -ProductCode $productCode
    if ($installed -or ($installAttempted -and $null -ne $exactProductEntry)) {
      Write-Host "Uninstalling exact MSI ProductCode $productCode"
      Invoke-MsiExec -Arguments @(
        "/x",
        $productCode,
        "/qn",
        "/norestart",
        "/l*v",
        "`"$uninstallLog`""
      )
      if ($null -ne (Get-ExactProductEntry -ProductCode $productCode)) {
        throw "The exact MSI ProductCode remains registered after uninstall."
      }
      if (
        $null -ne $installedExecutable -and
        (Test-Path -LiteralPath $installedExecutable -PathType Leaf)
      ) {
        throw "The exact installed executable remains after uninstall: $installedExecutable"
      }
      if (
        $null -ne $installedDirectory -and
        (Test-Path -LiteralPath $installedDirectory -PathType Container)
      ) {
        $remainingInstalledFiles = @(
          Get-ChildItem -LiteralPath $installedDirectory -Force -Recurse -File
        )
        if ($remainingInstalledFiles.Count -gt 0) {
          throw (
            "The MSI installation directory still contains files after uninstall: " +
            ($remainingInstalledFiles.FullName -join ", ")
          )
        }
      }
    }
  }
  catch {
    $teardownErrors.Add($_.Exception)
  }

  if ($smokeExercised) {
    try {
      foreach ($sentinel in $profileSentinels) {
        if (-not (Test-Path -LiteralPath $sentinel.Path -PathType Leaf)) {
          throw "Uninstall removed the native profile sentinel: $($sentinel.Path)"
        }
        if ((Get-Content -LiteralPath $sentinel.Path -Raw) -cne $sentinel.Content) {
          throw "Uninstall changed the native profile sentinel: $($sentinel.Path)"
        }
      }
      foreach ($artifact in $preservedFiles) {
        if (-not (Test-Path -LiteralPath $artifact.Path -PathType Leaf)) {
          throw "Uninstall removed the $($artifact.Label): $($artifact.Path)"
        }
        $actualHash = (Get-FileHash -LiteralPath $artifact.Path -Algorithm SHA256).Hash
        if ($actualHash -cne $artifact.Hash) {
          throw "Uninstall changed the $($artifact.Label): $($artifact.Path)"
        }
      }
    }
    catch {
      $teardownErrors.Add($_.Exception)
    }
  }

  foreach ($profile in $productionProfiles) {
    try {
      Remove-VerifiedNativeSmokeProfile `
        -Base $profile.Base `
        -Profile $profile.Path `
        -Identifier "com.tsaiggo.verto" `
        -MarkerContent $desktopSmokeProfileMarker
    }
    catch {
      $teardownErrors.Add($_.Exception)
    }
  }

  try {
    Remove-VerifiedIsolationRoot `
      -Base $isolationBase `
      -Root $isolationRoot `
      -RunId $isolationRunId `
      -MarkerContent $isolationMarker
  }
  catch {
    $teardownErrors.Add($_.Exception)
  }
}

$allErrors = [System.Collections.Generic.List[System.Exception]]::new()
if ($null -ne $runError) {
  $allErrors.Add($runError)
}
foreach ($teardownError in $teardownErrors) {
  $allErrors.Add($teardownError)
}
if ($allErrors.Count -eq 1) {
  throw $allErrors[0]
}
if ($allErrors.Count -gt 1) {
  throw [System.AggregateException]::new(
    "Verto installer smoke failed and one or more teardown operations also failed.",
    $allErrors
  )
}

Write-Host "Verto MSI install, WebDriver exercise, and exact-ProductCode uninstall smoke passed."
