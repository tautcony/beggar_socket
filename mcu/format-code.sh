#!/bin/bash

# Format-code.sh - Code formatting helper for STM32 project
# Formats specific C source files and their corresponding headers:
# - Core/Src: main.c, uart.c, cart_adapter.c
# - Core/Inc: main.h, uart.h, cart_adapter.h

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if clang-format is available
if ! command -v clang-format &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} clang-format is not installed"
    exit 1
fi

# Function to find specific C source and header files
find_source_files() {
    # Specific C source files in Core/Src
    find chis_flash_burner/Core/Src -name "main.c" -o -name "uart.c" -o -name "cart_adapter.c" 2>/dev/null
    # Corresponding header files in Core/Inc
    find chis_flash_burner/Core/Inc -name "main.h" -o -name "uart.h" -o -name "cart_adapter.h" 2>/dev/null
}

# Check formatting
check_format() {
    local files=$(find_source_files)
    if [ -z "$files" ]; then
        echo -e "${YELLOW}[INFO]${NC} No source files found"
        return 0
    fi
    
    local needs_formatting=false
    for file in $files; do
        if ! clang-format --dry-run --Werror "$file" &>/dev/null; then
            echo -e "${RED}[NEEDS FORMAT]${NC} $file"
            needs_formatting=true
        fi
    done
    
    if [ "$needs_formatting" = false ]; then
        echo -e "${GREEN}[OK]${NC} All files are properly formatted"
        return 0
    else
        return 1
    fi
}

# Format files
format_files() {
    local files=$(find_source_files)
    if [ -z "$files" ]; then
        echo -e "${YELLOW}[INFO]${NC} No source files found"
        return 0
    fi
    
    for file in $files; do
        echo -e "${YELLOW}[FORMAT]${NC} $file"
        clang-format -i "$file"
    done
    echo -e "${GREEN}[DONE]${NC} Formatting complete"
}

# Show what would be changed (dry run)
dry_run() {
    local files=$(find_source_files)
    if [ -z "$files" ]; then
        echo -e "${YELLOW}[INFO]${NC} No source files found"
        return 0
    fi
    
    for file in $files; do
        echo -e "${YELLOW}[DRY RUN]${NC} $file"
        clang-format "$file" | diff -u "$file" - || true
    done
}

# Main command handling
case "$1" in
    "check")
        echo -e "${YELLOW}[INFO]${NC} Checking format of source and header files..."
        check_format
        ;;
    "format")
        echo -e "${YELLOW}[INFO]${NC} Formatting source and header files..."
        format_files
        ;;
    "dry-run")
        echo -e "${YELLOW}[INFO]${NC} Dry run - showing formatting changes..."
        dry_run
        ;;
    *)
        echo "Usage: $0 {check|format|dry-run}"
        echo "  check    - Check if files need formatting"
        echo "  format   - Format files in place"
        echo "  dry-run  - Show what changes would be made"
        exit 1
        ;;
esac
