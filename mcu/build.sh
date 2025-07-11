#!/bin/bash

# STM32F103 Project Build Script
# This script sets up the environment and builds the project on *nix systems

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="chis_flash_burner"
MCU="STM32F103C8Tx"
BUILD_DIR="build"
TARGET_ARCH="arm-none-eabi"

# Flash configuration
FLASH_SIZE="64K"  # STM32F103C8T6 has 64KB flash
OPENOCD_INTERFACE="interface/stlink.cfg"
OPENOCD_TARGET="target/stm32f1x.cfg"

# Build configuration
BUILD_MODE="debug"  # Default to debug mode
DEBUG_FLAG="1"
OPT_FLAG="-Og"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to set build mode
set_build_mode() {
    local mode="$1"
    case "$mode" in
        "debug"|"d")
            BUILD_MODE="debug"
            DEBUG_FLAG="1"
            OPT_FLAG="-Og"
            log_info "Build mode set to: DEBUG (with debug symbols and minimal optimization)"
            ;;
        "release"|"r")
            BUILD_MODE="release"
            DEBUG_FLAG="0"
            OPT_FLAG="-O2"
            log_info "Build mode set to: RELEASE (optimized for size and speed)"
            ;;
        *)
            log_error "Invalid build mode: $mode"
            log_info "Valid modes: debug (d), release (r)"
            exit 1
            ;;
    esac
}

# Function to install ARM toolchain on different systems
install_arm_toolchain() {
    log_info "Installing ARM toolchain..."
    
    if command_exists apt-get; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get install -y gcc-arm-none-eabi binutils-arm-none-eabi libnewlib-arm-none-eabi libstdc++-arm-none-eabi-newlib
    elif command_exists yum; then
        # CentOS/RHEL/Fedora (older)
        sudo yum install -y arm-none-eabi-gcc-cs arm-none-eabi-binutils-cs arm-none-eabi-newlib
    elif command_exists dnf; then
        # Fedora (newer)
        sudo dnf install -y arm-none-eabi-gcc-cs arm-none-eabi-binutils-cs arm-none-eabi-newlib
    elif command_exists pacman; then
        # Arch Linux
        sudo pacman -S --noconfirm arm-none-eabi-gcc arm-none-eabi-binutils arm-none-eabi-newlib
    elif command_exists brew; then
        # macOS with Homebrew
        # brew tap ArmMbed/homebrew-formulae
        brew install --cask gcc-arm-embedded
    elif command_exists port; then
        # macOS with MacPorts
        sudo port install arm-none-eabi-gcc
    else
        log_error "Unsupported package manager. Please install ARM toolchain manually."
        log_info "Download from: https://developer.arm.com/tools-and-software/open-source-software/developer-tools/gnu-toolchain/gnu-rm"
        exit 1
    fi
}

# Function to install build tools
install_build_tools() {
    log_info "Installing build tools..."
    
    if command_exists apt-get; then
        sudo apt-get install -y make cmake git
    elif command_exists yum; then
        sudo yum install -y make cmake git
    elif command_exists dnf; then
        sudo dnf install -y make cmake git
    elif command_exists pacman; then
        sudo pacman -S --noconfirm make cmake git
    elif command_exists brew; then
        brew install make cmake git
    elif command_exists port; then
        sudo port install gmake cmake git
    fi
}

# Function to check toolchain
check_toolchain() {
    log_info "Checking ARM toolchain..."
    
    if ! command_exists ${TARGET_ARCH}-gcc; then
        log_warning "ARM toolchain not found. Installing..."
        install_arm_toolchain
    fi
    
    if ! command_exists make; then
        log_warning "Build tools not found. Installing..."
        install_build_tools
    fi
    
    # Verify installation
    if command_exists ${TARGET_ARCH}-gcc; then
        log_success "ARM GCC found: $(${TARGET_ARCH}-gcc --version | head -n1)"
    else
        log_error "ARM toolchain installation failed"
        exit 1
    fi
    
    if command_exists make; then
        log_success "Make found: $(make --version | head -n1)"
    else
        log_error "Make installation failed"
        exit 1
    fi
}

