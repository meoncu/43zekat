# 43Zekat Baglantisi ve Baslaticisi
$port = 4300
$projectDir = $PSScriptRoot

Clear-Host
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "       43ZEKAT UYGULAMA MERKEZI" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Mevcut Portlari Temizle (Hem 4300 hem 3000)
Write-Host "[1/3] Portlar kontrol ediliyor..." -ForegroundColor Gray
$portsToClean = @(4300, 3000)
foreach ($p in $portsToClean) {
    $processLine = netstat -ano | findstr ":$p" | findstr "LISTENING"
    if ($processLine) {
        foreach ($line in $processLine) {
            if ($line.Trim() -ne "") {
                $parts = $line.Trim().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
                $pidToKill = $parts[-1]
                try {
                    Write-Host "Port $p temizleniyor (PID: $pidToKill)..." -ForegroundColor Yellow
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
                catch { }
            }
        }
    }
}
Start-Sleep -Seconds 1

# 2. Masaustu Kisayolu
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "43Zekat.lnk"

Write-Host "[2/3] Masaustu kisayolu guncelleniyor..." -ForegroundColor Gray
try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$projectDir\start-app.ps1`""
    $Shortcut.WorkingDirectory = $projectDir
    $Shortcut.Save()
    Write-Host "Kisayol guncellendi." -ForegroundColor Green
}
catch {
    Write-Host "Kisayol hatasi: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Uygulamayi Baslat
Write-Host "[3/3] Uygulama baslatiliyor: http://localhost:$port" -ForegroundColor Green
Write-Host "------------------------------------------" -ForegroundColor Cyan

# Tarayıcıyı 10 saniye sonra aç (Derleme süresi için daha uzun süre)
Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Seconds 12
    Start-Process $u
} -ArgumentList "http://localhost:4300" | Out-Null

try {
    # Doğrudan npx kullanarak portu ve webpack'i zorluyoruz
    npx next dev --webpack -p $port
}
catch {
    Write-Host "HATA: Uygulama baslatilamadi!" -ForegroundColor Red
    Write-Host "$($_.Exception.Message)"
    Read-Host "Kapatmak icin Enter..."
}
