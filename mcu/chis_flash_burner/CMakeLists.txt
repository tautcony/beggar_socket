##########################################################################################################################
# STM32F103C8T6 Project CMakeLists.txt
# Target: chis_flash_burner (Single Firmware)
# MCU: STM32F103C8T6 (Cortex-M3)
##########################################################################################################################

cmake_minimum_required(VERSION 3.16)

# Set the cross-compilation toolchain
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)

# Toolchain settings
set(TOOLCHAIN_PREFIX arm-none-eabi-)
set(CMAKE_C_COMPILER ${TOOLCHAIN_PREFIX}gcc)
set(CMAKE_ASM_COMPILER ${TOOLCHAIN_PREFIX}gcc)
set(CMAKE_OBJCOPY ${TOOLCHAIN_PREFIX}objcopy)
set(CMAKE_SIZE ${TOOLCHAIN_PREFIX}size)

# Don't run the linker on compiler check
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)

# Project definition
project(chis_flash_burner C ASM)
set(CMAKE_C_STANDARD 11)

# Build type configuration
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE "Debug")
endif()

message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")

##########################################################################################################################
# MCU Configuration
##########################################################################################################################

# MCU specific settings
set(MCU_FAMILY STM32F1xx)
set(MCU_MODEL STM32F103xB)
set(CPU_PARAMETERS
    -mcpu=cortex-m3
    -mthumb
)

##########################################################################################################################
# Source Files
##########################################################################################################################

# Project sources
set(PROJECT_SOURCES
    Core/Src/main.c
    Core/Src/cart_adapter.c
    Core/Src/uart.c
    Core/Src/stm32f1xx_hal_msp.c
    Core/Src/stm32f1xx_it.c
    Core/Src/syscalls.c
    Core/Src/sysmem.c
    Core/Src/system_stm32f1xx.c
)

# HAL Driver sources
set(HAL_SOURCES
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_cortex.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_exti.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash_ex.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio_ex.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pwr.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc_ex.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_dma.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd_ex.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_ll_usb.c
)

# USB Device Library sources
set(USB_SOURCES
    Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Src/usbd_cdc.c
    Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_core.c
    Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ctlreq.c
    Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ioreq.c
    USB_DEVICE/App/usb_device.c
    USB_DEVICE/App/usbd_cdc_if.c
    USB_DEVICE/App/usbd_desc.c
    USB_DEVICE/Target/usbd_conf.c
)

# ASM sources
set(ASM_SOURCES
    Core/Startup/startup_stm32f103c8tx.s
)

##########################################################################################################################
# Include Directories
##########################################################################################################################

set(INCLUDE_DIRECTORIES
    Core/Inc
    Drivers/CMSIS/Device/ST/STM32F1xx/Include
    Drivers/CMSIS/Include
    Drivers/STM32F1xx_HAL_Driver/Inc
    Drivers/STM32F1xx_HAL_Driver/Inc/Legacy
    Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Inc
    Middlewares/ST/STM32_USB_Device_Library/Core/Inc
    USB_DEVICE/App
    USB_DEVICE/Target
)

##########################################################################################################################
# Compiler and Linker Configuration
##########################################################################################################################

# Common compiler flags
set(COMMON_FLAGS
    ${CPU_PARAMETERS}
    -Wall
    -fdata-sections
    -ffunction-sections
    -std=c11
    -fno-common
    -fmessage-length=0
    -fno-exceptions
    -fomit-frame-pointer
    -ffreestanding
)

# Debug/Release specific flags
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    set(OPTIMIZATION_FLAGS -Og -g -gdwarf-2)
else()
    # Use -O1 instead of -O2 to avoid aggressive optimizations that break timing
    # Add flags to prevent problematic optimizations
    set(OPTIMIZATION_FLAGS -O1 -fno-schedule-insns -fno-schedule-insns2)
endif()

# Defines
set(PROJECT_DEFINES
    -DUSE_HAL_DRIVER
    -DSTM32F103xB
)

# Add build timestamp
string(TIMESTAMP BUILD_TIMESTAMP "%s")
list(APPEND PROJECT_DEFINES -DBUILD_TIMESTAMP=${BUILD_TIMESTAMP})

# Assembler flags  
set(CMAKE_ASM_FLAGS "-mcpu=cortex-m3 -mthumb -x assembler-with-cpp")

# Linker flags
set(LINKER_FLAGS
    ${CPU_PARAMETERS}
    -specs=nano.specs
    -Wl,--gc-sections
    -lc
    -lm
    -T${CMAKE_CURRENT_SOURCE_DIR}/STM32F103C8TX_FLASH.ld
    -Wl,-Map=${CMAKE_BINARY_DIR}/chis_flash_burner.map,--cref
)

