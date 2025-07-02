#!/bin/bash

##########################################################################################################################
# STM32F103C8T6 chis_flash_burner CMake Build Script
# This script provides convenient commands for building the project with CMake
##########################################################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}STM32F103C8T6 chis_flash_burner${NC}"
    echo -e "${BLUE}CMake Build System${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if cmake is available
check_cmake() {
    if ! command -v cmake &> /dev/null; then
        print_error "CMake is not installed or not in PATH"
        print_info "Please install CMake (version 3.16 or higher)"
        exit 1
    fi

    CMAKE_VERSION=$(cmake --version | head -n1 | cut -d' ' -f3)
    print_info "Using CMake version: $CMAKE_VERSION"
}

# Check if ARM toolchain is available
check_toolchain() {
    if ! command -v arm-none-eabi-gcc &> /dev/null; then
        print_error "ARM toolchain is not installed or not in PATH"
        print_info "Please install arm-none-eabi-gcc toolchain"
        exit 1
    fi

    GCC_VERSION=$(arm-none-eabi-gcc --version | head -n1)
    print_info "Using toolchain: $GCC_VERSION"
}

# Build function
build_target() {
    local target=$1
    local build_type=${2:-Debug}  # Default to Debug if not specified
    local build_dir="build/${target}_${build_type}"
    local cmake_option=""

    case $target in
        "bootloader")
            cmake_option="-DBUILD_BOOTLOADER=ON"
            ;;
        "app")
            cmake_option="-DBUILD_APP=ON"
            ;;
        "legacy")
            cmake_option="-DBUILD_LEGACY=ON"
            ;;
        *)
            print_error "Unknown target: $target"
            return 1
            ;;
    esac

    # Validate build type
    case $build_type in
        "Debug"|"Release")
            ;;
        *)
            print_error "Invalid build type: $build_type"
            print_info "Valid build types: Debug, Release"
            return 1
            ;;
    esac

    print_info "Building $target in $build_type mode..."

    # Configure
    if ! cmake -B "$build_dir" $cmake_option -DCMAKE_BUILD_TYPE=$build_type; then
        print_error "Failed to configure $target"
        return 1
    fi

    # Build
    if ! cmake --build "$build_dir"; then
        print_error "Failed to build $target"
        return 1
    fi

    print_success "$target built successfully in $build_type mode"

    # Show output files
    echo
    print_info "Output files:"
    find "$build_dir" -name "*.elf" -o -name "*.hex" -o -name "*.bin" | while read -r file; do
        if [[ -f "$file" ]]; then
            size=$(du -h "$file" | cut -f1)
            echo "  $(basename "$file") ($size)"
        fi
    done
}

# Clean function
clean_target() {
    local target=$1
    local build_type=$2

    if [[ "$target" == "all" ]]; then
        print_info "Cleaning all build directories..."
        rm -rf build/
        print_success "All build directories cleaned"
    else
        if [[ -n "$build_type" ]]; then
            # Clean specific target and build type
            local build_dir="build/${target}_${build_type}"
            if [[ -d "$build_dir" ]]; then
                print_info "Cleaning $target ($build_type) build directory..."
                rm -rf "$build_dir"
                print_success "$target ($build_type) build directory cleaned"
            else
                print_warning "$target ($build_type) build directory does not exist"
            fi
        else
            # Clean all build types for the target
            local found_any=false
            for bt in Debug Release; do
                local build_dir="build/${target}_${bt}"
                if [[ -d "$build_dir" ]]; then
                    print_info "Cleaning $target ($bt) build directory..."
                    rm -rf "$build_dir"
                    print_success "$target ($bt) build directory cleaned"
                    found_any=true
                fi
            done
            
            # Also clean old format (without build type suffix) for compatibility
            local old_build_dir="build/$target"
            if [[ -d "$old_build_dir" ]]; then
                print_info "Cleaning legacy $target build directory..."
                rm -rf "$old_build_dir"
                print_success "Legacy $target build directory cleaned"
                found_any=true
            fi
            
            if [[ "$found_any" == "false" ]]; then
                print_warning "No $target build directories found"
            fi
        fi
    fi
}

