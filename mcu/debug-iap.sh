#!/bin/bash

##########################################################################################################################
# Debug Helper Script for STM32F103C8T6 IAP Issue Diagnosis
##########################################################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}STM32F103C8T6 IAP Debug Helper${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo
}

# Check ST-Link connection
check_stlink_connection() {
    print_info "Checking ST-Link connection..."

    # Check if ST-Link tools are available
    if command -v st-info &> /dev/null; then
        print_success "ST-Link tools found"
        if st-info --probe &> /dev/null; then
            print_success "ST-Link device detected"
            st-info --chipid
        else
            print_error "No ST-Link device found"
            return 1
        fi
    else
        print_warning "ST-Link tools not found, checking with OpenOCD only"
    fi

    # Check with OpenOCD
    print_info "Testing OpenOCD connection..."

    # Use different timeout methods based on OS
    local timeout_cmd=""
    if command -v gtimeout &> /dev/null; then
        timeout_cmd="gtimeout 10s"
    elif command -v timeout &> /dev/null; then
        timeout_cmd="timeout 10s"
    else
        # No timeout available, run without timeout
        timeout_cmd=""
    fi

    if [[ -n "$timeout_cmd" ]]; then
        if $timeout_cmd openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; exit" > /tmp/openocd_test.log 2>&1; then
            print_success "OpenOCD can connect to target"
        else
            print_error "OpenOCD connection failed"
            print_error "OpenOCD output:"
            cat /tmp/openocd_test.log
            return 1
        fi
    else
        # Run without timeout - start OpenOCD in background and kill after delay
        print_warning "No timeout command available, using alternative method..."
        openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "init; reset halt; exit" > /tmp/openocd_test.log 2>&1 &
        local openocd_test_pid=$!
        sleep 5

        if kill -0 $openocd_test_pid 2>/dev/null; then
            kill $openocd_test_pid 2>/dev/null || true
            wait $openocd_test_pid 2>/dev/null || true
        fi

        if grep -q "Info : stm32f1x.cpu: hardware has\|halted due to debug-request\|xPSR:\|pc:\|msp:" /tmp/openocd_test.log; then
            print_success "OpenOCD can connect to target"

            # Show current CPU state if available
            if grep -q "halted due to debug-request" /tmp/openocd_test.log; then
                print_info "Device is currently halted:"
                grep -E "halted due to debug-request|xPSR:|pc:|msp:" /tmp/openocd_test.log | while read -r line; do
                    echo "  $line"
                done

                # Analyze PC to determine current state
                local pc_value=$(grep "pc:" /tmp/openocd_test.log | sed 's/.*pc: \(0x[0-9a-fA-F]*\).*/\1/')
                if [[ -n "$pc_value" ]]; then
                    if [[ "$pc_value" =~ ^0x0800[0-5] ]]; then
                        print_info "Device appears to be running bootloader code"
                    elif [[ "$pc_value" =~ ^0x0800[6-9A-Fa-f] ]]; then
                        print_info "Device appears to be running application code"
                    else
                        print_warning "Device PC is in unexpected region: $pc_value"
                    fi
                fi
            fi
        else
            print_error "OpenOCD connection failed"
            print_error "OpenOCD output:"
            cat /tmp/openocd_test.log
            return 1
        fi
    fi
}

