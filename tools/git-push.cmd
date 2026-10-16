@echo off
REM ---------------------------------------------------------------------------
REM git-push.cmd - wrapper for tools\git-push.ps1
REM
REM Why this wrapper exists:
REM   Some Windows environments refuse to run a local unsigned .ps1 even when the
REM   effective execution policy reports RemoteSigned (observed in this checkout).
REM   This wrapper always passes -ExecutionPolicy Bypass to the child process, so
REM   the script runs regardless of that difference.
REM
REM Usage:
REM   tools\git-push.cmd                    probe and push the current branch
REM   tools\git-push.cmd -DryRun            probe only, do not push
REM   tools\git-push.cmd -Branch main       push a specific branch
REM   tools\git-push.cmd -ProbeUrl https://www.baidu.com -DryRun
REM                                         probe against another target (self-test)
REM ---------------------------------------------------------------------------
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-push.ps1" %*
exit /b %ERRORLEVEL%
