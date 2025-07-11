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
build_project() {
    local build_type=${1:-Debug}  # Default to Debug if not specified
    local build_dir="build/${build_type}"

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

    print_info "Building chis_flash_burner in $build_type mode..."

    # Configure
    if ! cmake -B "$build_dir" -DCMAKE_BUILD_TYPE=$build_type; then
        print_error "Failed to configure project"
        return 1
    fi

    # Build
    if ! cmake --build "$build_dir"; then
        print_error "Failed to build project"
        return 1
    fi

    print_success "Project built successfully in $build_type mode"

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
clean_project() {
    local build_type=$1

    if [[ "$build_type" == "all" ]] || [[ -z "$build_type" ]]; then
        print_info "Cleaning all build directories..."
        rm -rf build/
        print_success "All build directories cleaned"
    else
        # Clean specific build type
        local build_dir="build/${build_type}"
        if [[ -d "$build_dir" ]]; then
            print_info "Cleaning $build_type build directory..."
            rm -rf "$build_dir"
            print_success "$build_type build directory cleaned"
        else
            print_warning "$build_type build directory does not exist"
        fi
    fi
}

# Status function
show_status() {
    print_header

    echo "Build Status:"
    echo "============="

    local status_found=false
    
    # Check both Debug and Release builds
    for build_type in Debug Release; do
        build_dir="build/${build_type}"
        if [[ -d "$build_dir" ]]; then
            elf_file=$(find "$build_dir" -name "*.elf" | head -n1)
            if [[ -f "$elf_file" ]]; then
                size_info=$(arm-none-eabi-size "$elf_file" 2>/dev/null | tail -n1 || echo "N/A")
                print_success "chis_flash_burner ($build_type): Built"
                if [[ "$size_info" != "N/A" ]]; then
                    echo "    Size: $size_info"
                fi
                status_found=true
            else
                print_warning "chis_flash_burner ($build_type): Configured but not built"
                status_found=true
            fi
        fi
    done
    
    if [[ "$status_found" == "false" ]]; then
        print_info "chis_flash_burner: Not configured"
    fi

    echo
    echo "Available Files:"
    echo "==============="

    local files_found=false
    
    # Check both Debug and Release builds
    for build_type in Debug Release; do
        build_dir="build/${build_type}"
        if [[ -d "$build_dir" ]]; then
            local target_files=()
            while IFS= read -r -d '' file; do
                target_files+=("$file")
            done < <(find "$build_dir" -name "*.elf" -o -name "*.hex" -o -name "*.bin" -print0 2>/dev/null)
            
            if [[ ${#target_files[@]} -gt 0 ]]; then
                if [[ "$files_found" == "false" ]]; then
                    echo "  chis_flash_burner:"
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

    if [[ "$files_found" == "false" ]]; then
        print_info "No build files found. Run 'build Debug' or 'build Release' first."
    fi
}

# Flash function
flash_project() {
    local build_type=${1:-""}
    local build_dir=""
    local hex_file=""

    # Find the hex file - try specific build type first, then search all available
    if [[ -n "$build_type" ]]; then
        build_dir="build/${build_type}"
    else
        # Try to find the most recent build (prefer Release, then Debug)
        for bt in Release Debug; do
            test_dir="build/${bt}"
            if [[ -d "$test_dir" ]] && find "$test_dir" -name "*.hex" -type f | grep -q .; then
                build_dir="$test_dir"
                build_type="$bt"
                break
            fi
        done
    fi

    if [[ -z "$build_dir" ]]; then
        print_error "No build directory found"
        print_info "Please build the project first: $0 build [Debug|Release]"
        return 1
    fi

    hex_file="$build_dir/chis_flash_burner.hex"

    if [[ ! -f "$hex_file" ]]; then
        print_error "Hex file not found: $hex_file"
        if [[ -n "$build_type" ]]; then
            print_info "Please build the project in $build_type mode first: $0 build $build_type"
        else
            print_info "Please build the project first: $0 build"
        fi
        return 1
    fi

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    if [[ -n "$build_type" ]]; then
        print_info "Flashing chis_flash_burner ($build_type mode)..."
    else
        print_info "Flashing chis_flash_burner..."
    fi

    # Standard programming
    if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
        -c "program $hex_file verify reset exit"; then
        print_success "chis_flash_burner flashed successfully"
        print_info "Device should now be running the new firmware"
    else
        print_error "Failed to flash firmware"
        return 1
    fi
}

# Erase entire flash function
erase_flash() {
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_warning "This will COMPLETELY ERASE the entire STM32 Flash memory!"
    print_warning "All firmware will be removed."
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
        print_info "Device is now blank - you need to flash firmware"
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
    print_warning "All data including firmware and option bytes will be reset."
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
        print_info "You need to flash firmware"
    else
        print_error "Failed to perform mass erase"
        return 1
    fi
}

# Help function
show_help() {
    print_header

    echo "Usage: $0 <command> [build_type]"
    echo
    echo "Commands:"
    echo "  build [build_type]      - Build chis_flash_burner project"
    echo "  clean [build_type|all]  - Clean build files"
    echo "  flash [build_type]      - Flash firmware to device"
    echo "  status                  - Show build status and available files"
    echo "  erase-flash             - Erase entire flash memory (WARNING: removes everything)"
    echo "  mass-erase              - Mass erase flash including option bytes (DANGEROUS)"
    echo "  help                    - Show this help message"
    echo
    echo "Build Types:"
    echo "  Debug     - Debug build with optimization disabled and debug symbols (default)"
    echo "  Release   - Release build with optimization enabled and debug symbols removed"
    echo
    echo "Examples:"
    echo "  $0 build                        # Build in Debug mode (default)"
    echo "  $0 build Debug                  # Build in Debug mode"
    echo "  $0 build Release                # Build in Release mode"
    echo "  $0 clean all                    # Clean all build directories"
    echo "  $0 clean Debug                  # Clean only Debug build"
    echo "  $0 flash                        # Flash latest build (auto-detect)"
    echo "  $0 flash Release                # Flash Release version"
    echo "  $0 erase-flash                  # Completely erase flash memory"
    echo "  $0 mass-erase                   # Mass erase (resets option bytes too)"
    echo "  $0 status                       # Show current build status"
    echo
    echo "Build Types Explained:"
    echo "  Debug       - Debug build with symbols, no optimization"
    echo "              - Larger size, easier debugging, slower execution"
    echo "              - Optimization level: -Og (optimize for debugging)"
    echo "  Release     - Release build with optimization, no debug symbols"
    echo "              - Smaller size, harder debugging, faster execution"
    echo "              - Optimization level: -O2 (optimize for speed)"
    echo
    echo "Requirements:"
    echo "  - CMake 3.16 or higher"
    echo "  - ARM none-eabi toolchain (gcc-arm-none-eabi)"
    echo "  - OpenOCD (for flashing)"
    echo "  - ST-Link programmer/debugger"
    echo
    echo "Flash Erase Commands:"
    echo "  erase-flash   - Sector erase (0x08000000-0x0800FFFF, preserves option bytes)"
    echo "  mass-erase    - Complete chip erase including option bytes (factory reset)"
    echo
    echo "⚠️  WARNING: Both erase commands will remove ALL firmware from the device!"
    echo "   Use these commands only when:"
    echo "   - Device is completely unresponsive"
    echo "   - You want to start fresh with a blank device"
    echo "   - Troubleshooting firmware issues"
    echo
    echo "After erasing, you must flash firmware to use the device."
}

# Main script logic
main() {
    cd "$PROJECT_DIR/chis_flash_burner"

    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi

    command=$1
    build_type=$2

    case $command in
        "build")
            check_cmake
            check_toolchain
            build_project "$build_type"
            ;;
        "clean")
            clean_project "$build_type"
            ;;
        "flash")
            flash_project "$build_type"
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
