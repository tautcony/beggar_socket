# STM32F103C8T6 chis_flash_burner CMake Build Script (PowerShell)
# This script provides convenient commands for building the project with CMake

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("build", "clean", "flash", "status", "erase-flash", "mass-erase", "help")]
    [string]$Command,

    [Parameter(Position=1)]
    [ValidateSet("Debug", "Release", "all")]
    [string]$BuildType
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
    Write-Host "$($Colors.Blue)=================================$($Colors.Reset)"
    Write-Host "$($Colors.Blue)STM32F103C8T6 chis_flash_burner$($Colors.Reset)"
    Write-Host "$($Colors.Blue)CMake Build System$($Colors.Reset)"
    Write-Host "$($Colors.Blue)=================================$($Colors.Reset)"
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
        Write-Info "Please install CMake (version 3.16 or higher)"
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
        Write-Info "Please install arm-none-eabi-gcc toolchain"
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

function Build-Project {
    param([string]$BuildType = "Debug")

    # Validate build type
    if ($BuildType -notin @("Debug", "Release")) {
        Write-Error "Invalid build type: $BuildType"
        Write-Info "Valid build types: Debug, Release"
        return $false
    }

    $buildDir = "build/$BuildType"

    Write-Info "Building chis_flash_burner in $BuildType mode..."

    # Configure
    Write-Info "Configuring project with CMake..."
    $toolchainFile = "$ProjectDir\arm-cortex-m.cmake"
    $configureOutput = cmake -B $buildDir -DCMAKE_BUILD_TYPE=$BuildType `
        -DCMAKE_TOOLCHAIN_FILE="$toolchainFile" -G "Ninja" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to configure project"
        Write-Host "Configure output:"
        Write-Host $configureOutput
        return $false
    }

    # Build
    Write-Info "Building project with CMake..."
    $buildOutput = cmake --build $buildDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build project"
        Write-Host "Build output:"
        Write-Host $buildOutput
        return $false
    }

    Write-Success "Project built successfully in $BuildType mode"

    # Show output files
    Write-Host ""
    Write-Info "Output files:"
    Get-ChildItem -Path $buildDir -Recurse -Include "*.elf", "*.hex", "*.bin" | ForEach-Object {
        $size = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  $($_.Name) ($size KB)"
    }

    return $true
}

function Clean-Project {
    param([string]$BuildType)

    if ($BuildType -eq "all" -or $BuildType -eq "") {
        Write-Info "Cleaning all build directories..."
        Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "All build directories cleaned"
    } else {
        $buildDir = "build/$BuildType"
        if (Test-Path $buildDir) {
            Write-Info "Cleaning $BuildType build directory..."
            Remove-Item -Path $buildDir -Recurse -Force
            Write-Success "$BuildType build directory cleaned"
        } else {
            Write-Warning "$BuildType build directory does not exist"
        }
    }
}

function Show-Status {
    Write-Header

    Write-Host "Build Status:"
    Write-Host "============="

    $statusFound = $false
    
    # Check both Debug and Release builds
    foreach ($buildType in @("Debug", "Release")) {
        $buildDir = "build/$buildType"
        if (Test-Path $buildDir) {
            $elfFile = Get-ChildItem -Path $buildDir -Recurse -Include "*.elf" | Select-Object -First 1
            if ($elfFile) {
                Write-Success "chis_flash_burner ($buildType): Built"
                try {
                    $sizeInfo = arm-none-eabi-size $elfFile.FullName 2>$null | Select-Object -Last 1
                    if ($sizeInfo) {
                        Write-Host "    Size: $sizeInfo"
                    }
                } catch {
                    # Size info not available
                }
                $statusFound = $true
            } else {
                Write-Warning "chis_flash_burner ($buildType): Configured but not built"
                $statusFound = $true
            }
        }
    }
    
    if (-not $statusFound) {
        Write-Info "chis_flash_burner: Not configured"
    }

    Write-Host ""
    Write-Host "Available Files:"
    Write-Host "==============="

    $filesFound = $false
    
    foreach ($buildType in @("Debug", "Release")) {
        $buildDir = "build/$buildType"
        if (Test-Path $buildDir) {
            $files = Get-ChildItem -Path $buildDir -Recurse -Include "*.elf", "*.hex", "*.bin"
            if ($files) {
                if (-not $filesFound) {
                    Write-Host "  chis_flash_burner:"
                    $filesFound = $true
                }
                Write-Host "    $buildType`:"
                $files | ForEach-Object {
                    $size = [math]::Round($_.Length / 1KB, 2)
                    Write-Host "      $($_.Name) ($size KB)"
                }
            }
        }
    }

    if (-not $filesFound) {
        Write-Info "No build files found. Run 'build Debug' or 'build Release' first."
    }
}