# Check memory regions using OpenOCD
check_memory_regions() {
    print_info "Checking memory regions..."

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        return 1
    fi

    # Start OpenOCD in background and connect to it
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /dev/null 2>&1 &
    local openocd_pid=$!
    sleep 2

    # Check if OpenOCD started successfully
    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        return 1
    fi

    # Connect via telnet and read memory regions
    {
        echo "reset halt"
        sleep 0.5
        echo "mdw 0x08000000 4"  # Bootloader vector table
        sleep 0.5
        echo "mdw 0x08006000 4"  # App vector table
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null | grep -E "0x[0-9a-fA-F]+" || true

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null || true
}

# Check if flash is blank
check_flash_blank() {
    print_info "Checking if flash is blank..."

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        return 1
    fi

    # Start OpenOCD in background and connect to it
    print_info "Starting OpenOCD..."
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/openocd.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    # Check if OpenOCD started successfully
    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        print_error "OpenOCD log:"
        cat /tmp/openocd.log
        return 1
    fi

    # Test telnet connection first
    print_info "Testing telnet connection to OpenOCD..."
    local connection_test=false

    # Try different methods to test the connection
    if command -v nc &> /dev/null; then
        if nc -z localhost 4444 2>/dev/null; then
            connection_test=true
        elif nc -w 1 localhost 4444 < /dev/null 2>/dev/null; then
            connection_test=true
        fi
    fi

    # Alternative test using telnet directly
    if [[ "$connection_test" == false ]]; then
        if echo "exit" | telnet localhost 4444 2>/dev/null | grep -q "Connected\|telnet"; then
            connection_test=true
        fi
    fi

    if [[ "$connection_test" == false ]]; then
        print_error "Cannot connect to OpenOCD telnet interface"
        print_warning "OpenOCD may not be ready yet, retrying in 2 seconds..."
        sleep 2

        # Retry once more
        if command -v nc &> /dev/null && nc -z localhost 4444 2>/dev/null; then
            connection_test=true
        elif echo "exit" | telnet localhost 4444 2>/dev/null | grep -q "Connected\|telnet"; then
            connection_test=true
        fi

        if [[ "$connection_test" == false ]]; then
            print_error "Still cannot connect to OpenOCD telnet interface"
            kill $openocd_pid 2>/dev/null || true
            return 1
        fi
    fi

    print_info "Reading flash data..."
    # Connect via telnet and check first few words of flash
    local flash_data
    flash_data=$({
        echo "reset halt"
        sleep 0.5
        echo "mdw 0x08000000 8"  # Read first 32 bytes
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null | grep -E "0x[0-9a-fA-F]+:" || true)

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null

    if [[ -n "$flash_data" ]]; then
        if echo "$flash_data" | grep -q "ffffffff"; then
            local blank_count=$(echo "$flash_data" | grep -o "ffffffff" | wc -l)
            if [[ $blank_count -ge 6 ]]; then
                print_success "Flash appears to be blank (erased)"
            else
                print_warning "Flash contains some data"
                echo "$flash_data"
            fi
        else
            print_info "Flash contains firmware data"
            echo "$flash_data"
        fi
    else
        print_warning "Could not read flash data"
        print_warning "Check if ST-Link is connected and device is powered"
    fi
}

# Analyze hex files
analyze_hex_files() {
    print_info "Analyzing hex files..."

    local bootloader_hex="build/bootloader/bootloader/chis_flash_burner_bootloader.hex"
    local app_hex="build/app/app/chis_flash_burner_app.hex"

    if [[ -f "$bootloader_hex" ]]; then
        print_success "Bootloader hex found: $bootloader_hex"
        local size=$(wc -l < "$bootloader_hex")
        echo "  Lines: $size"

        # Check if bootloader starts at 0x08000000
        if head -10 "$bootloader_hex" | grep -q ":020000040800"; then
            print_success "Bootloader correctly targeted at 0x08000000"
        else
            print_warning "Bootloader may not be correctly targeted"
        fi
    else
        print_warning "Bootloader hex not found"
    fi

    if [[ -f "$app_hex" ]]; then
        print_success "App hex found: $app_hex"
        local size=$(wc -l < "$app_hex")
        echo "  Lines: $size"

        # Check if app starts at 0x08006000
        if head -10 "$app_hex" | grep -q ":020000040800"; then
            if grep -q ":10600000" "$app_hex"; then
                print_success "App correctly targeted at 0x08006000"
            else
                print_error "App hex does not contain 0x08006000 address"
            fi
        else
            print_warning "App may not be correctly targeted"
        fi
    else
        print_warning "App hex not found"
    fi
}

# Show memory layout
show_memory_layout() {
    print_info "Expected Memory Layout:"
    echo "  Flash Total:      64KB  (0x08000000 - 0x0800FFFF)"
    echo "  Bootloader:       24KB  (0x08000000 - 0x08005FFF)"
    echo "  Application:      40KB  (0x08006000 - 0x0800FFFF)"
    echo "  RAM:              20KB  (0x20000000 - 0x20004FFF)"
    echo
    print_info "Vector Table Locations:"
    echo "  Bootloader vectors: 0x08000000"
    echo "  Application vectors: 0x08006000"
    echo
}

# Verify flash content against hex files
verify_flash_content() {
    print_info "Verifying flash content against hex files..."

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        return 1
    fi

    # Start OpenOCD in background
    print_info "Starting OpenOCD for flash verification..."
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/openocd_verify.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    # Check if OpenOCD started successfully
    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD for verification"
        print_error "OpenOCD log:"
        cat /tmp/openocd_verify.log
        return 1
    fi

    # Test telnet connection
    print_info "Testing telnet connection for verification..."
    local connection_test=false

    # Try different methods to test the connection
    if command -v nc &> /dev/null; then
        if nc -z localhost 4444 2>/dev/null; then
            connection_test=true
        elif nc -w 1 localhost 4444 < /dev/null 2>/dev/null; then
            connection_test=true
        fi
    fi

    # Alternative test using telnet directly
    if [[ "$connection_test" == false ]]; then
        if echo "exit" | telnet localhost 4444 2>/dev/null | grep -q "Connected\|telnet"; then
            connection_test=true
        fi
    fi

    if [[ "$connection_test" == false ]]; then
        print_error "Cannot connect to OpenOCD telnet interface for verification"
        kill $openocd_pid 2>/dev/null || true
        return 1
    fi

    print_info "Reading bootloader region (0x08000000-0x08005FFF)..."
    # Read bootloader region
    local bootloader_data
    bootloader_data=$({
        echo "reset halt"
        sleep 0.5
        echo "mdw 0x08000000 16"  # First 64 bytes (vector table)
        sleep 0.5
        echo "mdw 0x08005F00 16"  # Last 64 bytes of bootloader
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null | grep -E "0x[0-9a-fA-F]+:" || true)

    print_info "Reading application region (0x08006000-0x0800FFFF)..."
    # Read application region
    local app_data
    app_data=$({
        echo "reset halt"
        sleep 0.5
        echo "mdw 0x08006000 16"  # First 64 bytes of app (vector table)
        sleep 0.5
        echo "mdw 0x0800FF00 16"  # Last 64 bytes of flash
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null | grep -E "0x[0-9a-fA-F]+:" || true)

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null

    # Analyze bootloader data
    if [[ -n "$bootloader_data" ]]; then
        print_success "Bootloader region data read successfully:"
        echo "$bootloader_data"

        # Check if vector table looks valid
        local first_word=$(echo "$bootloader_data" | head -1 | sed 's/.*: \([0-9a-fA-F]\{8\}\).*/\1/')
        if [[ "$first_word" =~ ^2000[0-9a-fA-F]{4}$ ]]; then
            print_success "Bootloader stack pointer appears valid: 0x$first_word"
        else
            print_warning "Bootloader stack pointer may be invalid: 0x$first_word"
        fi
    else
        print_error "Could not read bootloader region"
    fi

    echo

    # Analyze application data
    if [[ -n "$app_data" ]]; then
        print_success "Application region data read successfully:"
        echo "$app_data"

        # Check if app region contains valid data (not all 0xFF)
        if echo "$app_data" | grep -q "ffffffff"; then
            local ff_count=$(echo "$app_data" | grep -o "ffffffff" | wc -l)
            if [[ $ff_count -ge 10 ]]; then
                print_warning "Application region appears to be mostly blank"
            else
                print_info "Application region contains mixed data"
            fi
        else
            print_success "Application region contains firmware data"

            # Check if vector table looks valid
            local app_stack=$(echo "$app_data" | head -1 | sed 's/.*: \([0-9a-fA-F]\{8\}\).*/\1/')
            if [[ "$app_stack" =~ ^2000[0-9a-fA-F]{4}$ ]]; then
                print_success "Application stack pointer appears valid: 0x$app_stack"
            else
                print_warning "Application stack pointer may be invalid: 0x$app_stack"
            fi
        fi
    else
        print_error "Could not read application region"
    fi
}

# Compare flash with hex file (simplified and more reliable)
compare_flash_with_hex() {
    local hex_file="$1"
    local flash_address="$2"
    local description="$3"

    print_info "Comparing $description flash content with hex file..."

    if [[ ! -f "$hex_file" ]]; then
        print_warning "Hex file not found: $hex_file"
        return 1
    fi

    # Analyze hex file first
    print_info "Analyzing hex file structure..."
    if grep -q ":020000040800" "$hex_file"; then
        print_success "- Extended address record for 0x0800xxxx found"
    fi

    local data_records=$(grep -c "^:[0-9A-F]\{8\}00" "$hex_file" || echo "0")
    print_info "- $data_records data records found"

    # Extract first data record for comparison
    local hex_start_data=""
    if [[ "$description" == "Bootloader" ]]; then
        hex_start_data=$(grep "^:10000000" "$hex_file" | head -1 | sed 's/^:10000000\([0-9A-F]*\)[0-9A-F][0-9A-F]$/\1/')
    elif [[ "$description" == "Application" ]]; then
        hex_start_data=$(grep "^:10600000" "$hex_file" | head -1 | sed 's/^:10600000\([0-9A-F]*\)[0-9A-F][0-9A-F]$/\1/')
    fi

    if [[ -n "$hex_start_data" ]]; then
        print_success "Found hex data starting at expected address"
        print_info "First 16 bytes from hex: $hex_start_data"

        # Convert to little-endian words for display
        if [[ ${#hex_start_data} -ge 16 ]]; then
            local hex_word1=$(echo "$hex_start_data" | cut -c7-8)$(echo "$hex_start_data" | cut -c5-6)$(echo "$hex_start_data" | cut -c3-4)$(echo "$hex_start_data" | cut -c1-2)
            local hex_word2=$(echo "$hex_start_data" | cut -c15-16)$(echo "$hex_start_data" | cut -c13-14)$(echo "$hex_start_data" | cut -c11-12)$(echo "$hex_start_data" | cut -c9-10)
            print_info "Hex file words: 0x$(echo $hex_word1 | tr '[:upper:]' '[:lower:]') 0x$(echo $hex_word2 | tr '[:upper:]' '[:lower:]')"
        fi
    else
        print_warning "Could not find expected start address in hex file"
        if [[ "$description" == "Bootloader" ]]; then
            print_info "Looking for :10000000 record (0x08000000)"
        else
            print_info "Looking for :10600000 record (0x08006000)"
        fi
    fi

    # Quick OpenOCD flash check using a simpler method
    print_info "Quick flash verification..."
    if command -v openocd &> /dev/null; then
        # Use OpenOCD's verify command if possible
        local timeout_cmd=""
        if command -v gtimeout &> /dev/null; then
            timeout_cmd="gtimeout 10s"
        elif command -v timeout &> /dev/null; then
            timeout_cmd="timeout 10s"
        fi

        local verify_cmd="openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c \"init\" -c \"reset halt\" -c \"verify_image $hex_file\" -c \"exit\""

        if [[ -n "$timeout_cmd" ]]; then
            if $timeout_cmd bash -c "$verify_cmd" > /tmp/verify_result.log 2>&1; then
                print_success "$description: Flash verification PASSED!"
                print_info "OpenOCD verify command completed successfully"
            else
                print_warning "$description: Flash verification may have issues"
                print_info "OpenOCD verify output:"
                cat /tmp/verify_result.log | tail -10
            fi
        else
            # No timeout available, run verify in background and kill after delay
            bash -c "$verify_cmd" > /tmp/verify_result.log 2>&1 &
            local verify_pid=$!
            sleep 8

            if kill -0 $verify_pid 2>/dev/null; then
                kill $verify_pid 2>/dev/null || true
                wait $verify_pid 2>/dev/null || true
            fi

            if grep -q "verified" /tmp/verify_result.log; then
                print_success "$description: Flash verification PASSED!"
            else
                print_warning "$description: Flash verification may have issues"
                print_info "OpenOCD verify output:"
                cat /tmp/verify_result.log | tail -10
            fi
        fi
    else
        print_warning "OpenOCD not available for flash verification"
    fi

    print_success "$description comparison completed"
}

# Check system dependencies
check_dependencies() {
    print_info "Checking system dependencies..."

    # Check OpenOCD
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        print_info "On macOS, install with: brew install openocd"
        return 1
    else
        print_success "OpenOCD found: $(which openocd)"
    fi

    # Check telnet
    if ! command -v telnet &> /dev/null; then
        print_error "telnet is not available"
        print_info "On macOS, install with: brew install telnet"
        return 1
    else
        print_success "telnet found: $(which telnet)"
    fi

    # Check netcat (optional)
    if command -v nc &> /dev/null; then
        print_success "netcat found: $(which nc)"
    else
        print_warning "netcat not found (optional)"
    fi

    # Check timeout command (optional)
    if command -v timeout &> /dev/null; then
        print_success "timeout found: $(which timeout)"
    elif command -v gtimeout &> /dev/null; then
        print_success "gtimeout found: $(which gtimeout)"
    else
        print_warning "timeout command not found (using alternative method)"
        print_info "On macOS, install with: brew install coreutils"
    fi

    return 0
}

# Show current device state
show_device_state() {
    print_info "Reading current device state..."

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        return 1
    fi

    # Start OpenOCD and read device state
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/device_state.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        return 1
    fi

    # Read CPU state and memory
    local state_info
    state_info=$({
        echo "reset halt"
        sleep 0.5
        echo "reg"  # Show all registers
        sleep 0.5
        echo "mdw 0x08000000 4"  # Bootloader vector table
        sleep 0.5
        echo "mdw 0x08006000 4"  # App vector table
        sleep 0.5
        echo "mdw 0xE000ED08 1"  # VTOR register
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || true)

    # Clean up
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null

    if [[ -n "$state_info" ]]; then
        print_success "Device state information:"
        echo "$state_info" | grep -E "pc|sp|xPSR|0x08000000|0x08006000|0xE000ED08" | while read -r line; do
            echo "  $line"
        done

        # Parse and analyze key information
        local pc_val=$(echo "$state_info" | grep "pc " | sed 's/.*pc.*: \(0x[0-9a-fA-F]*\).*/\1/')
        local vtor_val=$(echo "$state_info" | grep "0xe000ed08:" | sed 's/.*0xe000ed08: \([0-9a-fA-F]*\).*/0x\1/')

        echo
        if [[ -n "$pc_val" ]]; then
            print_info "Program Counter: $pc_val"
            if [[ "$pc_val" =~ ^0x0800[0-5] ]]; then
                print_success "Device is in bootloader region"
            elif [[ "$pc_val" =~ ^0x0800[6-9A-Fa-f] ]]; then
                print_success "Device is in application region"
            fi
        fi

        if [[ -n "$vtor_val" && "$vtor_val" != "0x00000000" ]]; then
            print_info "Vector Table Offset: $vtor_val"
            if [[ "$vtor_val" == "0x08006000" ]]; then
                print_success "VTOR points to application vectors"
            elif [[ "$vtor_val" == "0x08000000" ]]; then
                print_info "VTOR points to bootloader vectors"
            fi
        fi
    else
        print_warning "Could not read device state"
    fi
}

# Analyze current PC location using objdump
analyze_pc_location() {
    print_info "Analyzing current PC location..."

    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        return 1
    fi

    if ! command -v arm-none-eabi-objdump &> /dev/null; then
        print_error "arm-none-eabi-objdump is not installed"
        print_info "On macOS, install with: brew install --cask gcc-arm-embedded"
        return 1
    fi

    # Start OpenOCD and read PC
    print_info "Starting OpenOCD to read PC..."
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/pc_analysis.log 2>&1 &
    local openocd_pid=$!
    sleep 3

    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "Failed to start OpenOCD"
        print_error "OpenOCD log:"
        cat /tmp/pc_analysis.log
        return 1
    fi

    # Test telnet connection
    local connection_test=false
    if command -v nc &> /dev/null && nc -z localhost 4444 2>/dev/null; then
        connection_test=true
    elif echo "exit" | telnet localhost 4444 2>/dev/null | grep -q "Connected\|telnet"; then
        connection_test=true
    fi

    if [[ "$connection_test" == false ]]; then
        print_error "Cannot connect to OpenOCD telnet interface"
        kill $openocd_pid 2>/dev/null || true
        return 1
    fi

    # Read current PC value
    print_info "Reading current PC value..."
    local pc_output
    pc_output=$({
        echo "reset halt"
        sleep 0.5
        echo "reg pc"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || true)

    # Clean up OpenOCD
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null

    # Extract PC value
    local pc_value=$(echo "$pc_output" | grep -E "pc.*:" | sed 's/.*pc.*: \(0x[0-9a-fA-F]*\).*/\1/')

    if [[ -z "$pc_value" ]]; then
        print_error "Could not read PC value from device"
        print_warning "OpenOCD output:"
        echo "$pc_output"
        return 1
    fi

    print_success "Current PC: $pc_value"

    # Determine which ELF file to use based on PC value
    local elf_file=""
    local region_name=""

    if [[ "$pc_value" =~ ^0x0800[0-5] ]]; then
        elf_file="build/bootloader/bootloader/chis_flash_burner_bootloader.elf"
        region_name="bootloader"
        print_info "PC is in bootloader region (0x08000000-0x08005FFF)"
    elif [[ "$pc_value" =~ ^0x0800[6-9A-Fa-f] ]]; then
        elf_file="build/app/app/chis_flash_burner_app.elf"
        region_name="application"
        print_info "PC is in application region (0x08006000-0x0800FFFF)"
    else
        print_warning "PC is in unexpected region: $pc_value"
        # Try both ELF files
        local bootloader_elf="build/bootloader/bootloader/chis_flash_burner_bootloader.elf"
        local app_elf="build/app/app/chis_flash_burner_app.elf"

        if [[ -f "$app_elf" ]]; then
            elf_file="$app_elf"
            region_name="application (fallback)"
        elif [[ -f "$bootloader_elf" ]]; then
            elf_file="$bootloader_elf"
            region_name="bootloader (fallback)"
        fi
    fi

    if [[ -z "$elf_file" || ! -f "$elf_file" ]]; then
        print_error "Cannot find appropriate ELF file for PC analysis"
        print_warning "Expected files:"
        echo "  Bootloader: build/bootloader/bootloader/chis_flash_burner_bootloader.elf"
        echo "  Application: build/app/app/chis_flash_burner_app.elf"
        print_info "Build the project first with: ./cmake-build.sh build"
        return 1
    fi

    print_success "Using ELF file: $elf_file ($region_name)"

    # Use objdump to find the function and instruction at PC
    print_info "Analyzing code location with objdump..."

    # Convert PC to decimal for addr2line if available
    local pc_decimal
    pc_decimal=$(printf "%d" "$pc_value" 2>/dev/null || echo "")

    # Method 1: Use addr2line if available
    if command -v arm-none-eabi-addr2line &> /dev/null && [[ -n "$pc_decimal" ]]; then
        print_info "Using addr2line to find source location..."
        local source_info
        source_info=$(arm-none-eabi-addr2line -e "$elf_file" -f -C "$pc_value" 2>/dev/null || echo "")

        if [[ -n "$source_info" && "$source_info" != "??:0" && "$source_info" != "??:?" ]]; then
            print_success "Source location found:"
            echo "$source_info" | while IFS= read -r line; do
                echo "  $line"
            done
        else
            print_warning "addr2line could not resolve source location"
        fi
        echo
    fi

    # Method 2: Use objdump disassembly around PC
    print_info "Disassembling around PC location..."

    # Calculate a range around PC (±64 bytes)
    local pc_num
    pc_num=$(printf "%d" "$pc_value" 2>/dev/null || echo "0")

    if [[ "$pc_num" -gt 0 ]]; then
        local start_addr
        local end_addr
        start_addr=$(printf "0x%x" $((pc_num - 32)))
        end_addr=$(printf "0x%x" $((pc_num + 32)))

        print_info "Disassembling range: $start_addr to $end_addr"

        # Use objdump to show disassembly around PC
        local disasm_output
        disasm_output=$(arm-none-eabi-objdump -d -C "$elf_file" --start-address="$start_addr" --stop-address="$end_addr" 2>/dev/null || echo "")

        if [[ -n "$disasm_output" ]]; then
            print_success "Disassembly around PC:"
            echo "$disasm_output" | while IFS= read -r line; do
                # Highlight the current PC line
                if echo "$line" | grep -q "$pc_value"; then
                    echo -e "${RED}>>> $line ${NC}"
                else
                    echo "    $line"
                fi
            done
        else
            print_warning "Could not disassemble around PC address"
        fi
    fi

    echo

    # Method 3: Find the function containing PC
    print_info "Finding function containing PC..."

    # Use objdump with -t to get symbol table
    local symbol_output
    symbol_output=$(arm-none-eabi-objdump -t "$elf_file" 2>/dev/null | grep -E " F " | sort || echo "")

    if [[ -n "$symbol_output" ]]; then
        local current_function=""
        local pc_num_hex
        pc_num_hex=$(printf "%08x" "$pc_num" 2>/dev/null || echo "")

        # Find function that contains this PC
        while IFS= read -r line; do
            local func_addr=$(echo "$line" | awk '{print $1}')
            local func_name=$(echo "$line" | awk '{print $NF}')

            if [[ -n "$func_addr" && -n "$func_name" ]]; then
                local func_addr_num
                func_addr_num=$(printf "%d" "0x$func_addr" 2>/dev/null || echo "0")

                if [[ "$func_addr_num" -le "$pc_num" ]]; then
                    current_function="$func_name (0x$func_addr)"
                fi
            fi
        done <<< "$symbol_output"

        if [[ -n "$current_function" ]]; then
            print_success "Likely function: $current_function"
        else
            print_warning "Could not determine function containing PC"
        fi
    else
        print_warning "Could not read symbol table from ELF file"
    fi

    echo

    # Method 4: Show full disassembly of the function if we can find it
    if [[ -n "$current_function" ]]; then
        local func_name_only=$(echo "$current_function" | sed 's/ (.*//')
        print_info "Disassembling function: $func_name_only"

        local func_disasm
        func_disasm=$(arm-none-eabi-objdump -d -C "$elf_file" 2>/dev/null | \
                     awk "/^[0-9a-f]+ <$func_name_only[>:]/{flag=1} flag && /^$/{exit} flag" || echo "")

        if [[ -n "$func_disasm" ]]; then
            print_success "Function disassembly:"
            echo "$func_disasm" | while IFS= read -r line; do
                # Highlight the current PC line
                if echo "$line" | grep -q "$pc_value"; then
                    echo -e "${RED}>>> $line ${NC}"
                else
                    echo "    $line"
                fi
            done
        else
            print_warning "Could not disassemble function $func_name_only"
        fi
    fi

    # Summary
    echo
    print_info "PC Analysis Summary:"
    echo "  Current PC: $pc_value"
    echo "  Region: $region_name"
    echo "  ELF file: $elf_file"
    if [[ -n "$current_function" ]]; then
        echo "  Function: $current_function"
    fi

    # Suggest next steps based on PC location
    if [[ "$pc_value" =~ ^0x0800[0-5] ]]; then
        print_info "Device is running bootloader code"
        echo "  - This is expected if device just booted or is in IAP mode"
        echo "  - Check if bootloader is trying to jump to application"
    elif [[ "$pc_value" =~ ^0x0800[6-9A-Fa-f] ]]; then
        print_info "Device is running application code"
        echo "  - This indicates successful bootloader->app transition"
        echo "  - If app is not working, check initialization issues"
    else
        print_warning "Device PC is in unexpected location"
        echo "  - Device may be crashed or in fault handler"
        echo "  - Check for HardFault or other exceptions"
    fi
}

# Quick fault check - combines device state and PC analysis
quick_fault_check() {
    print_header

    print_info "Quick Fault Check - Device Status & PC Analysis"
    echo "=================================================="
    echo

    # Quick dependency check
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD is not installed"
        return 1
    fi

    # Check connection
    print_info "1. Checking device connection..."
    if ! check_stlink_connection > /dev/null 2>&1; then
        print_error "Cannot connect to device - check connections"
        return 1
    fi
    print_success "Device connected"
    echo

    # Show current state
    print_info "2. Reading device state..."
    show_device_state
    echo

    # Analyze PC location
    print_info "3. Analyzing PC location..."
    analyze_pc_location

    echo
    print_info "Quick diagnosis completed!"
}

# Main debug function
main_debug() {
    print_header

    # Check system dependencies first
    if ! check_dependencies; then
        print_error "Missing required dependencies"
        return 1
    fi

    echo

    # First check if we can connect to the device
    print_info "Checking device connection..."
    if ! check_stlink_connection; then
        print_error "Cannot establish connection to STM32 device"
        print_info "Please check:"
        echo "- ST-Link is connected via USB"
        echo "- Target board is powered"
        echo "- SWD/JTAG connections are correct"
        echo "- No other debugger is using the device"
        echo "- On macOS, you may need to install drivers: https://www.st.com/en/development-tools/stsw-link009.html"
        echo
        print_info "You can still analyze hex files without device connection:"
        analyze_hex_files
        return 1
    fi

    echo
    show_memory_layout

    # Show current device state
    show_device_state
    echo

    check_flash_blank
    echo
    analyze_hex_files
    echo
    verify_flash_content
    echo

    # Compare with hex files if they exist
    local bootloader_hex="build/bootloader/bootloader/chis_flash_burner_bootloader.hex"
    local app_hex="build/app/app/chis_flash_burner_app.hex"

    if [[ -f "$bootloader_hex" ]]; then
        compare_flash_with_hex "$bootloader_hex" "0x08000000" "Bootloader"
        echo
    fi

    if [[ -f "$app_hex" ]]; then
        compare_flash_with_hex "$app_hex" "0x08006000" "Application"
        echo
    fi

    print_info "Debug Steps to Try:"
    echo "1. Build both bootloader and app:"
    echo "   ./cmake-build.sh build bootloader"
    echo "   ./cmake-build.sh build app"
    echo
    echo "2. Flash bootloader first:"
    echo "   ./cmake-build.sh flash bootloader"
    echo
    echo "3. Test bootloader (should show IAP mode)"
    echo
    echo "4. Flash app safely:"
    echo "   ./cmake-build.sh flash-app-safe"
    echo
    echo "5. Reset device and check if it boots to app"
    echo
    print_warning "If app still doesn't work, check:"
    echo "- Vector table relocation (VTOR register)"
    echo "- Application compilation with correct offset"
    echo "- Stack pointer validity"
    echo "- Reset vector validity"
    echo
    print_info "Additional verification commands:"
    echo "- Run this script again to verify flash content"
    echo "- Check OpenOCD connection with: openocd -f interface/stlink.cfg -f target/stm32f1x.cfg"
    echo "- Manual telnet test: telnet localhost 4444"
}

# Print usage information
print_usage() {
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  diagnose       - Full diagnostic (default)"
    echo "  check-fault    - Quick fault check with PC analysis"
    echo "  pc-analysis    - Analyze current PC location only" 
    echo "  device-state   - Show current device state only"
    echo "  flash-check    - Check flash content only"
    echo "  deps           - Check system dependencies"
    echo "  help           - Show this help"
    echo
    echo "Examples:"
    echo "  $0                    # Run full diagnostic"
    echo "  $0 check-fault       # Quick fault check"
    echo "  $0 pc-analysis       # Analyze current PC location"
    echo
}

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR/chis_flash_burner"

# Parse command line arguments
case "${1:-diagnose}" in
    "diagnose"|"")
        check_dependencies
        main_debug
        ;;
    "check-fault")
        quick_fault_check
        ;;
    "pc-analysis")
        analyze_pc_location
        ;;
    "device-state")
        show_device_state
        ;;
    "flash-check")
        check_flash_blank
        echo
        verify_flash_content
        ;;
    "deps")
        check_dependencies
        ;;
    "help"|"-h"|"--help")
        print_usage
        ;;
    *)
        print_error "Unknown command: $1"
        echo
        print_usage
        exit 1
        ;;
esac
