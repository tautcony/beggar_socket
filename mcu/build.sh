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

# Build configuration
BUILD_MODE="debug"  # Default to debug mode
DEBUG_FLAG="1"

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
            log_info "Build mode set to: DEBUG (with debug symbols and minimal optimization)"
            ;;
        "release"|"r")
            BUILD_MODE="release"
            DEBUG_FLAG="0"
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
    local target="${1:-legacy}"

    log_info "Building project: $PROJECT_NAME (${BUILD_MODE} mode, target: $target)"

    cd "$PROJECT_NAME"

    # Create build directory if it doesn't exist
    mkdir -p "$BUILD_DIR"

    # Build specific targets based on Makefile targets
    case "$target" in
        "bootloader"|"boot")
            log_info "Building IAP bootloader..."
            make_cmd="make bootloader DEBUG=$DEBUG_FLAG"
            ;;
        "app"|"application")
            log_info "Building IAP application..."
            make_cmd="make app DEBUG=$DEBUG_FLAG"
            ;;
        "complete"|"iap"|"both")
            log_info "Building complete IAP solution (bootloader + application)..."
            # Build bootloader first
            log_info "Step 1/2: Building bootloader..."
            if make bootloader DEBUG=$DEBUG_FLAG; then
                log_success "Bootloader build completed"
            else
                log_error "Bootloader build failed!"
                cd ..
                exit 1
            fi

            # Build application second
            log_info "Step 2/2: Building application..."
            if make app DEBUG=$DEBUG_FLAG; then
                log_success "Application build completed"
                log_success "Complete IAP solution built successfully!"

                # Show summary
                log_info "IAP Build Summary:"
                if [ -f "$BUILD_DIR/bootloader/chis_flash_burner_bootloader.elf" ] && [ -f "$BUILD_DIR/app/chis_flash_burner_app.elf" ]; then
                    if command_exists ${TARGET_ARCH}-size; then
                        echo -e "${BLUE}Bootloader size:${NC}"
                        ${TARGET_ARCH}-size "$BUILD_DIR/bootloader/chis_flash_burner_bootloader.elf"
                        echo -e "${BLUE}Application size:${NC}"
                        ${TARGET_ARCH}-size "$BUILD_DIR/app/chis_flash_burner_app.elf"
                    fi
                fi
            else
                log_error "Application build failed!"
                cd ..
                exit 1
            fi

            cd ..
            return 0
            ;;
        "legacy")
            log_info "Building legacy single firmware image..."
            make_cmd="make legacy DEBUG=$DEBUG_FLAG"
            ;;
        *)
            log_error "Unknown build target: $target"
            log_info "Valid targets: bootloader, app, complete, legacy"
            cd ..
            exit 1
            ;;
    esac

    # Build the project with appropriate flags
    log_info "Running: $make_cmd"
    if eval "$make_cmd"; then
        log_success "Build completed successfully!"

        # Show build artifacts
        if [ -d "$BUILD_DIR" ]; then
            log_info "Build artifacts:"
            case "$target" in
                "bootloader"|"boot")
                    ls -la "$BUILD_DIR"/bootloader/chis_flash_burner_bootloader.* 2>/dev/null || true
                    ;;
                "app"|"application")
                    ls -la "$BUILD_DIR"/app/chis_flash_burner_app.* 2>/dev/null || true
                    ;;
                "complete"|"iap"|"both")
                    log_info "Complete IAP build artifacts:"
                    ls -la "$BUILD_DIR"/bootloader/chis_flash_burner_bootloader.* 2>/dev/null || true
                    ls -la "$BUILD_DIR"/app/chis_flash_burner_app.* 2>/dev/null || true
                    ;;
                "legacy")
                    ls -la "$BUILD_DIR"/chis_flash_burner_legacy.* 2>/dev/null || true
                    ;;
            esac
        fi
    else
        log_error "Build failed!"
        exit 1
    fi

    cd ..
}

