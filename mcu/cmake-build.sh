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
    local build_dir="build/$target"
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
        rm -rf build/
        print_success "All build directories cleaned"
    else
        local build_dir="build/$target"
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
        build_dir="build/$target"
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
        build_dir="build/$target"
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
    local build_dir="build/$target"
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

# Check device running status
check_device_status() {
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_info "Checking device running status..."

    # Start OpenOCD and check device state
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/device_status.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        cat /tmp/device_status.log
        return 1
    fi

    # Read current CPU state
    local status_info
    status_info=$({
        echo "halt"
        sleep 0.5
        echo "reg pc"
        sleep 0.5
        echo "reg sp"
        sleep 0.5
        echo "mdw 0xE000ED08 1"  # VTOR register
        sleep 0.5
        echo "resume"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || true)

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null || true

    if [[ -n "$status_info" ]]; then
        # Parse PC value
        local pc_val=$(echo "$status_info" | grep "pc " | sed 's/.*pc.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local sp_val=$(echo "$status_info" | grep -E "(msp|sp) " | sed 's/.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local vtor_val=$(echo "$status_info" | grep "0xe000ed08:" | sed 's/.*0xe000ed08: \([0-9a-fA-F]*\).*/0x\1/')

        print_success "Device Status Information:"
        echo "=========================="

        if [[ -n "$pc_val" ]]; then
            echo "Program Counter (PC): $pc_val"

            # Analyze PC location
            if [[ "$pc_val" =~ ^0x0800[0-5] ]]; then
                print_success "✓ Device is running BOOTLOADER code"
                echo "  Address range: 0x08000000 - 0x08005FFF"
            elif [[ "$pc_val" =~ ^0x0800[6-9A-Fa-f] ]]; then
                print_success "✓ Device is running APPLICATION code"
                echo "  Address range: 0x08006000 - 0x0800FFFF"
            elif [[ "$pc_val" =~ ^0x2000 ]]; then
                print_warning "⚠ Device PC is in RAM - may be running from RAM or crashed"
            elif [[ "$pc_val" =~ ^0xFFFF ]]; then
                print_error "✗ Device appears to be in invalid state (PC = 0xFFFFFFFF)"
            else
                print_warning "⚠ Device PC is in unexpected region: $pc_val"
                echo "  Expected: 0x08000000-0x08005FFF (bootloader) or 0x08006000-0x0800FFFF (app)"
            fi
        else
            print_error "Could not read Program Counter"
        fi

        if [[ -n "$sp_val" ]]; then
            echo "Stack Pointer (SP): $sp_val"
            if [[ "$sp_val" =~ ^0x2000[0-4] ]]; then
                print_success "✓ Stack pointer is valid"
            else
                print_warning "⚠ Stack pointer may be invalid: $sp_val"
            fi
        fi

        if [[ -n "$vtor_val" && "$vtor_val" != "0x00000000" ]]; then
            echo "Vector Table Offset (VTOR): $vtor_val"
            if [[ "$vtor_val" == "0x08000000" ]]; then
                print_info "→ Using bootloader vector table"
            elif [[ "$vtor_val" == "0x08006000" ]]; then
                print_info "→ Using application vector table"
            else
                print_warning "→ Unexpected VTOR value"
            fi
        fi

        echo
        print_info "Quick Assessment:"

        # Provide quick assessment
        if [[ "$pc_val" =~ ^0x0800[0-5] ]]; then
            echo "• Device is in BOOTLOADER mode"
            if [[ "$vtor_val" == "0x08000000" ]]; then
                echo "• Normal bootloader operation"
                echo "• Ready for IAP commands or will jump to app if valid"
            else
                echo "• VTOR mismatch - may indicate initialization issue"
            fi
        elif [[ "$pc_val" =~ ^0x0800[6-9A-Fa-f] ]]; then
            echo "• Device is running APPLICATION"
            if [[ "$vtor_val" == "0x08006000" ]]; then
                echo "• Application running normally"
            else
                echo "• VTOR not relocated - application may have issues"
            fi
        else
            echo "• Device may be crashed or in undefined state"
            echo "• Consider resetting or reflashing firmware"
        fi

    else
        print_error "Could not communicate with device"
        echo "Possible causes:"
        echo "• Device is not connected"
        echo "• ST-Link driver issues"
        echo "• Device is completely locked up"
    fi

    echo
    print_info "Additional Debug Commands:"
    echo "• Reset device: openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c 'init; reset; exit'"
    echo "• Full device analysis: ./debug-iap.sh"
    echo "• Force bootloader mode: Check BOOT0 pin or use bootloader entry method"
}

# Advanced device diagnostics
diagnose_device() {
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_info "Starting advanced device diagnostics..."
    print_warning "This will halt the device temporarily for register inspection"

    # Start OpenOCD and perform detailed diagnostics
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/device_diag.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        cat /tmp/device_diag.log
        return 1
    fi

    # Comprehensive device diagnostics
    local diag_info
    diag_info=$({
        echo "halt"
        sleep 0.5

        # Core registers
        echo "reg pc"
        sleep 0.2
        echo "reg sp"
        sleep 0.2
        echo "reg lr"
        sleep 0.2

        # System control registers
        echo "mdw 0xE000ED08 1"  # VTOR
        sleep 0.2
        echo "mdw 0xE000ED0C 1"  # AIRCR
        sleep 0.2
        echo "mdw 0xE000ED24 1"  # SHCSR
        sleep 0.2

        # RCC registers (Clock configuration)
        echo "mdw 0x40021000 1"  # RCC_CR
        sleep 0.2
        echo "mdw 0x40021004 1"  # RCC_CFGR
        sleep 0.2
        echo "mdw 0x40021018 1"  # RCC_APB2ENR
        sleep 0.2
        echo "mdw 0x4002101C 1"  # RCC_APB1ENR
        sleep 0.2

        # GPIO registers (for LED and USB detection)
        echo "mdw 0x40010C00 4"  # GPIOC_CRL/CRH/IDR/ODR
        sleep 0.2
        echo "mdw 0x40010800 4"  # GPIOA_CRL/CRH/IDR/ODR
        sleep 0.2

        # USB registers
        echo "mdw 0x40005C00 1"  # USB_CNTR
        sleep 0.2
        echo "mdw 0x40005C44 1"  # USB_DADDR
        sleep 0.2
        echo "mdw 0x40005C40 1"  # USB_ISTR
        sleep 0.2

        # Vector table content
        echo "mdw 0x08006000 8"  # App vector table (first 8 vectors)
        sleep 0.2

        echo "resume"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || true)

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null || true

    if [[ -n "$diag_info" ]]; then
        print_success "Device Diagnostic Report:"
        echo "=========================="

        # Parse and display core registers
        local pc_val=$(echo "$diag_info" | grep "pc " | sed 's/.*pc.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local sp_val=$(echo "$diag_info" | grep -E "(msp|sp) " | sed 's/.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local lr_val=$(echo "$diag_info" | grep "lr " | sed 's/.*lr.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local vtor_val=$(echo "$diag_info" | grep "0xe000ed08:" | sed 's/.*0xe000ed08: \([0-9a-fA-F]*\).*/0x\1/')

        echo "CORE REGISTERS:"
        echo "---------------"
        echo "PC (Program Counter): $pc_val"
        echo "SP (Stack Pointer):   $sp_val"
        echo "LR (Link Register):   $lr_val"
        echo "VTOR (Vector Table):  $vtor_val"
        echo

        # Analyze clock configuration
        local rcc_cr=$(echo "$diag_info" | grep "0x40021000:" | sed 's/.*0x40021000: \([0-9a-fA-F]*\).*/0x\1/')
        local rcc_cfgr=$(echo "$diag_info" | grep "0x40021004:" | sed 's/.*0x40021004: \([0-9a-fA-F]*\).*/0x\1/')
        local rcc_apb2enr=$(echo "$diag_info" | grep "0x40021018:" | sed 's/.*0x40021018: \([0-9a-fA-F]*\).*/0x\1/')
        local rcc_apb1enr=$(echo "$diag_info" | grep "0x4002101c:" | sed 's/.*0x4002101c: \([0-9a-fA-F]*\).*/0x\1/')

        echo "CLOCK CONFIGURATION:"
        echo "--------------------"
        echo "RCC_CR (Clock Control):     $rcc_cr"
        echo "RCC_CFGR (Clock Config):    $rcc_cfgr"
        echo "RCC_APB2ENR (APB2 Enable):  $rcc_apb2enr"
        echo "RCC_APB1ENR (APB1 Enable):  $rcc_apb1enr"

        # Analyze clock settings
        if [[ -n "$rcc_cr" ]]; then
            local cr_val=$((rcc_cr))
            if ((cr_val & 0x02000000)); then
                print_success "✓ PLL is ready"
            else
                print_warning "⚠ PLL is not ready"
            fi

            if ((cr_val & 0x01000000)); then
                print_info "→ PLL is enabled"
            else
                print_warning "→ PLL is disabled"
            fi

            if ((cr_val & 0x00020000)); then
                print_success "✓ HSE (External oscillator) is ready"
            else
                print_warning "⚠ HSE is not ready - may be using HSI internal oscillator"
            fi
        fi
        echo

        # Analyze GPIO configuration
        local gpioc_crl=$(echo "$diag_info" | grep "0x40010c00:" | sed 's/.*0x40010c00: \([0-9a-fA-F]*\).*/0x\1/')
        local gpioc_crh=$(echo "$diag_info" | grep "0x40010c04:" | sed 's/.*0x40010c04: \([0-9a-fA-F]*\).*/0x\1/')
        local gpioc_odr=$(echo "$diag_info" | grep "0x40010c0c:" | sed 's/.*0x40010c0c: \([0-9a-fA-F]*\).*/0x\1/')

        echo "GPIO CONFIGURATION:"
        echo "-------------------"
        echo "GPIOC_CRL (Control Low):   $gpioc_crl"
        echo "GPIOC_CRH (Control High):  $gpioc_crh" 
        echo "GPIOC_ODR (Output Data):   $gpioc_odr"

        # Check LED configuration (typically PC13)
        if [[ -n "$gpioc_crh" ]]; then
            local crh_val=$((gpioc_crh))
            local pc13_config=$(((crh_val >> 20) & 0xF))
            echo "PC13 Configuration: 0x$(printf '%X' $pc13_config)"

            if ((pc13_config == 0x1)) || ((pc13_config == 0x2)) || ((pc13_config == 0x3)); then
                print_success "✓ PC13 configured as output (LED pin)"
            elif ((pc13_config == 0x4)) || ((pc13_config == 0x8)); then
                print_info "→ PC13 configured as input"
            else
                print_warning "⚠ PC13 configuration unclear: 0x$(printf '%X' $pc13_config)"
            fi
        fi

        if [[ -n "$gpioc_odr" ]]; then
            local odr_val=$((gpioc_odr))
            if ((odr_val & 0x2000)); then
                echo "PC13 Output: HIGH (LED off - typical for active-low LED)"
            else
                echo "PC13 Output: LOW (LED on - if active-low)"
            fi
        fi
        echo

        # Analyze USB configuration
        local usb_cntr=$(echo "$diag_info" | grep "0x40005c00:" | sed 's/.*0x40005c00: \([0-9a-fA-F]*\).*/0x\1/')
        local usb_daddr=$(echo "$diag_info" | grep "0x40005c44:" | sed 's/.*0x40005c44: \([0-9a-fA-F]*\).*/0x\1/')

        echo "USB CONFIGURATION:"
        echo "------------------"
        echo "USB_CNTR (Control):   $usb_cntr"
        echo "USB_DADDR (Address):  $usb_daddr"

        if [[ -n "$usb_cntr" ]]; then
            local cntr_val=$((usb_cntr))
            if ((cntr_val & 0x01)); then
                print_success "✓ USB is enabled"
            else
                print_warning "⚠ USB is disabled"
            fi

            if ((cntr_val & 0x02)); then
                print_warning "→ USB in reset state"
            fi
        fi

        # Check if USB clock is enabled
        if [[ -n "$rcc_apb1enr" ]]; then
            local apb1_val=$((rcc_apb1enr))
            if ((apb1_val & 0x800000)); then
                print_success "✓ USB clock is enabled"
            else
                print_warning "⚠ USB clock is disabled"
            fi
        fi
        echo

        # Check vector table
        echo "VECTOR TABLE (App @ 0x08006000):"
        echo "--------------------------------"
        local vectors=$(echo "$diag_info" | grep "0x08006000:")
        if [[ -n "$vectors" ]]; then
            echo "$vectors"

            # Parse initial SP and Reset vector
            local vector_line=$(echo "$vectors" | head -n1)
            local initial_sp=$(echo "$vector_line" | sed 's/.*0x08006000: \([0-9a-fA-F]*\).*/\1/')
            local reset_vector=$(echo "$vector_line" | sed 's/.*0x08006004: \([0-9a-fA-F]*\).*/\1/')

            if [[ -n "$initial_sp" && "$initial_sp" != "00000000" && "$initial_sp" != "ffffffff" ]]; then
                print_success "✓ Valid initial stack pointer in vector table"
            else
                print_error "✗ Invalid initial stack pointer: 0x$initial_sp"
            fi

            if [[ -n "$reset_vector" && "$reset_vector" != "00000000" && "$reset_vector" != "ffffffff" ]]; then
                print_success "✓ Valid reset vector in vector table"
            else
                print_error "✗ Invalid reset vector: 0x$reset_vector"
            fi
        else
            print_error "✗ Could not read vector table"
        fi
        echo

        # Overall assessment
        print_info "DIAGNOSTIC SUMMARY:"
        echo "==================="

        local issues_found=0

        # Check if app is properly relocated
        if [[ "$vtor_val" != "0x08006000" ]]; then
            print_error "• VTOR not relocated to app address"
            echo "  Expected: 0x08006000, Got: $vtor_val"
            ((issues_found++))
        fi

        # Check clock configuration
        if [[ -n "$rcc_cr" ]]; then
            local cr_val=$((rcc_cr))
            if ! ((cr_val & 0x02000000)); then
                print_warning "• PLL not ready - clock may be running slow"
                ((issues_found++))
            fi
        fi

        # Check USB clock
        if [[ -n "$rcc_apb1enr" ]]; then
            local apb1_val=$((rcc_apb1enr))
            if ! ((apb1_val & 0x800000)); then
                print_error "• USB clock disabled - CDC will not work"
                ((issues_found++))
            fi
        fi

        # Check GPIO clock for LED
        if [[ -n "$rcc_apb2enr" ]]; then
            local apb2_val=$((rcc_apb2enr))
            if ! ((apb2_val & 0x10)); then
                print_error "• GPIOC clock disabled - LED will not work"
                ((issues_found++))
            fi
        fi

        if ((issues_found == 0)); then
            print_success "• No obvious hardware configuration issues found"
            echo "• Issue may be in application code logic or timing"
        else
            print_warning "• Found $issues_found potential hardware configuration issues"
        fi

        echo
        print_info "NEXT STEPS:"
        echo "• If VTOR issue: Check app startup code SCB->VTOR setting"
        echo "• If clock issues: Check SystemInit() and clock configuration"
        echo "• If GPIO issues: Check GPIO initialization in app"
        echo "• If USB issues: Check USB initialization and clock setup"
        echo "• Consider debugging with GDB for step-by-step analysis"

    else
        print_error "Could not perform diagnostics - communication failed"
        return 1
    fi
}

# Check if device is in fault handler
check_fault_state() {
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed or not in PATH"
        return 1
    fi

    print_info "Checking for fault conditions..."

    # Start OpenOCD and check fault-related registers
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/fault_check.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        cat /tmp/fault_check.log
        return 1
    fi

    # Check fault status registers
    local fault_info
    fault_info=$({
        echo "halt"
        sleep 0.5

        # Core registers
        echo "reg pc"
        sleep 0.2
        echo "reg sp"
        sleep 0.2
        echo "reg lr"
        sleep 0.2

        # Fault status registers
        echo "mdw 0xE000ED28 1"  # CFSR (Configurable Fault Status Register)
        sleep 0.2
        echo "mdw 0xE000ED2C 1"  # HFSR (Hard Fault Status Register)
        sleep 0.2
        echo "mdw 0xE000ED30 1"  # DFSR (Debug Fault Status Register)
        sleep 0.2
        echo "mdw 0xE000ED34 1"  # MMFAR (Memory Management Fault Address Register)
        sleep 0.2
        echo "mdw 0xE000ED38 1"  # BFAR (Bus Fault Address Register)
        sleep 0.2

        # Check stack area for more context
        echo "mdw 0x20004fe0 8"  # Current stack area
        sleep 0.2

        echo "resume"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || true)

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null || true

    if [[ -n "$fault_info" ]]; then
        print_info "Fault Analysis Report:"
        echo "======================"

        # Extract PC and check if it's in a fault handler
        local pc_val=$(echo "$fault_info" | grep "pc " | sed 's/.*pc.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local lr_val=$(echo "$fault_info" | grep "lr " | sed 's/.*lr.*: \(0x[0-9a-fA-F]*\).*/\1/')

        echo "PC (Program Counter): $pc_val"
        echo "LR (Link Register):   $lr_val"

        # Check if PC is in known fault handlers
        if [[ "$pc_val" == "0x08006456" ]]; then
            print_error "✗ Device is stuck in HardFault_Handler!"
            echo "  This indicates a serious hardware or memory fault occurred"
        elif [[ "$pc_val" == "0x08006454" ]]; then
            print_error "✗ Device is stuck in NMI_Handler!"
        elif [[ "$pc_val" == "0x08006458" ]]; then
            print_error "✗ Device is stuck in MemManage_Handler!"
        elif [[ "$pc_val" == "0x0800645a" ]]; then
            print_error "✗ Device is stuck in BusFault_Handler!"
        elif [[ "$pc_val" == "0x0800645c" ]]; then
            print_error "✗ Device is stuck in UsageFault_Handler!"
        else
            print_success "✓ Device not in known fault handler"
        fi
        echo

        # Analyze fault status registers
        local cfsr=$(echo "$fault_info" | grep "0xe000ed28:" | sed 's/.*0xe000ed28: \([0-9a-fA-F]*\).*/0x\1/')
        local hfsr=$(echo "$fault_info" | grep "0xe000ed2c:" | sed 's/.*0xe000ed2c: \([0-9a-fA-F]*\).*/0x\1/')
        local mmfar=$(echo "$fault_info" | grep "0xe000ed34:" | sed 's/.*0xe000ed34: \([0-9a-fA-F]*\).*/0x\1/')
        local bfar=$(echo "$fault_info" | grep "0xe000ed38:" | sed 's/.*0xe000ed38: \([0-9a-fA-F]*\).*/0x\1/')

        echo "FAULT STATUS REGISTERS:"
        echo "-----------------------"
        echo "CFSR (Configurable Fault Status): $cfsr"
        echo "HFSR (Hard Fault Status):         $hfsr"
        echo "MMFAR (Mem Mgmt Fault Address):   $mmfar"
        echo "BFAR (Bus Fault Address):         $bfar"
        echo

        # Decode fault status
        if [[ -n "$cfsr" && "$cfsr" != "0x00000000" ]]; then
            local cfsr_val=$((cfsr))
            print_warning "CFSR indicates active faults:"

            # Memory Management Faults (bits 0-7)
            if ((cfsr_val & 0x01)); then echo "  • IACCVIOL: Instruction access violation"; fi
            if ((cfsr_val & 0x02)); then echo "  • DACCVIOL: Data access violation"; fi
            if ((cfsr_val & 0x08)); then echo "  • MUNSTKERR: MemManage fault during unstacking"; fi
            if ((cfsr_val & 0x10)); then echo "  • MSTKERR: MemManage fault during stacking"; fi
            if ((cfsr_val & 0x20)); then echo "  • MLSPERR: MemManage fault during lazy FP stacking"; fi
            if ((cfsr_val & 0x80)); then echo "  • MMARVALID: MMFAR contains valid address"; fi

            # Bus Faults (bits 8-15)
            if ((cfsr_val & 0x0100)); then echo "  • IBUSERR: Instruction bus error"; fi
            if ((cfsr_val & 0x0200)); then echo "  • PRECISERR: Precise data bus error"; fi
            if ((cfsr_val & 0x0400)); then echo "  • IMPRECISERR: Imprecise data bus error"; fi
            if ((cfsr_val & 0x0800)); then echo "  • UNSTKERR: Bus fault during unstacking"; fi
            if ((cfsr_val & 0x1000)); then echo "  • STKERR: Bus fault during stacking"; fi
            if ((cfsr_val & 0x2000)); then echo "  • LSPERR: Bus fault during lazy FP stacking"; fi
            if ((cfsr_val & 0x8000)); then echo "  • BFARVALID: BFAR contains valid address"; fi

            # Usage Faults (bits 16-31)
            if ((cfsr_val & 0x00010000)); then echo "  • UNDEFINSTR: Undefined instruction"; fi
            if ((cfsr_val & 0x00020000)); then echo "  • INVSTATE: Invalid state (Thumb/ARM)"; fi
            if ((cfsr_val & 0x00040000)); then echo "  • INVPC: Invalid PC load"; fi
            if ((cfsr_val & 0x00080000)); then echo "  • NOCP: No coprocessor"; fi
            if ((cfsr_val & 0x01000000)); then echo "  • UNALIGNED: Unaligned access"; fi
            if ((cfsr_val & 0x02000000)); then echo "  • DIVBYZERO: Divide by zero"; fi
        fi

        if [[ -n "$hfsr" && "$hfsr" != "0x00000000" ]]; then
            local hfsr_val=$((hfsr))
            print_warning "HFSR indicates hard faults:"
            if ((hfsr_val & 0x02)); then echo "  • VECTTBL: Vector table hard fault"; fi
            if ((hfsr_val & 0x40000000)); then echo "  • FORCED: Forced hard fault"; fi
            if ((hfsr_val & 0x80000000)); then echo "  • DEBUGEVT: Debug event hard fault"; fi
        fi

        echo
        print_info "FAULT ANALYSIS:"
        echo "==============="

        if [[ "$pc_val" == "0x08006456" ]]; then
            print_error "The device is in a hard fault state. This typically happens due to:"
            echo "• Invalid memory access (wrong pointer, uninitialized variables)"
            echo "• Stack overflow"
            echo "• Jump to invalid address"
            echo "• Clock configuration issues causing bus faults"
            echo "• Problems with vector table relocation"
            echo
            print_info "RECOMMENDED DEBUGGING STEPS:"
            echo "1. Check if the problem occurs during HAL_Init() or SystemClock_Config()"
            echo "2. Verify that stack pointer and vector table are correctly set"
            echo "3. Use a debugger to step through initialization code"
            echo "4. Check if HSE crystal is properly connected (if using external crystal)"
            echo "5. Verify that bootloader properly set up the jump to application"
        fi

    else
        print_error "Could not retrieve fault information"
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
    echo "  check-device      - Check device running status (bootloader/app/crashed)
  diagnose-device   - Advanced device diagnostics (registers, clocks, GPIO, USB)
  check-fault       - Analyze fault conditions and crash state"
    echo "  erase-flash       - Erase entire flash memory (WARNING: removes everything)"
    echo "  mass-erase        - Mass erase flash including option bytes (DANGEROUS)"
    echo "  help              - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 build bootloader     # Build bootloader"
    echo "  $0 build app            # Build application"
    echo "  $0 build legacy         # Build legacy single image"
    echo "  $0 clean all            # Clean all build directories"
    echo "  $0 flash bootloader     # Flash bootloader"
    echo "  $0 check-device         # Quick device status check
  $0 diagnose-device      # Advanced diagnostics for troubleshooting
  $0 check-fault          # Analyze fault conditions if device crashed"
    echo "  $0 erase-flash          # Completely erase flash memory"
    echo "  $0 mass-erase           # Mass erase (resets option bytes too)"
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
        "check-device")
            check_device_status
            ;;
        "diagnose-device")
            diagnose_device
            ;;
        "check-fault")
            check_fault_state
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
