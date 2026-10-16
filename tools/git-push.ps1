<#
.SYNOPSIS
    推送当前分支到远端，自动挑选可用的网络路径（直连 / 系统代理 / 常见本地代理端口）。

.DESCRIPTION
    在 Windows 上，本仓库的 HTTPS 推送会遇到三个已确认的坑，本脚本逐一规避：

      1. `.git/config` 里可能存在空值代理键 `http.https://github.com.proxy=`。
         空值语义是「对 github.com 明确不使用代理」，且其优先级高于 HTTPS_PROXY 等
         环境变量——直接把连接钉死成直连。本脚本用 `git -c` 针对单次调用注入代理，
         不读写 `.git/config`，因此不会留下需要回滚的持久改动。

      2. `Get-NetTCPConnection -LocalPort` 在本机对部分确实处于 LISTENING 的端口漏报，
         改用 `netstat -ano` 判定端口占用。

      3. `& git $args` 在参数含 `=` 时会把 `-c` 吞掉，导致代理根本没注入却仍报连接失败。
         必须用数组展开 `& $gitExe @gitExeArgs`。

    探测方式（2026-10-15 修正，重要）：**不要用 curl.exe 做探测**。curl 走 Windows Schannel，
    在受限环境（沙箱、作业对象受限的 CI 等）下会因 `AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS`
    而对**所有** HTTPS 目标返回 000——即便网络完全正常（实测同一时刻 node 的 fetch 返回
    200、git ls-remote 也成功）。用它探测会让脚本永远报「没有可用路径」。
    现在改为：**用与 push 完全相同的 `-c` 参数执行 `git ls-remote`** 作为唯一判据——
    探测通过 ≈ push 能通。代价是某个候选不通时要等 git 自身的连接超时（实测约 21 秒）。

    本脚本只负责「选路径」，不负责创造连通性：若直连与所有候选代理都不通，
    它会以退出码 1 结束并说明原因，而不是反复重试。

    执行策略：RemoteSigned（Windows 常见默认值）允许运行本地未签名脚本。若你的环境仍然
    提示「未对文件进行数字签名」，请改用 `tools\git-push.cmd`，或显式调用
    `powershell -NoProfile -ExecutionPolicy Bypass -File tools\git-push.ps1`。

.PARAMETER Remote
    远端名，默认 origin。

.PARAMETER Branch
    要推送的分支，默认当前分支（detached HEAD 时必须显式指定）。

.PARAMETER DryRun
    只探测并打印将要执行的命令，不真正推送。

.EXAMPLE
    tools\git-push.cmd -DryRun
    探测当前网络下哪条路径可用，但不推送。

.EXAMPLE
    tools\git-push.cmd
    探测并推送当前分支。
