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
    local build_dir="build-$target"
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

    print_info "Building $target..."

    # Configure
    if ! cmake -B "$build_dir" $cmake_option -DCMAKE_BUILD_TYPE=Debug; then
        print_error "Failed to configure $target"
        return 1
    fi

    # Build
    if ! cmake --build "$build_dir"; then
        print_error "Failed to build $target"
        return 1
    fi

    print_success "$target built successfully"

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

    if [[ "$target" == "all" ]]; then
        print_info "Cleaning all build directories..."
        rm -rf build-*
        rm -rf build
        print_success "All build directories cleaned"
    else
        local build_dir="build-$target"
        if [[ -d "$build_dir" ]]; then
            print_info "Cleaning $target build directory..."
            rm -rf "$build_dir"
            print_success "$target build directory cleaned"
        else
            print_warning "$target build directory does not exist"
        fi
    fi
}

# Status function
show_status() {
    print_header

    echo "Build Status:"
    echo "============="

    for target in bootloader app legacy; do
        build_dir="build-$target"
        if [[ -d "$build_dir" ]]; then
            elf_file=$(find "$build_dir" -name "*.elf" | head -n1)
            if [[ -f "$elf_file" ]]; then
                size_info=$(arm-none-eabi-size "$elf_file" 2>/dev/null | tail -n1 || echo "N/A")
                print_success "$target: Built"
                if [[ "$size_info" != "N/A" ]]; then
                    echo "    Size: $size_info"
                fi
            else
                print_warning "$target: Configured but not built"
            fi
        else
            print_info "$target: Not configured"
        fi
    done

    echo
    echo "Available Files:"
    echo "==============="

    for target in bootloader app legacy; do
        build_dir="build-$target"
        if [[ -d "$build_dir" ]]; then
            files_found=false
            find "$build_dir" -name "*.elf" -o -name "*.hex" -o -name "*.bin" | while read -r file; do
                if [[ -f "$file" ]]; then
                    if [[ "$files_found" == "false" ]]; then
                        echo "  $target:"
                        files_found=true
                    fi
                    size=$(du -h "$file" | cut -f1)
                    echo "    $(basename "$file") ($size)"
                fi
            done
        fi
    done
}

# Flash function
flash_target() {
    local target=$1
    local build_dir="build-$target"
    local hex_file=""

    case $target in
        "bootloader")
            hex_file="$build_dir/bootloader/chis_flash_burner_bootloader.hex"
            ;;
        "app")
            hex_file="$build_dir/app/chis_flash_burner_app.hex"
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
        print_info "Please build the $target first"
        return 1
    fi

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_info "Flashing $target..."

    if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
        -c "program $hex_file verify reset exit"; then
        print_success "$target flashed successfully"
    else
        print_error "Failed to flash $target"
        return 1
    fi
}

# Help function
show_help() {
    print_header

    echo "Usage: $0 <command> [target]"
    echo
    echo "Commands:"
    echo "  build <target>    - Build specified target (bootloader|app|legacy)"
    echo "  clean [target]    - Clean build files (bootloader|app|legacy|all)"
    echo "  flash <target>    - Flash firmware (bootloader|app|legacy)"
    echo "  status            - Show build status and available files"
    echo "  help              - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 build bootloader     # Build bootloader"
    echo "  $0 build app            # Build application"
    echo "  $0 build legacy         # Build legacy single image"
    echo "  $0 clean all            # Clean all build directories"
    echo "  $0 flash bootloader     # Flash bootloader"
    echo "  $0 status               # Show current build status"
    echo
    echo "Build Targets:"
    echo "  bootloader  - IAP BootLoader (minimal, optimized for size)"
    echo "  app         - Application for IAP (runs after bootloader)"
    echo "  legacy      - Legacy single image (traditional build)"
    echo
    echo "Requirements:"
    echo "  - CMake 3.16 or higher"
    echo "  - ARM none-eabi toolchain"
    echo "  - OpenOCD (for flashing)"
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

    case $command in
        "build")
            if [[ -z "$target" ]]; then
                print_error "Target required for build command"
                echo "Available targets: bootloader, app, legacy"
                exit 1
            fi
            check_cmake
            check_toolchain
            build_target "$target"
            ;;
        "clean")
            if [[ -z "$target" ]]; then
                target="all"
            fi
            clean_target "$target"
            ;;
        "flash")
            if [[ -z "$target" ]]; then
                print_error "Target required for flash command"
                echo "Available targets: bootloader, app, legacy"
                exit 1
            fi
            flash_target "$target"
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
