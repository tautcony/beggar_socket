# STM32F103C8T6 chis_flash_burner CMake Build Script (PowerShell)
# This script provides convenient commands for building the project with CMake

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("build", "clean", "flash", "status", "help")]
    [string]$Command,

    [Parameter(Position=1)]
    [ValidateSet("bootloader", "app", "legacy", "all")]
    [string]$Target
)

# Project directory
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Colors and symbols - compatible with different PowerShell versions
$Colors = @{
    Red = if ($PSVersionTable.PSVersion.Major -ge 6) { "`e[91m" } else { "" }
    Green = if ($PSVersionTable.PSVersion.Major -ge 6) { "`e[92m" } else { "" }
    Yellow = if ($PSVersionTable.PSVersion.Major -ge 6) { "`e[93m" } else { "" }
    Blue = if ($PSVersionTable.PSVersion.Major -ge 6) { "`e[94m" } else { "" }
    Reset = if ($PSVersionTable.PSVersion.Major -ge 6) { "`e[0m" } else { "" }
}

function Write-Header {
    Write-Host "$($Colors.Blue)=====================================$($Colors.Reset)"
    Write-Host "$($Colors.Blue)STM32F103C8T6 chis_flash_burner$($Colors.Reset)"
    Write-Host "$($Colors.Blue)CMake Build System (PowerShell)$($Colors.Reset)"
    Write-Host "$($Colors.Blue)=====================================$($Colors.Reset)"
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "$($Colors.Green)[OK] $Message$($Colors.Reset)"
}

function Write-Error {
    param([string]$Message)
    Write-Host "$($Colors.Red)[ERROR] $Message$($Colors.Reset)"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "$($Colors.Yellow)[WARN] $Message$($Colors.Reset)"
}

function Write-Info {
    param([string]$Message)
    Write-Host "$($Colors.Blue)[INFO] $Message$($Colors.Reset)"
}

function Test-CMake {
    try {
        $version = cmake --version | Select-String "cmake version" | ForEach-Object { $_.ToString().Split(' ')[2] }
        Write-Info "Using CMake version: $version"
        return $true
    } catch {
        Write-Error "CMake is not installed or not in PATH"
        Write-Info "Please install CMake (version 3.16 or higher):"
        Write-Info "  - Download from: https://cmake.org/download"
        return $false
    }
}

function Test-Toolchain {
    try {
        $version = arm-none-eabi-gcc --version | Select-Object -First 1
        Write-Info "Using toolchain: $version"
        return $true
    } catch {
        Write-Error "ARM toolchain is not installed or not in PATH"
        Write-Info "Please install arm-none-eabi-gcc toolchain:"
        Write-Info "  - Download from: https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads"
        return $false
    }
}

function Test-Ninja {
    try {
        $version = ninja --version
        Write-Info "Using Ninja version: $version"
        return $true
    } catch {
        Write-Error "Ninja is not installed or not in PATH"
        Write-Info "Please install Ninja build system:"
        Write-Info "  - Download from: https://github.com/ninja-build/ninja/releases"
        return $false
    }
}

function Build-Target {
    param([string]$TargetName)

    $buildDir = "build/$TargetName"
    $cmakeOption = switch ($TargetName) {
        "bootloader" { "-DBUILD_BOOTLOADER=ON" }
        "app" { "-DBUILD_APP=ON" }
        "legacy" { "-DBUILD_LEGACY=ON" }
        default {
            Write-Error "Unknown target: $TargetName"
            return $false
        }
    }

    Write-Info "Building $TargetName..."

    # Configure
    Write-Info "Configuring $TargetName with CMake..."
    $toolchainFile = "$ProjectDir\arm-cortex-m.cmake"
    $configureOutput = cmake -B $buildDir $cmakeOption -DCMAKE_BUILD_TYPE=Debug `
        -DCMAKE_TOOLCHAIN_FILE="$toolchainFile" -G "Ninja" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to configure $TargetName"
        Write-Host "Configure output:"
        Write-Host $configureOutput
        return $false
    }

    # Build
    Write-Info "Building $TargetName with CMake..."
    $buildOutput = cmake --build $buildDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build $TargetName"
        Write-Host "Build output:"
        Write-Host $buildOutput
        return $false
    }

    Write-Success "$TargetName built successfully"

    # Show output files
    Write-Host ""
    Write-Info "Output files:"
    Get-ChildItem -Path $buildDir -Recurse -Include "*.elf", "*.hex", "*.bin" | ForEach-Object {
        $size = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  $($_.Name) ($size KB)"
    }

    return $true
}

function Clean-Target {
    param([string]$TargetName)

    if ($TargetName -eq "all" -or $TargetName -eq "") {
        Write-Info "Cleaning all build directories..."
        Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "All build directories cleaned"
    } else {
        $buildDir = "build/$TargetName"
        if (Test-Path $buildDir) {
            Write-Info "Cleaning $TargetName build directory..."
            Remove-Item -Path $buildDir -Recurse -Force
            Write-Success "$TargetName build directory cleaned"
        } else {
            Write-Warning "$TargetName build directory does not exist"
        }
    }
}

function Show-Status {
    Write-Header

    Write-Host "Build Status:"
    Write-Host "============="

    $targets = @("bootloader", "app", "legacy")
    foreach ($target in $targets) {
        $buildDir = "build/$target"
        if (Test-Path $buildDir) {
            $elfFile = Get-ChildItem -Path $buildDir -Recurse -Include "*.elf" | Select-Object -First 1
            if ($elfFile) {
                Write-Success "$target`: Built"
                try {
                    $sizeInfo = arm-none-eabi-size $elfFile.FullName 2>$null | Select-Object -Last 1
                    if ($sizeInfo) {
                        Write-Host "    Size: $sizeInfo"
                    }
                } catch {
                    # Size info not available
                }
            } else {
                Write-Warning "$target`: Configured but not built"
            }
        } else {
            Write-Info "$target`: Not configured"
        }
    }

    Write-Host ""
    Write-Host "Available Files:"
    Write-Host "==============="

    foreach ($target in $targets) {
        $buildDir = "build/$target"
        if (Test-Path $buildDir) {
            $files = Get-ChildItem -Path $buildDir -Recurse -Include "*.elf", "*.hex", "*.bin"
            if ($files) {
                Write-Host "  $target`:"
                $files | ForEach-Object {
                    $size = [math]::Round($_.Length / 1KB, 2)
                    Write-Host "    $($_.Name) ($size KB)"
                }
            }
        }
    }
}