function Flash-Project {
    param([string]$BuildType = "")

    $buildDir = ""
    $hexFile = ""

    # Find the hex file - try specific build type first, then search all available
    if ($BuildType) {
        $buildDir = "build/$BuildType"
    } else {
        # Try to find the most recent build (prefer Release, then Debug)
        foreach ($bt in @("Release", "Debug")) {
            $testDir = "build/$bt"
            if ((Test-Path $testDir) -and (Get-ChildItem -Path $testDir -Recurse -Include "*.hex")) {
                $buildDir = $testDir
                $BuildType = $bt
                break
            }
        }
    }

    if (-not $buildDir) {
        Write-Error "No build directory found"
        Write-Info "Please build the project first: .\cmake-build.ps1 build [Debug|Release]"
        return $false
    }

    $hexFile = "$buildDir\chis_flash_burner.hex"

    if (-not (Test-Path $hexFile)) {
        Write-Error "Hex file not found: $hexFile"
        if ($BuildType) {
            Write-Info "Please build the project in $BuildType mode first: .\cmake-build.ps1 build $BuildType"
        } else {
            Write-Info "Please build the project first: .\cmake-build.ps1 build"
        }
        return $false
    }

    try {
        openocd --version | Out-Null
    } catch {
        Write-Error "OpenOCD is not installed or not in PATH"
        return $false
    }

    if ($BuildType) {
        Write-Info "Flashing chis_flash_burner ($BuildType mode)..."
    } else {
        Write-Info "Flashing chis_flash_burner..."
    }

    # Standard programming
    try {
        openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "program $hexFile verify reset exit"
        if ($LASTEXITCODE -ne 0) { throw "Flash failed" }
        Write-Success "chis_flash_burner flashed successfully"
        Write-Info "Device should now be running the new firmware"
        return $true
    } catch {
        Write-Error "Failed to flash firmware"
        return $false
    }
}

# Erase entire flash function
function Erase-Flash {
    try {
        openocd --version | Out-Null
    } catch {
        Write-Error "OpenOCD is not installed or not in PATH"
        return $false
    }

    Write-Warning "This will COMPLETELY ERASE the entire STM32 Flash memory!"
    Write-Warning "All firmware will be removed."
    $confirmation = Read-Host "Are you sure you want to continue? (yes/no)"

    if ($confirmation -ne "yes") {
        Write-Info "Operation cancelled"
        return $true
    }

    Write-Info "Erasing entire Flash memory..."

    # Use OpenOCD to erase the entire flash
    try {
        openocd -f interface/stlink.cfg -f target/stm32f1x.cfg `
            -c "init" `
            -c "reset halt" `
            -c "flash info 0" `
            -c "flash erase_sector 0 0 63" `
            -c "reset run" `
            -c "exit"
        if ($LASTEXITCODE -ne 0) { throw "Erase failed" }
        Write-Success "Flash memory erased successfully"
        Write-Info "Device is now blank - you need to flash firmware"
        return $true
    } catch {
        Write-Error "Failed to erase flash memory"
        return $false
    }
}