# Function to check Makefile exists
check_makefile() {
    local makefile_path="${PROJECT_NAME}/Makefile"
    
    if [ ! -f "$makefile_path" ]; then
        log_error "Makefile not found at $makefile_path"
        log_info "The Makefile should be included in the project"
        exit 1
    else
        log_success "Makefile found"
    fi
}

# Function to build the project
build_project() {
    log_info "Building project: $PROJECT_NAME (${BUILD_MODE} mode)"
    
    cd "$PROJECT_NAME"
    
    # Create build directory if it doesn't exist
    mkdir -p "$BUILD_DIR"
    
    # Build the project with appropriate flags
    log_info "Running make with DEBUG=$DEBUG_FLAG OPT=$OPT_FLAG..."
    if make -j$(nproc 2>/dev/null || echo 4) DEBUG=$DEBUG_FLAG OPT=$OPT_FLAG; then
        log_success "Build completed successfully!"
        
        # Show build artifacts
        if [ -d "$BUILD_DIR" ]; then
            log_info "Build artifacts:"
            ls -la "$BUILD_DIR"/*.elf "$BUILD_DIR"/*.hex "$BUILD_DIR"/*.bin 2>/dev/null || true
        fi
    else
        log_error "Build failed!"
        exit 1
    fi
    
    cd ..
}

# Function to clean build
clean_project() {
    log_info "Cleaning project..."
    cd "$PROJECT_NAME"
    if [ -f "Makefile" ]; then
        make clean
        log_success "Clean completed"
    else
        rm -rf "$BUILD_DIR"
        log_success "Build directory removed"
    fi
    cd ..
}

# Flash function
flash_target() {
    local hex_file=""
    
    # Check if build directory and hex file exist
    if [ ! -d "$PROJECT_NAME/$BUILD_DIR" ]; then
        log_error "Build directory not found. Please build the project first."
        return 1
    fi
    
    # Look for hex file
    hex_file="$PROJECT_NAME/$BUILD_DIR/${PROJECT_NAME}.hex"
    
    if [ ! -f "$hex_file" ]; then
        log_error "Hex file not found: $hex_file"
        log_info "Please build the project first: $0 build"
        return 1
    fi

    # Check if OpenOCD is available
    if ! command_exists openocd; then
        log_error "OpenOCD is not installed or not in PATH"
        log_info "Please install OpenOCD:"
        log_info "  Ubuntu/Debian: sudo apt-get install openocd"
        log_info "  macOS:         brew install openocd"
        log_info "  Arch Linux:    sudo pacman -S openocd"
        return 1
    fi

    log_info "Flashing $PROJECT_NAME to STM32F103..."
    log_info "Using hex file: $hex_file"

    # Flash using OpenOCD with ST-Link interface
    if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
        -c "program $hex_file verify reset exit"; then
        log_success "Firmware flashed successfully!"
        log_info "Device should now be running the new firmware"
    else
        log_error "Failed to flash firmware"
        log_warning "Make sure:"
        log_warning "  - ST-Link is connected properly"
        log_warning "  - Target device is powered"
        log_warning "  - OpenOCD configuration files are available"
        return 1
    fi
}

# Erase entire flash function
erase_flash() {
    # Check if OpenOCD is available
    if ! command_exists openocd; then
        log_error "OpenOCD is not installed or not in PATH"
        log_info "Please install OpenOCD:"
        log_info "  Ubuntu/Debian: sudo apt-get install openocd"
        log_info "  macOS:         brew install openocd"
        log_info "  Arch Linux:    sudo pacman -S openocd"
        return 1
    fi

    log_warning "⚠️  WARNING: This will COMPLETELY ERASE the entire STM32F103 Flash memory!"
    log_warning "⚠️  All firmware including bootloader will be removed."
    echo ""
    echo -n "Are you sure you want to continue? Type 'yes' to confirm: "
    read -r confirmation

    if [ "$confirmation" != "yes" ]; then
        log_info "Operation cancelled by user"
        return 0
    fi

    log_info "Erasing entire Flash memory on STM32F103..."

    # Use OpenOCD to erase the entire flash
    # STM32F103C8T6 has 64KB flash = 64 pages of 1KB each (pages 0-63)
    if openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
        -c "init" \
        -c "reset halt" \
        -c "flash info 0" \
        -c "flash erase_sector 0 0 63" \
        -c "reset run" \
        -c "exit"; then
        log_success "Flash memory erased successfully!"
        log_info "Device is now blank - you need to flash new firmware"
    else
        log_error "Failed to erase flash memory"
        log_warning "Make sure:"
        log_warning "  - ST-Link is connected properly"
        log_warning "  - Target device is powered"
        log_warning "  - Device is not write-protected"
        return 1
    fi
}

# Function to show project status
show_status() {
    echo -e "${BLUE}=== STM32F103 Project Status ===${NC}"

    # Check if project directory exists
    if [ ! -d "$PROJECT_NAME" ]; then
        echo -e "${RED}❌ Project directory '$PROJECT_NAME' not found${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Project directory found${NC}"
    fi

    # Check ARM toolchain
    if command_exists ${TARGET_ARCH}-gcc; then
        echo -e "${GREEN}✅ ARM toolchain: $(${TARGET_ARCH}-gcc --version | head -n1)${NC}"
    else
        echo -e "${RED}❌ ARM toolchain not found${NC}"
    fi

    # Check build tools
    if command_exists make; then
        echo -e "${GREEN}✅ Make: $(make --version | head -n1)${NC}"
    else
        echo -e "${RED}❌ Make not found${NC}"
    fi

    # Check OpenOCD for flashing
    if command_exists openocd; then
        echo -e "${GREEN}✅ OpenOCD: $(openocd --version 2>&1 | head -n1 | cut -d' ' -f1-4)${NC}"
    else
        echo -e "${YELLOW}⚠️  OpenOCD not found (needed for flashing)${NC}"
    fi

    # Check Makefile
    if [ -f "$PROJECT_NAME/Makefile" ]; then
        echo -e "${GREEN}✅ Makefile exists${NC}"
    else
        echo -e "${RED}❌ Makefile not found${NC}"
    fi

    # Check build artifacts
    echo -e "\n${BLUE}=== Build Status ===${NC}"
    if [ -d "$PROJECT_NAME/$BUILD_DIR" ]; then
        echo -e "${GREEN}✅ Build directory exists${NC}"
        
        if [ -f "$PROJECT_NAME/$BUILD_DIR/${PROJECT_NAME}.elf" ]; then
            echo -e "${GREEN}✅ ELF file exists${NC}"
            
            # Show file info
            elf_file="$PROJECT_NAME/$BUILD_DIR/${PROJECT_NAME}.elf"
            if command_exists ${TARGET_ARCH}-size; then
                size_info=$(${TARGET_ARCH}-size "$elf_file" 2>/dev/null || echo "Size info unavailable")
                echo -e "${BLUE}📊 Firmware size:${NC}"
                echo "$size_info"
            fi
            
            echo -e "\n${BLUE}📁 Build artifacts:${NC}"
            ls -lh "$PROJECT_NAME/$BUILD_DIR"/*.{elf,hex,bin,map} 2>/dev/null | \
            awk '{printf "   %s (%s)\n", $9, $5}' || echo "   No artifacts found"
        else
            echo -e "${YELLOW}⚠️  No ELF file found - project needs to be built${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Build directory not found - project has not been built${NC}"
    fi

    # Show recent build logs
    log_file="$PROJECT_NAME/$BUILD_DIR/build.log"
    if [ -f "$log_file" ]; then
        echo -e "\n${BLUE}=== Recent Build Log ===${NC}"
        tail -n 10 "$log_file"
    fi

    echo -e "\n${BLUE}=== Quick Commands ===${NC}"
    echo "  ./build.sh setup       - Setup environment"
    echo "  ./build.sh build       - Build in debug mode (default)"
    echo "  ./build.sh build debug - Build in debug mode"
    echo "  ./build.sh build release - Build in release mode"
    echo "  ./build.sh clean       - Clean build"
    echo "  ./build.sh flash       - Flash firmware to device"
    echo "  ./build.sh erase       - Erase entire flash memory"
    echo "  ./build.sh status      - Show this status"
}

# Function to show help
show_help() {
    echo "STM32F103 Build Script"
    echo "Usage: $0 [OPTION] [BUILD_MODE]"
    echo ""
    echo "Options:"
    echo "  build     Build the project (default)"
    echo "  clean     Clean build artifacts"
    echo "  flash     Flash firmware to target device"
    echo "  erase     Erase entire flash memory"
    echo "  setup     Setup environment only"
    echo "  status    Show project status and build information"
    echo "  help      Show this help message"
    echo ""
    echo "Build modes:"
    echo "  debug     Debug build with symbols and minimal optimization (-Og)"
    echo "  release   Release build with full optimization (-O2)"
    echo "  d         Short for debug"
    echo "  r         Short for release"
    echo ""
    echo "Environment variables:"
    echo "  GCC_PATH       Path to ARM GCC toolchain (optional)"
    echo "  OPENOCD_PATH   Path to OpenOCD (optional)"
    echo ""
    echo "Dependencies:"
    echo "  - ARM GCC toolchain (gcc-arm-none-eabi)"
    echo "  - Make"
    echo "  - OpenOCD (for flashing)"
    echo "  - ST-Link programmer/debugger"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build project in debug mode"
    echo "  $0 build              # Build project in debug mode"
    echo "  $0 build release      # Build project in release mode"
    echo "  $0 build r            # Build project in release mode (short)"
    echo "  $0 clean              # Clean project"
    echo "  $0 flash              # Flash firmware to device"
    echo "  $0 erase              # Erase entire flash memory"
    echo "  $0 setup              # Setup environment only"
    echo "  $0 status             # Show project status"
    echo "  GCC_PATH=/opt/gcc $0  # Use custom toolchain path"
    echo ""
    echo "Build configuration:"
    echo "  Debug mode:   DEBUG=1 OPT=-Og (default)"
    echo "  Release mode: DEBUG=0 OPT=-O2"
}

# Main script logic
main() {
    local action="${1:-build}"
    local build_mode="${2:-debug}"
    
    case "$action" in
        "build")
            set_build_mode "$build_mode"
            log_info "Starting STM32F103 build process..."
            check_toolchain
            check_makefile
            build_project
            ;;
        "clean")
            clean_project
            ;;
        "flash")
            flash_target
            ;;
        "erase")
            erase_flash
            ;;
        "setup")
            check_toolchain
            check_makefile
            log_success "Environment setup completed"
            ;;
        "status")
            show_status
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            # Check if the first argument is a build mode
            case "$action" in
                "debug"|"d"|"release"|"r")
                    set_build_mode "$action"
                    log_info "Starting STM32F103 build process..."
                    check_toolchain
                    check_makefile
                    build_project
                    ;;
                *)
                    log_error "Unknown option: $action"
                    show_help
                    exit 1
                    ;;
            esac
            ;;
    esac
}

# Check if script is in correct directory
if [ ! -d "$PROJECT_NAME" ]; then
    log_error "Project directory '$PROJECT_NAME' not found!"
    log_info "Please run this script from the mcu directory"
    exit 1
fi

# Run main function
main "$@"
