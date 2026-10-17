# Лаунчер AutoBot: находит Geometry Dash в Steam, ставит Geode и мод-бота, запускает игру.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppId        = 322170
$GeodeFallback = 'v5.11.2'   # если GitHub API недоступен
$ModFile      = 'tymurius.gd-autobot.geode'
$ModUrl       = "https://github.com/tymurius2-arch/jss/releases/download/gd-autobot-latest/$ModFile"
$Root         = Split-Path -Parent $PSScriptRoot

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }

function Get-SteamPath {
    foreach ($key in 'HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam') {
        $item = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($item) {
            foreach ($name in 'SteamPath', 'InstallPath') {
                $value = $item.$name
                if ($value -and (Test-Path $value)) { return ($value -replace '/', '\') }
            }
        }
    }
    $default = Join-Path ${env:ProgramFiles(x86)} 'Steam'
    if (Test-Path $default) { return $default }
    return $null
}

function Get-GDPath($steam) {
    $libraries = @($steam)
    $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
    if (Test-Path $vdf) {
        foreach ($m in [regex]::Matches((Get-Content $vdf -Raw), '"path"\s+"([^"]+)"')) {
            $libraries += ($m.Groups[1].Value -replace '\\\\', '\')
        }
    }
    foreach ($lib in ($libraries | Select-Object -Unique)) {
        $dir = Join-Path $lib 'steamapps\common\Geometry Dash'
        if (Test-Path (Join-Path $dir 'GeometryDash.exe')) { return $dir }
    }
    return $null
}

Say ''
Say '=== Geometry Dash AutoBot ===' 'Cyan'
Say ''

$steam = Get-SteamPath
if (-not $steam) { throw 'Steam не найден. Установите Steam и Geometry Dash.' }
Say "Steam: $steam"

$gd = Get-GDPath $steam
if (-not $gd) { throw 'Geometry Dash не найден в библиотеках Steam. Установите игру через Steam.' }
Say "Geometry Dash: $gd"

# Игра должна быть закрыта, пока ставятся моды.
$running = Get-Process -Name 'GeometryDash' -ErrorAction SilentlyContinue
if ($running) {
    Say 'Geometry Dash уже запущена, перезапускаю её, чтобы загрузить бота...' 'Yellow'
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# 1. Geode — загрузчик модов.
if (-not (Test-Path (Join-Path $gd 'Geode.dll'))) {
    Say ''
    # Берём самую свежую версию Geode: так лаунчер сам подхватит выпуск для новых версий игры (например, 2.209).
    $installerUrl = "https://github.com/geode-sdk/geode/releases/download/$GeodeFallback/geode-installer-$GeodeFallback-win.exe"
    try {
        $release = Invoke-RestMethod -UseBasicParsing -Uri 'https://api.github.com/repos/geode-sdk/geode/releases/latest'
        $asset = $release.assets | Where-Object { $_.name -like 'geode-installer-*-win.exe' } | Select-Object -First 1
        if ($asset) { $installerUrl = $asset.browser_download_url }
    } catch { }
    $installer = Join-Path $env:TEMP (Split-Path -Leaf $installerUrl)
    Say ''
    Say "Geode не установлен. Скачиваю установщик: $(Split-Path -Leaf $installerUrl)" 'Yellow'
    Invoke-WebRequest -UseBasicParsing -Uri $installerUrl -OutFile $installer
    Say 'Откроется установщик Geode. Выберите папку игры (если спросит) и нажмите Install.' 'Yellow'
    Say "Папка игры: $gd" 'Yellow'
    Start-Process -FilePath $installer -Wait
    if (-not (Test-Path (Join-Path $gd 'Geode.dll'))) {
        throw 'Geode так и не появился в папке игры. Установите его вручную с https://geode-sdk.org и запустите лаунчер снова.'
    }
}
Say 'Geode: установлен' 'Green'

# 2. Мод-бот: свежая сборка рядом с лаунчером, иначе скачиваем из релиза на GitHub.
$mods = Join-Path $gd 'geode\mods'
New-Item -ItemType Directory -Force -Path $mods | Out-Null
$local = Get-ChildItem -Path $Root -Recurse -Filter $ModFile -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($local) {
    Copy-Item $local.FullName (Join-Path $mods $ModFile) -Force
    Say "Бот: установлен из $($local.FullName)" 'Green'
} else {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $ModUrl -OutFile (Join-Path $mods $ModFile)
        Say 'Бот: скачан последний релиз' 'Green'
    } catch {
        if (Test-Path (Join-Path $mods $ModFile)) {
            Say 'Не удалось скачать обновление, оставляю уже установленную версию бота.' 'Yellow'
        } else {
            throw "Не удалось скачать мод: $ModUrl. Скачайте $ModFile из раздела Releases (или Actions) и положите рядом с лаунчером."
        }
    }
}

# 3. Запуск через Steam.
Say ''
Say 'Запускаю Geometry Dash...' 'Cyan'
Start-Process "steam://rungameid/$AppId"
Say 'Готово. Откройте уровень и нажмите кнопку Bot рядом с Play (или Bot в меню паузы).' 'Green'
Say 'Статус бота виден в левом верхнем углу уровня. Настройки: Geode -> AutoBot -> Settings.'
