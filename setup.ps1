
$ErrorActionPreference = "Stop"

Write-Host "`n=== ForgeSense Environment Setup ===" -ForegroundColor Cyan

# This script is designed for Windows.
if ($env:OS -ne "Windows_NT") {
    throw "This setup script supports Windows only."
}

# Check for Windows Package Manager.
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget is unavailable. Install App Installer from Microsoft Store."
}

# Install a tool only when it is missing.
$tools = @(
    @{ Name = "Git"; Command = "git"; Package = "Git.Git" },
    @{ Name = "Node.js"; Command = "node"; Package = "OpenJS.NodeJS.LTS" }
)

foreach ($tool in $tools) {
    if (Get-Command $tool.Command -ErrorAction SilentlyContinue) {
        Write-Host "[OK] $($tool.Name) is installed." -ForegroundColor Green
        continue
    }

    Write-Host "[INSTALL] Installing $($tool.Name)..." -ForegroundColor Yellow

    winget install --id $tool.Package --exact `
        --accept-package-agreements --accept-source-agreements

    if ($LASTEXITCODE -ne 0) {
        throw "Installation of $($tool.Name) failed."
    }

    Write-Host "[INFO] Reopen PowerShell if the new installation is not available."
}

# Refresh PATH for this session.
$env:Path = @(
    [Environment]::GetEnvironmentVariable("Path", "Machine")
    [Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

# Verify tools are available.
foreach ($command in @("git", "node", "npm")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command is not available. Reopen PowerShell and rerun setup.ps1."
    }
}

Write-Host "`nGit version:"
git --version

Write-Host "`nNode.js version:"
node --version

Write-Host "`nnpm version:"
npm --version

Write-Host "`n[OK] Prerequisites are ready." -ForegroundColor Green
Write-Host "Next: create package.json and install the web application dependencies."
