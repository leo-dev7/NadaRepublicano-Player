$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "Nada Republicano Player.lnk"
$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ElectronPath = Join-Path $ProjectDir "node_modules\electron\dist\electron.exe"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ElectronPath
$Shortcut.Arguments = "."
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = "Nada Republicano Player - LMS Local & MPC Companion"
if (Test-Path $ElectronPath) {
    $Shortcut.IconLocation = "$ElectronPath,0"
}
$Shortcut.Save()

Write-Host "Atalho atualizado com sucesso na Area de Trabalho: $ShortcutPath"