##########################################################################################################################
# Build Target
##########################################################################################################################

# All sources combined
set(ALL_SOURCES
    ${PROJECT_SOURCES}
    ${HAL_SOURCES}
    ${USB_SOURCES}
    ${ASM_SOURCES}
)

# Create the main target
add_executable(chis_flash_burner ${ALL_SOURCES})

# Set target properties
set_target_properties(chis_flash_burner PROPERTIES
    SUFFIX ".elf"
)

# Compiler flags
target_compile_options(chis_flash_burner PRIVATE
    ${COMMON_FLAGS}
    ${OPTIMIZATION_FLAGS}
)

# Include directories
target_include_directories(chis_flash_burner PRIVATE ${INCLUDE_DIRECTORIES})

# Defines
target_compile_definitions(chis_flash_burner PRIVATE ${PROJECT_DEFINES})

# Linker flags
target_link_options(chis_flash_burner PRIVATE ${LINKER_FLAGS})

# Generate hex and bin files
add_custom_command(TARGET chis_flash_burner POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:chis_flash_burner> ${CMAKE_BINARY_DIR}/chis_flash_burner.hex
    COMMAND ${CMAKE_OBJCOPY} -O binary -S $<TARGET_FILE:chis_flash_burner> ${CMAKE_BINARY_DIR}/chis_flash_burner.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:chis_flash_burner>
    COMMENT "Building chis_flash_burner hex and bin files"
)

# Print size information
add_custom_target(size
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:chis_flash_burner>
    DEPENDS chis_flash_burner
    COMMENT "Size information for chis_flash_burner"
)

##########################################################################################################################
# Custom Targets
##########################################################################################################################

##########################################################################################################################
# Custom Targets
##########################################################################################################################

# Clean target
add_custom_target(clean-all
    COMMAND ${CMAKE_COMMAND} -E remove ${CMAKE_BINARY_DIR}/chis_flash_burner.elf
    COMMAND ${CMAKE_COMMAND} -E remove ${CMAKE_BINARY_DIR}/chis_flash_burner.hex
    COMMAND ${CMAKE_COMMAND} -E remove ${CMAKE_BINARY_DIR}/chis_flash_burner.bin
    COMMAND ${CMAKE_COMMAND} -E remove ${CMAKE_BINARY_DIR}/chis_flash_burner.map
    COMMENT "Cleaning build files"
)

# Flash target (using OpenOCD)
add_custom_target(flash
    COMMAND openocd -f interface/stlink.cfg -f target/stm32f1x.cfg 
            -c "program ${CMAKE_BINARY_DIR}/chis_flash_burner.hex verify reset exit"
    DEPENDS chis_flash_burner
    COMMENT "Flashing chis_flash_burner firmware"
)

# Erase target (using OpenOCD)
add_custom_target(erase
    COMMAND openocd -f interface/stlink.cfg -f target/stm32f1x.cfg 
            -c "init; reset halt; stm32f1x mass_erase 0; exit"
    COMMENT "Erasing STM32F103C8T6 flash memory"
)

##########################################################################################################################
# Help Target
##########################################################################################################################

add_custom_target(cmake-help
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "STM32F103C8T6 chis_flash_burner CMake Build System"
    COMMAND ${CMAKE_COMMAND} -E echo "================================================="
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Available targets:"
    COMMAND ${CMAKE_COMMAND} -E echo "  chis_flash_burner      - Build the main firmware"
    COMMAND ${CMAKE_COMMAND} -E echo "  flash                  - Flash firmware using OpenOCD"
    COMMAND ${CMAKE_COMMAND} -E echo "  erase                  - Erase flash memory using OpenOCD"
    COMMAND ${CMAKE_COMMAND} -E echo "  size                   - Show size information"
    COMMAND ${CMAKE_COMMAND} -E echo "  clean-all              - Clean build files"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake-help             - Show this help"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Example usage:"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake -B build"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake --build build"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake --build build --target flash"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMENT "Showing help information"
)

##########################################################################################################################
# Print Configuration Summary
##########################################################################################################################

message(STATUS "")
message(STATUS "STM32F103C8T6 chis_flash_burner Configuration Summary")
message(STATUS "====================================================")
message(STATUS "MCU Family: ${MCU_FAMILY}")
message(STATUS "MCU Model: ${MCU_MODEL}")
message(STATUS "Build Type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Toolchain: ${TOOLCHAIN_PREFIX}")
message(STATUS "Target: chis_flash_burner (Single Firmware)")
message(STATUS "")

# EOF