# Mass erase flash function (alternative method)
function Mass-Erase-Flash {
    try {
        openocd --version | Out-Null
    } catch {
        Write-Error "OpenOCD is not installed or not in PATH"
        return $false
    }

    Write-Warning "This will perform a MASS ERASE of the STM32 Flash!"
    Write-Warning "All data including firmware and option bytes will be reset."
    $confirmation = Read-Host "Are you sure you want to continue? (yes/no)"

    if ($confirmation -ne "yes") {
        Write-Info "Operation cancelled"
        return $true
    }

    Write-Info "Performing mass erase..."

    # Use OpenOCD mass erase command
    try {
        openocd -f interface/stlink.cfg -f target/stm32f1x.cfg `
            -c "init" `
            -c "reset halt" `
            -c "stm32f1x mass_erase 0" `
            -c "reset run" `
            -c "exit"
        if ($LASTEXITCODE -ne 0) { throw "Mass erase failed" }
        Write-Success "Mass erase completed successfully"
        Write-Info "Device is completely blank - option bytes have been reset"
        Write-Info "You need to flash firmware"
        return $true
    } catch {
        Write-Error "Failed to perform mass erase"
        return $false
    }
}

function Show-Help {
    Write-Header

    Write-Host "Usage: .\cmake-build.ps1 <command> [build_type]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build [build_type]      - Build chis_flash_burner project"
    Write-Host "  clean [build_type|all]  - Clean build files"
    Write-Host "  flash [build_type]      - Flash firmware to device"
    Write-Host "  status                  - Show build status and available files"
    Write-Host "  erase-flash             - Erase entire flash memory (WARNING: removes everything)"
    Write-Host "  mass-erase              - Mass erase flash including option bytes (DANGEROUS)"
    Write-Host "  help                    - Show this help message"
    Write-Host ""
    Write-Host "Build Types:"
    Write-Host "  Debug     - Debug build with symbols and debug information (default)"
    Write-Host "  Release   - Release build with optimizations"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\cmake-build.ps1 build                        # Build in Debug mode (default)"
    Write-Host "  .\cmake-build.ps1 build Debug                  # Build in Debug mode"
    Write-Host "  .\cmake-build.ps1 build Release                # Build in Release mode"
    Write-Host "  .\cmake-build.ps1 clean all                    # Clean all build directories"
    Write-Host "  .\cmake-build.ps1 clean Debug                  # Clean only Debug build"
    Write-Host "  .\cmake-build.ps1 flash                        # Flash latest build (auto-detect)"
    Write-Host "  .\cmake-build.ps1 flash Release                # Flash Release version"
    Write-Host "  .\cmake-build.ps1 erase-flash                  # Completely erase flash memory"
    Write-Host "  .\cmake-build.ps1 mass-erase                   # Mass erase (resets option bytes too)"
    Write-Host "  .\cmake-build.ps1 status                       # Show current build status"
    Write-Host ""
    Write-Host "Requirements:"
    Write-Host "  - CMake 3.16 or higher"
    Write-Host "  - ARM none-eabi toolchain (gcc-arm-none-eabi)"
    Write-Host "  - Ninja build system"
    Write-Host "  - OpenOCD (for flashing)"
    Write-Host "  - ST-Link programmer/debugger"
    Write-Host ""
    Write-Host "Flash Erase Commands:"
    Write-Host "  erase-flash   - Sector erase (0x08000000-0x0800FFFF, preserves option bytes)"
    Write-Host "  mass-erase    - Complete chip erase including option bytes (factory reset)"
    Write-Host ""
    Write-Host "WARNING: Both erase commands will remove ALL firmware from the device!"
    Write-Host "   Use these commands only when:"
    Write-Host "   - Device is completely unresponsive"
    Write-Host "   - You want to start fresh with a blank device"
    Write-Host "   - Troubleshooting firmware issues"
    Write-Host ""
    Write-Host "After erasing, you must flash firmware to use the device."
}

# Main script logic
Push-Location "$ProjectDir\chis_flash_burner"

try {
    switch ($Command) {
        "build" {
            if (-not (Test-CMake)) { exit 1 }
            if (-not (Test-Toolchain)) { exit 1 }
            if (-not (Test-Ninja)) { exit 1 }
            if (-not (Build-Project $BuildType)) { exit 1 }
        }
        "clean" {
            if (-not $BuildType) { $BuildType = "all" }
            Clean-Project $BuildType
        }
        "flash" {
            if (-not (Flash-Project $BuildType)) { exit 1 }
        }
        "erase-flash" {
            if (-not (Erase-Flash)) { exit 1 }
        }
        "mass-erase" {
            if (-not (Mass-Erase-Flash)) { exit 1 }
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