function Flash-Target {
    param([string]$TargetName)

    $buildDir = "build/$TargetName"
    $hexFile = switch ($TargetName) {
        "bootloader" { "$buildDir\bootloader\chis_flash_burner_bootloader.hex" }
        "app" { "$buildDir\app\chis_flash_burner_app.hex" }
        "legacy" { "$buildDir\chis_flash_burner_legacy.hex" }
        default {
            Write-Error "Unknown target: $TargetName"
            return $false
        }
    }

    if (-not (Test-Path $hexFile)) {
        Write-Error "Hex file not found: $hexFile"
        Write-Info "Please build the $TargetName first"
        return $false
    }

    try {
        openocd --version | Out-Null
    } catch {
        Write-Error "OpenOCD is not installed or not in PATH"
        return $false
    }

    Write-Info "Flashing $TargetName..."

    try {
        openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "program $hexFile verify reset exit"
        if ($LASTEXITCODE -ne 0) { throw "Flash failed" }
        Write-Success "$TargetName flashed successfully"
        return $true
    } catch {
        Write-Error "Failed to flash $TargetName"
        return $false
    }
}

function Show-Help {
    Write-Header

    Write-Host "Usage: .\cmake-build.ps1 <command> [target]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build <target>    - Build specified target (bootloader|app|legacy)"
    Write-Host "  clean [target]    - Clean build files (bootloader|app|legacy|all)"
    Write-Host "  flash <target>    - Flash firmware (bootloader|app|legacy)"
    Write-Host "  status            - Show build status and available files"
    Write-Host "  help              - Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\cmake-build.ps1 build bootloader     # Build bootloader"
    Write-Host "  .\cmake-build.ps1 build app            # Build application"
    Write-Host "  .\cmake-build.ps1 build legacy         # Build legacy single image"
    Write-Host "  .\cmake-build.ps1 clean all            # Clean all build directories"
    Write-Host "  .\cmake-build.ps1 flash bootloader     # Flash bootloader"
    Write-Host "  .\cmake-build.ps1 status               # Show current build status"
    Write-Host ""
    Write-Host "Build Targets:"
    Write-Host "  bootloader  - IAP BootLoader (minimal, optimized for size)"
    Write-Host "  app         - Application for IAP (runs after bootloader)"
    Write-Host "  legacy      - Legacy single image (traditional build)"
    Write-Host ""
    Write-Host "Requirements:"
    Write-Host "  - CMake 3.16 or higher"
    Write-Host "  - ARM none-eabi toolchain"
    Write-Host "  - OpenOCD (for flashing)"
}

# Main script logic
Push-Location "$ProjectDir\chis_flash_burner"

try {
    switch ($Command) {
        "build" {
            if (-not $Target) {
                Write-Error "Target required for build command"
                Write-Host "Available targets: bootloader, app, legacy"
                exit 1
            }
            if (-not (Test-CMake)) { exit 1 }
            if (-not (Test-Toolchain)) { exit 1 }
            if (-not (Test-Ninja)) { exit 1 }
            if (-not (Build-Target $Target)) { exit 1 }
        }
        "clean" {
            if (-not $Target) { $Target = "all" }
            Clean-Target $Target
        }
        "flash" {
            if (-not $Target) {
                Write-Error "Target required for flash command"
                Write-Host "Available targets: bootloader, app, legacy"
                exit 1
            }
            if (-not (Flash-Target $Target)) { exit 1 }
        }
        "status" {
            Show-Status
        }
        "help" {
            Show-Help
        }
        default {
            Write-Error "Unknown command: $Command"
            Write-Host ""
            Show-Help
            exit 1
        }
    }
} finally {
    Pop-Location
}
