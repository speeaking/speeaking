param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
# tsx puede heredar PSModulePath de PowerShell 7: carga los módulos del intérprete actual.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1')
$localAccountsModule = Get-ChildItem -LiteralPath (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.LocalAccounts') -Filter 'Microsoft.PowerShell.LocalAccounts.dll' -Recurse | Select-Object -First 1
if (-not $localAccountsModule) { throw 'Windows account security module unavailable.' }
Import-Module $localAccountsModule.FullName
$workspace = [System.IO.Path]::GetFullPath((Get-Location).ProviderPath)
$expected = Join-Path $workspace '.data\editorial-automation'
$target = [System.IO.Path]::GetFullPath($Directory)
if ($target -ne $expected) { throw 'Credential directory outside the intended workspace.' }
New-Item -ItemType Directory -Path $target -Force | Out-Null
$security = Get-Acl -LiteralPath $target
$security.SetAccessRuleProtection($true, $false)
foreach ($oldRule in @($security.Access)) { $security.RemoveAccessRuleSpecific($oldRule) }
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$workspaceOwner = (Get-Acl -LiteralPath $workspace).Owner
$ownerSid = ([System.Security.Principal.NTAccount]$workspaceOwner).Translate([System.Security.Principal.SecurityIdentifier])
$identities = @($currentSid, $ownerSid, [System.Security.Principal.SecurityIdentifier]'S-1-5-18')
# Los procesos de Codex usan cuentas locales separadas. Solo ellas y el dueño leen la credencial.
$identities += @(Get-LocalUser | Where-Object { $_.Name -like 'CodexSandbox*' } | ForEach-Object { $_.SID })
foreach ($identity in ($identities | Sort-Object Value -Unique)) {
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $security.AddAccessRule($rule)
}
# Persiste solo las secciones modificadas de la DACL, sin solicitar permisos sobre la SACL.
$directoryInfo = New-Object System.IO.DirectoryInfo($target)
$directoryInfo.SetAccessControl($security)