# Function to clean build
clean_project() {
    local target="${1:-all}"

    log_info "Cleaning project (target: $target)..."
    cd "$PROJECT_NAME"

    if [ -f "Makefile" ]; then
        case "$target" in
            "bootloader"|"boot")
                log_info "Cleaning bootloader build artifacts..."
                make clean-bootloader
                log_success "Bootloader clean completed"
                ;;
            "app"|"application")
                log_info "Cleaning application build artifacts..."
                make clean-app
                log_success "Application clean completed"
                ;;
            "legacy")
                log_info "Cleaning legacy build artifacts..."
                make clean-legacy
                log_success "Legacy clean completed"
                ;;
            "complete"|"iap"|"both")
                log_info "Cleaning IAP build artifacts (bootloader + application)..."
                make clean-bootloader
                make clean-app
                log_success "IAP clean completed"
                ;;
            "all"|*)
                log_info "Cleaning all build artifacts..."
                make clean
                log_success "Complete clean completed"
                ;;
        esac
    else
        rm -rf "$BUILD_DIR"
        log_success "Build directory removed"
    fi

    cd ..
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

        # Check for different build targets
        local found_builds=false

        if [ -f "$PROJECT_NAME/$BUILD_DIR/bootloader/chis_flash_burner_bootloader.elf" ]; then
            echo -e "${GREEN}✅ Bootloader build exists${NC}"
            found_builds=true
            if command_exists ${TARGET_ARCH}-size; then
                size_info=$(${TARGET_ARCH}-size "$PROJECT_NAME/$BUILD_DIR/bootloader/chis_flash_burner_bootloader.elf" 2>/dev/null || echo "Size info unavailable")
                echo -e "${BLUE}📊 Bootloader size:${NC}"
                echo "$size_info"
            fi
        fi

        if [ -f "$PROJECT_NAME/$BUILD_DIR/app/chis_flash_burner_app.elf" ]; then
            echo -e "${GREEN}✅ Application build exists${NC}"
            found_builds=true
            if command_exists ${TARGET_ARCH}-size; then
                size_info=$(${TARGET_ARCH}-size "$PROJECT_NAME/$BUILD_DIR/app/chis_flash_burner_app.elf" 2>/dev/null || echo "Size info unavailable")
                echo -e "${BLUE}📊 Application size:${NC}"
                echo "$size_info"
            fi
        fi

        if [ -f "$PROJECT_NAME/$BUILD_DIR/chis_flash_burner_legacy.elf" ]; then
            echo -e "${GREEN}✅ Legacy build exists${NC}"
            found_builds=true
            if command_exists ${TARGET_ARCH}-size; then
                size_info=$(${TARGET_ARCH}-size "$PROJECT_NAME/$BUILD_DIR/chis_flash_burner_legacy.elf" 2>/dev/null || echo "Size info unavailable")
                echo -e "${BLUE}📊 Legacy size:${NC}"
                echo "$size_info"
            fi
        fi

        if [ "$found_builds" = false ]; then
            echo -e "${YELLOW}⚠️  No firmware builds found - project needs to be built${NC}"
        fi

        echo -e "\n${BLUE}📁 Build artifacts:${NC}"
        ls -lh "$PROJECT_NAME/$BUILD_DIR"/*.{elf,hex,bin,map} 2>/dev/null | \
        awk '{printf "   %s (%s)\n", $9, $5}' || echo "   No artifacts found"
    else
        echo -e "${YELLOW}⚠️  Build directory not found - project has not been built${NC}"
    fi
}

# Function to show help
show_help() {
    echo "STM32F103 Build Script"
    echo "Usage: $0 [OPTION] [TARGET] [BUILD_MODE]"
    echo ""
    echo "Options:"
    echo "  build     Build the project (default)"
    echo "  clean     Clean build artifacts"
    echo "  setup     Setup environment only"
    echo "  status    Show project status and build information"
    echo "  help      Show this help message"
    echo ""
    echo "Build targets:"
    echo "  bootloader (boot) - IAP bootloader build (~15KB partition)"
    echo "  app (application) - IAP application build (~23KB + data)"
    echo "  complete (iap)    - Complete IAP solution (bootloader + application)"
    echo "  legacy            - Legacy single firmware image (~40KB, default)"
    echo ""
    echo "Build modes:"
    echo "  debug     Debug build with symbols and minimal optimization (default)"
    echo "  release   Release build with full optimization"
    echo ""
    echo "Clean targets:"
    echo "  all               - Clean all build artifacts (default)"
    echo "  bootloader (boot) - Clean bootloader artifacts only"
    echo "  app (application) - Clean application artifacts only"
    echo "  complete (iap)    - Clean IAP artifacts (bootloader + application)"
    echo "  legacy            - Clean legacy artifacts only"
    echo ""
    echo "Environment variables:"
    echo "  GCC_PATH  Path to ARM GCC toolchain (optional)"
    echo ""
    echo "Examples:"
    echo "  $0                              # Build legacy project in debug mode"
    echo "  $0 build                        # Build legacy project in debug mode"
    echo "  $0 build bootloader debug       # Build bootloader in debug mode"
    echo "  $0 build app release            # Build application in release mode"
    echo "  $0 build complete debug         # Build complete IAP solution"
    echo "  $0 build legacy                 # Build legacy in debug mode"
    echo "  $0 clean                        # Clean all artifacts"
    echo "  $0 clean complete               # Clean IAP artifacts only"
    echo "  $0 setup                        # Setup environment only"
    echo "  $0 status                       # Show project status"
    echo "  GCC_PATH=/opt/gcc $0            # Use custom toolchain path"
    echo ""
    echo "Build configuration:"
    echo "  Debug mode:   DEBUG=1 (default, optimization set by Makefile)"
    echo "  Release mode: DEBUG=0 (optimization set by Makefile)"
    echo ""
    echo "Notes:"
    echo "  - Different build targets have separate build directories"
    echo "  - Bootloader and app are designed for IAP (In-Application Programming)"
    echo "  - Legacy build is a single monolithic firmware image"
    echo "  - Flash memory layout: Bootloader@0x08000000, App@0x08005000"
    echo "  - Use 'complete' target to build both bootloader and application"
}

# Main script logic
main() {
    local action="${1:-build}"
    local target="${2:-legacy}"
    local build_mode="${3:-debug}"

    # Handle cases where second argument is build mode instead of target
    case "$target" in
        "debug"|"d"|"release"|"r")
            build_mode="$target"
            target="legacy"
            ;;
    esac

    case "$action" in
        "build")
            set_build_mode "$build_mode"
            log_info "Starting STM32F103 build process..."
            check_toolchain
            check_makefile
            build_project "$target"
            ;;
        "clean")
            clean_project "$target"
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
            # Check if the first argument is a build target or mode
            case "$action" in
                "bootloader"|"boot"|"app"|"application"|"complete"|"iap"|"both"|"legacy")
                    # First arg is target, second is build mode
                    target="$action"
                    build_mode="${2:-debug}"
                    set_build_mode "$build_mode"
                    log_info "Starting STM32F103 build process..."
                    check_toolchain
                    check_makefile
                    build_project "$target"
                    ;;
                "debug"|"d"|"release"|"r")
                    # First arg is build mode, use default target
                    set_build_mode "$action"
                    log_info "Starting STM32F103 build process..."
                    check_toolchain
                    check_makefile
                    build_project "legacy"
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