# Status function
show_status() {
    print_header

    echo "Build Status:"
    echo "============="

    for target in bootloader app legacy; do
        local target_found=false
        
        # Check both Debug and Release builds
        for build_type in Debug Release; do
            build_dir="build/${target}_${build_type}"
            if [[ -d "$build_dir" ]]; then
                elf_file=$(find "$build_dir" -name "*.elf" | head -n1)
                if [[ -f "$elf_file" ]]; then
                    size_info=$(arm-none-eabi-size "$elf_file" 2>/dev/null | tail -n1 || echo "N/A")
                    print_success "$target ($build_type): Built"
                    if [[ "$size_info" != "N/A" ]]; then
                        echo "    Size: $size_info"
                    fi
                    target_found=true
                else
                    print_warning "$target ($build_type): Configured but not built"
                    target_found=true
                fi
            fi
        done
        
        # Check legacy build format for compatibility
        build_dir="build/$target"
        if [[ -d "$build_dir" ]]; then
            elf_file=$(find "$build_dir" -name "*.elf" | head -n1)
            if [[ -f "$elf_file" ]]; then
                size_info=$(arm-none-eabi-size "$elf_file" 2>/dev/null | tail -n1 || echo "N/A")
                print_success "$target (legacy): Built"
                if [[ "$size_info" != "N/A" ]]; then
                    echo "    Size: $size_info"
                fi
                target_found=true
            else
                print_warning "$target (legacy): Configured but not built"
                target_found=true
            fi
        fi
        
        if [[ "$target_found" == "false" ]]; then
            print_info "$target: Not configured"
        fi
    done

    echo
    echo "Available Files:"
    echo "==============="

    for target in bootloader app legacy; do
        local files_found=false
        
        # Check both Debug and Release builds
        for build_type in Debug Release; do
            build_dir="build/${target}_${build_type}"
            if [[ -d "$build_dir" ]]; then
                local target_files=()
                while IFS= read -r -d '' file; do
                    target_files+=("$file")
                done < <(find "$build_dir" -name "*.elf" -o -name "*.hex" -o -name "*.bin" -print0 2>/dev/null)
                
                if [[ ${#target_files[@]} -gt 0 ]]; then
                    if [[ "$files_found" == "false" ]]; then
                        echo "  $target:"
                        files_found=true
                    fi
                    echo "    $build_type:"
                    for file in "${target_files[@]}"; do
                        if [[ -f "$file" ]]; then
                            size=$(du -h "$file" | cut -f1)
                            echo "      $(basename "$file") ($size)"
                        fi
                    done
                fi
            fi
        done
        
        # Check legacy build format
        build_dir="build/$target"
        if [[ -d "$build_dir" ]]; then
            local target_files=()
            while IFS= read -r -d '' file; do
                target_files+=("$file")
            done < <(find "$build_dir" -name "*.elf" -o -name "*.hex" -o -name "*.bin" -print0 2>/dev/null)
            
            if [[ ${#target_files[@]} -gt 0 ]]; then
                if [[ "$files_found" == "false" ]]; then
                    echo "  $target:"
                    files_found=true
                fi
                echo "    legacy:"
                for file in "${target_files[@]}"; do
                    if [[ -f "$file" ]]; then
                        size=$(du -h "$file" | cut -f1)
                        echo "      $(basename "$file") ($size)"
                    fi
                done
            fi
        fi
    done
}

# Flash function
flash_target() {
    local target=$1
    local build_type=${2:-""}
    local build_dir=""
    local hex_file=""

    # Find the hex file - try specific build type first, then search all available
    if [[ -n "$build_type" ]]; then
        build_dir="build/${target}_${build_type}"
    else
        # Try to find the most recent build (prefer Release, then Debug, then legacy)
        for bt in Release Debug; do
            test_dir="build/${target}_${bt}"
            if [[ -d "$test_dir" ]] && find "$test_dir" -name "*.hex" -type f | grep -q .; then
                build_dir="$test_dir"
                build_type="$bt"
                break
            fi
        done
        
        # Fallback to legacy format
        if [[ -z "$build_dir" ]]; then
            test_dir="build/$target"
            if [[ -d "$test_dir" ]] && find "$test_dir" -name "*.hex" -type f | grep -q .; then
                build_dir="$test_dir"
                build_type="legacy"
            fi
        fi
    fi

    case $target in
        "bootloader")
            if [[ "$build_type" == "legacy" ]]; then
                hex_file="$build_dir/chis_flash_burner_bootloader.hex"
            else
                hex_file="$build_dir/bootloader/chis_flash_burner_bootloader.hex"
            fi
            ;;
        "app")
            if [[ "$build_type" == "legacy" ]]; then
                hex_file="$build_dir/chis_flash_burner_app.hex"
            else
                hex_file="$build_dir/app/chis_flash_burner_app.hex"
            fi
            ;;
        "legacy")
            hex_file="$build_dir/chis_flash_burner_legacy.hex"
            ;;
        *)
            print_error "Unknown target: $target"
            return 1
            ;;
    esac

    if [[ ! -f "$hex_file" ]]; then
        print_error "Hex file not found: $hex_file"
        if [[ -n "$build_type" && "$build_type" != "legacy" ]]; then
            print_info "Please build the $target in $build_type mode first: $0 build $target $build_type"
        else
            print_info "Please build the $target first: $0 build $target"
        fi
        return 1
    fi

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    if [[ -n "$build_type" && "$build_type" != "legacy" ]]; then
        print_info "Flashing $target ($build_type mode)..."
    else
        print_info "Flashing $target..."
    fi

    # Special handling for app to avoid erasing bootloader
    if [[ "$target" == "app" ]]; then
        print_warning "Flashing app while preserving bootloader..."
        print_info "This will write to app region: 0x08006000-0x0800FFFF"

        # Use a more specific OpenOCD command for app to preserve bootloader
        # The hex file already contains the correct addresses, so don't specify offset
        if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
            -c "init" \
            -c "reset halt" \
            -c "flash info 0" \
            -c "flash write_image erase $hex_file" \
            -c "verify_image $hex_file" \
            -c "reset run" \
            -c "exit"; then
            print_success "$target flashed successfully"
            print_info "Device should now boot to bootloader and jump to app"
        else
            print_error "Failed to flash $target"
            print_warning "Consider using 'flash-app-safe' command instead"
            return 1
        fi
    else
        # Standard programming for bootloader and legacy
        if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
            -c "program $hex_file verify reset exit"; then
            print_success "$target flashed successfully"
        else
            print_error "Failed to flash $target"
            return 1
        fi
    fi
}

# Erase entire flash function
erase_flash() {
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_warning "This will COMPLETELY ERASE the entire STM32 Flash memory!"
    print_warning "Both bootloader and application will be removed."
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r confirmation

    if [[ "$confirmation" != "yes" ]]; then
        print_info "Operation cancelled"
        return 0
    fi

    print_info "Erasing entire Flash memory..."

    # Use OpenOCD to erase the entire flash
    if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
        -c "init" \
        -c "reset halt" \
        -c "flash info 0" \
        -c "flash erase_sector 0 0 63" \
        -c "reset run" \
        -c "exit"; then
        print_success "Flash memory erased successfully"
        print_info "Device is now blank - you need to flash bootloader and/or app"
    else
        print_error "Failed to erase flash memory"
        return 1
    fi
}

# Mass erase flash function (alternative method)
mass_erase_flash() {
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_warning "This will perform a MASS ERASE of the STM32 Flash!"
    print_warning "All data including bootloader, application, and option bytes will be reset."
    echo -n "Are you sure you want to continue? (yes/no): "
    read -r confirmation

    if [[ "$confirmation" != "yes" ]]; then
        print_info "Operation cancelled"
        return 0
    fi

    print_info "Performing mass erase..."

    # Use OpenOCD mass erase command
    if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
        -c "init" \
        -c "reset halt" \
        -c "stm32f1x mass_erase 0" \
        -c "reset run" \
        -c "exit"; then
        print_success "Mass erase completed successfully"
        print_info "Device is completely blank - option bytes have been reset"
        print_info "You need to flash bootloader and/or app"
    else
        print_error "Failed to perform mass erase"
        return 1
    fi
}

# Advanced device diagnostics


# Help function
show_help() {
    print_header

    echo "Usage: $0 <command> [target] [build_type]"
    echo
    echo "Commands:"
    echo "  build <target> [build_type]  - Build specified target (bootloader|app|legacy)"
    echo "  clean [target] [build_type]  - Clean build files (bootloader|app|legacy|all)"
    echo "  flash <target> [build_type]  - Flash firmware (bootloader|app|legacy)"
    echo "  status                       - Show build status and available files"
    echo "  check-device                 - Check device running status (bootloader/app/crashed)"
    echo "  diagnose-device              - Advanced device diagnostics (registers, clocks, GPIO, USB)"
    echo "  check-fault                  - Analyze fault conditions and crash state"
    echo "  erase-flash                  - Erase entire flash memory (WARNING: removes everything)"
    echo "  mass-erase                   - Mass erase flash including option bytes (DANGEROUS)"
    echo "  help                         - Show this help message"
    echo
    echo "Build Types:"
    echo "  Debug     - Debug build with optimization disabled and debug symbols (default)"
    echo "  Release   - Release build with optimization enabled and debug symbols removed"
    echo
    echo "Examples:"
    echo "  $0 build bootloader Debug       # Build bootloader in debug mode"
    echo "  $0 build app Release            # Build application in release mode"
    echo "  $0 build legacy                 # Build legacy single image (defaults to Debug)"
    echo "  $0 clean all                    # Clean all build directories"
    echo "  $0 clean app Debug              # Clean only app debug build"
    echo "  $0 clean app                    # Clean all app builds (Debug and Release)"
    echo "  $0 flash bootloader Release     # Flash release version of bootloader"
    echo "  $0 flash app                    # Flash app (auto-detects latest build)"
    echo "  $0 check-device                 # Quick device status check"
    echo "  $0 diagnose-device              # Advanced diagnostics for troubleshooting"
    echo "  $0 check-fault                  # Analyze fault conditions if device crashed"
    echo "  $0 erase-flash                  # Completely erase flash memory"
    echo "  $0 mass-erase                   # Mass erase (resets option bytes too)"
    echo "  $0 status                       # Show current build status"
    echo
    echo "Build Targets:"
    echo "  bootloader  - IAP BootLoader (minimal, optimized for size)"
    echo "  app         - Application for IAP (runs after bootloader)"
    echo "  legacy      - Legacy single image (traditional build)"
    echo
    echo "Build Types:"
    echo "  Debug       - Debug build with symbols, no optimization (default)"
    echo "              - Larger size, easier debugging, slower execution"
    echo "  Release     - Release build with optimization, no debug symbols"
    echo "              - Smaller size, harder debugging, faster execution"
    echo
    echo "Requirements:"
    echo "  - CMake 3.16 or higher"
    echo "  - ARM none-eabi toolchain"
    echo "  - OpenOCD (for flashing)"
    echo
    echo "Flash Erase Commands:"
    echo "  erase-flash   - Sector erase (0x08000000-0x0800FFFF, preserves option bytes)"
    echo "  mass-erase    - Complete chip erase including option bytes (factory reset)"
    echo
    echo "⚠️  WARNING: Both erase commands will remove ALL firmware from the device!"
    echo "   Use these commands only when:"
    echo "   - Device is completely unresponsive"
    echo "   - You want to start fresh with a blank device"
    echo "   - Troubleshooting IAP boot issues"
    echo
    echo "After erasing, you must flash bootloader and/or application to use the device."
}

# Main script logic
main() {
    cd "$PROJECT_DIR/chis_flash_burner"

    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi

    command=$1
    target=$2
    build_type=$3

    case $command in
        "build")
            if [[ -z "$target" ]]; then
                print_error "Target required for build command"
                echo "Available targets: bootloader, app, legacy"
                echo "Available build types: Debug (default), Release"
                exit 1
            fi
            check_cmake
            check_toolchain
            build_target "$target" "$build_type"
            ;;
        "clean")
            if [[ -z "$target" ]]; then
                target="all"
            fi
            clean_target "$target" "$build_type"
            ;;
        "flash")
            if [[ -z "$target" ]]; then
                print_error "Target required for flash command"
                echo "Available targets: bootloader, app, legacy"
                echo "Build type is optional - will auto-detect if not specified"
                exit 1
            fi
            flash_target "$target" "$build_type"
            ;;
        "flash-app-safe")
            flash_app_safe
            ;;
        "erase-flash")
            erase_flash
            ;;
        "mass-erase")
            mass_erase_flash
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