#>
[CmdletBinding()]
param(
    [string]$Remote = 'origin',
    [string]$Branch = '',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Write-Step { param([string]$Message) Write-Host "[git-push] $Message" }
function Write-Note { param([string]$Message) Write-Warning "[git-push] $Message" }

# --- 0. 定位 git.exe ----------------------------------------------------------
$gitExe = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
if (-not $gitExe) { $gitExe = (Get-Command git -ErrorAction Stop).Source }

# --- 1. 确定分支 --------------------------------------------------------------
if (-not $Branch) {
    $Branch = (& $gitExe rev-parse --abbrev-ref HEAD | Out-String).Trim()
}
if ([string]::IsNullOrWhiteSpace($Branch) -or $Branch -eq 'HEAD') {
    throw '当前处于 detached HEAD，无法推断分支名，请用 -Branch 显式指定。'
}

# --- 2. 远端地址与主机名 ------------------------------------------------------
# 主机名用于构造 git 的按 URL 代理键 `http.<url>.proxy`。该键必须与远端主机匹配，
# 否则注入了也不生效（例如拿 github.com 的键去访问别的 git 主机）。
$remoteUrl = (& $gitExe remote get-url $Remote 2>$null | Out-String).Trim()
$remoteHost = 'github.com'
if ($remoteUrl -match '^https?://([^/:]+)') { $remoteHost = $Matches[1] }

# --- 3. 探测工具 --------------------------------------------------------------
function Test-RemoteReachable {
    param([string]$ProxyUrl)
    # 与 push 用同一套参数，探测通过 ≈ push 能通。
    #
    # 两处刻意为之：
    #  · 不设 http.lowSpeedLimit / lowSpeedTime —— 门槛设成 1000 B/s 时，慢速但完全可用的连接会被
    #    误判成“太慢”而中止（fatal: Operation too slow ... last 10 seconds）。
    #  · 不做 TCP 预筛 —— 实测本机链路波动明显（同一进程内 2.5s 连不上、8s 也连不上，另一时刻
    #    git 自己却能通），TCP 探测的可靠性并不高于 git，多一层反而多一个误杀源。
    #    代价是候选不通时要等 git 自身的连接超时（实测约 21 秒/候选）。
    $probeArgs = @()
    if ($ProxyUrl) { $probeArgs += @('-c', "http.https://$remoteHost.proxy=$ProxyUrl") }
    $probeArgs += @('ls-remote', '--heads', $Remote)
    & $gitExe @probeArgs 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Test-PortListening {
    param([int]$Port)
    # 不用 Get-NetTCPConnection：本机实测对部分监听端口漏报。
    $hit = netstat -ano | Select-String -Pattern (':' + $Port + '\s.*LISTENING')
    return [bool]$hit
}

function Get-SystemProxyUrl {
    try {
        $reg = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction Stop
        if ($reg.ProxyEnable -eq 1 -and $reg.ProxyServer) {
            $server = [string]$reg.ProxyServer
            if ($server -notmatch '://') { $server = 'http://' + $server }
            return $server
        }
    } catch { }
    return $null
}

# --- 4. 组装候选链：直连 → 系统代理 → 常见本地代理端口 -------------------------
$candidates = New-Object System.Collections.Generic.List[object]
$candidates.Add([pscustomobject]@{ Name = '直连'; Url = $null })

$sysProxy = Get-SystemProxyUrl
if ($sysProxy) {
    $candidates.Add([pscustomobject]@{ Name = '系统代理注册表'; Url = $sysProxy })
}

foreach ($port in 7890, 7897, 7891, 10809, 10808, 1080, 8888, 20171) {
    if (Test-PortListening -Port $port) {
        $candidates.Add([pscustomobject]@{ Name = "本地代理端口 $port"; Url = "http://127.0.0.1:$port" })
    }
}

# 去重：系统代理常常就是某个本地端口（实测两者同为 127.0.0.1:7890），
# 不去重会对同一目标白跑一次 git ls-remote。
$seen = New-Object System.Collections.Generic.HashSet[string]
$unique = New-Object System.Collections.Generic.List[object]
foreach ($c in $candidates) {
    $key = if ($c.Url) { $c.Url.ToLowerInvariant() } else { '(direct)' }
    if ($seen.Add($key)) { $unique.Add($c) }
}
$candidates = $unique

Write-Step "远端 $Remote ($remoteUrl)，分支 $Branch"
Write-Step "候选路径 $($candidates.Count) 条，逐条用 git ls-remote 验证"

$chosen = $null
foreach ($c in $candidates) {
    $label = if ($c.Url) { $c.Url } else { '(直连)' }

    if (Test-RemoteReachable -ProxyUrl $c.Url) {
        Write-Step "  [可用] $($c.Name) -> $label"
        $chosen = $c
        break
    }
    Write-Step "  [不通] $($c.Name) -> $label"
}

if (-not $chosen) {
    Write-Note '没有可用路径：直连与所有候选代理都无法完成 git ls-remote。'
    Write-Note '常见原因：代理软件未运行，或已在运行但节点不可用（端口 LISTENING 也可能连不通）。'
    Write-Note '本脚本不能创造连通性，请先恢复网络后再重试。'
    exit 1
}

# --- 5. 推送 ------------------------------------------------------------------
$gitExeArgs = @()
if ($chosen.Url) {
    $gitExeArgs += @('-c', "http.https://$remoteHost.proxy=$($chosen.Url)")
}
$gitExeArgs += @('push', $Remote, $Branch)

Write-Step ('执行：git ' + ($gitExeArgs -join ' '))
if ($DryRun) {
    Write-Step '（-DryRun：已选定路径，但未实际推送）'
    exit 0
}

# 关键：用数组展开 @gitExeArgs。写成 `& $gitExe $gitExeArgs` 会让 `-c` 在含 `=` 时被吞掉。
#
# 捕获输出是为了识别认证类失败，但期间必须把 ErrorActionPreference 放回 Continue：
# 本脚本开头设了 Stop，而 `2>&1` 会把 git 写到 stderr 的内容变成 ErrorRecord，
# 于是任何一条 stderr 都会被当成终止性错误抛出（症状：At git-push.ps1:NNN 报 NativeCommandError）。
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$pushOutput = (& $gitExe @gitExeArgs 2>&1 | Out-String)
$pushCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap
Write-Host $pushOutput.TrimEnd()

# 区分「路径不通」与「认证失败」：探测阶段跑的是 git ls-remote，而公开仓库的 ls-remote
# 不需要认证——能走到这里就说明路径是通的。所以 push 失败时若输出带认证特征，必须给出
# 针对性提示，否则用户会误判为网络问题，去反复折腾代理。
if ($pushCode -ne 0) {
    if ($pushOutput -match "could not read Username|Authentication failed|terminal prompts disabled|failed to execute prompt script|couldn't create signal pipe") {
        $helper = (& $gitExe config --get credential.helper | Out-String).Trim()
        Write-Note 'push 失败看起来是【认证】问题，不是网络路径问题。'
        Write-Note "本机 credential.helper = [$helper]（Git Credential Manager），它在受限环境（沙箱 /"
        Write-Note '无交互终端）下可能无法启动，典型症状是 sh.exe "couldn''t create signal pipe" 或 "could not read Username"。'
        Write-Note '处理办法：在常规终端里手动执行一次 git push 完成凭据录入，之后本脚本会复用已保存的凭据。'
    }
}

exit $pushCode
