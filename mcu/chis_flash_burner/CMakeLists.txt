##########################################################################################################################
# STM32F103C8T6 Project CMakeLists.txt
# Target: chis_flash_burner
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

# Build configuration options
option(BUILD_BOOTLOADER "Build bootloader only" OFF)
option(BUILD_APP "Build application only" OFF)
option(BUILD_LEGACY "Build legacy single image" OFF)

# Default to bootloader if no specific build is selected
if(NOT BUILD_BOOTLOADER AND NOT BUILD_APP AND NOT BUILD_LEGACY)
    set(BUILD_BOOTLOADER ON)
    message(STATUS "No specific build type selected, defaulting to bootloader")
endif()

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

# Common HAL sources (shared by all builds)
set(HAL_SOURCES
    Core/Src/stm32f1xx_hal_msp.c
    Core/Src/stm32f1xx_it.c
    Core/Src/syscalls.c
    Core/Src/sysmem.c
    Core/Src/system_stm32f1xx.c
    Core/Src/version.c
    Core/Src/modbus_crc.c
    Core/Src/error_handler.c
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
)

# USB Device Library sources (shared by bootloader and app)
set(USB_SOURCES
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd_ex.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_ll_usb.c
    Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Src/usbd_cdc.c
    Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_core.c
    Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ctlreq.c
    Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ioreq.c
    USB_DEVICE/App/usb_device.c
    USB_DEVICE/App/usbd_cdc_if.c
    USB_DEVICE/App/usbd_desc.c
    USB_DEVICE/Target/usbd_conf.c
)

# IAP functionality (shared by bootloader and app)  
set(IAP_SOURCES
    Core/Src/iap.c
)

# BootLoader specific sources (minimal)
set(BOOTLOADER_SOURCES
    Core/Src/bootloader/bootloader.c
    Core/Src/bootloader/uart_bootloader.c
    Core/Src/bootloader/morse_code.c
)

# Application/Legacy sources (full functionality)
set(APP_SOURCES
    Core/Src/main.c
    Core/Src/cart_adapter.c
    Core/Src/uart.c
    Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_dma.c
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
    set(OPTIMIZATION_FLAGS -O2)
endif()

# Common defines
set(COMMON_DEFINES
    -DUSE_HAL_DRIVER
    -DSTM32F103xB
)

# Add build timestamp
string(TIMESTAMP BUILD_TIMESTAMP "%s")
list(APPEND COMMON_DEFINES -DBUILD_TIMESTAMP=${BUILD_TIMESTAMP})

# Assembler flags  
set(CMAKE_ASM_FLAGS "-mcpu=cortex-m3 -mthumb -x assembler-with-cpp")

# Common linker flags
set(COMMON_LINKER_FLAGS
    ${CPU_PARAMETERS}
    -specs=nano.specs
    -Wl,--gc-sections
    -lc
    -lm
)

##########################################################################################################################
# Build Target Functions
##########################################################################################################################

function(create_target TARGET_NAME SOURCES DEFINES LINKER_SCRIPT BUILD_DIR_SUFFIX)
    # Create the target
    add_executable(${TARGET_NAME} ${HAL_SOURCES} ${SOURCES} ${ASM_SOURCES})

    # Set target properties
    set_target_properties(${TARGET_NAME} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/${BUILD_DIR_SUFFIX}
        SUFFIX ".elf"
    )

    # Compiler flags
    target_compile_options(${TARGET_NAME} PRIVATE
        ${COMMON_FLAGS}
        ${OPTIMIZATION_FLAGS}
    )

    # Include directories
    target_include_directories(${TARGET_NAME} PRIVATE ${INCLUDE_DIRECTORIES})

    # Defines
    target_compile_definitions(${TARGET_NAME} PRIVATE
        ${COMMON_DEFINES}
        ${DEFINES}
    )

    # Linker script and flags
    set(LINKER_FLAGS 
        ${COMMON_LINKER_FLAGS} 
        -T${CMAKE_CURRENT_SOURCE_DIR}/${LINKER_SCRIPT}
        -Wl,-Map=$<TARGET_FILE_DIR:${TARGET_NAME}>/${TARGET_NAME}.map,--cref
    )

    target_link_options(${TARGET_NAME} PRIVATE ${LINKER_FLAGS})

    # Generate hex and bin files
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND ${CMAKE_OBJCOPY} -O ihex $<TARGET_FILE:${TARGET_NAME}> $<TARGET_FILE_DIR:${TARGET_NAME}>/${TARGET_NAME}.hex
        COMMAND ${CMAKE_OBJCOPY} -O binary -S $<TARGET_FILE:${TARGET_NAME}> $<TARGET_FILE_DIR:${TARGET_NAME}>/${TARGET_NAME}.bin
        COMMAND ${CMAKE_SIZE} $<TARGET_FILE:${TARGET_NAME}>
        COMMENT "Building ${TARGET_NAME} hex and bin files"
    )

    # Print size information
    add_custom_target(${TARGET_NAME}_size
        COMMAND ${CMAKE_SIZE} $<TARGET_FILE:${TARGET_NAME}>
        DEPENDS ${TARGET_NAME}
        COMMENT "Size information for ${TARGET_NAME}"
    )
endfunction()

##########################################################################################################################
# Build Targets
##########################################################################################################################

# Bootloader target
if(BUILD_BOOTLOADER)
    # Bootloader uses aggressive optimization for size
    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(BOOTLOADER_OPT_FLAGS -g1)  # Use -Os even in debug for size, minimal debug info
    else()
        set(BOOTLOADER_OPT_FLAGS -Os)
    endif()

    create_target(chis_flash_burner_bootloader
        "${BOOTLOADER_SOURCES};${USB_SOURCES};${IAP_SOURCES}"
        "-DIAP_BOOTLOADER_BUILD;-DUSER_VECT_TAB_ADDRESS;-DVECT_TAB_OFFSET=0x0000U"
        "STM32F103C8TX_FLASH_IAP.ld"
        "bootloader"
    )

    # Override optimization for bootloader with aggressive size optimization
    target_compile_options(chis_flash_burner_bootloader PRIVATE
        ${BOOTLOADER_OPT_FLAGS}
        -fno-unwind-tables
        -fno-asynchronous-unwind-tables
        -ffunction-sections
        -fdata-sections
        -flto
    )

    # Bootloader uses aggressive linker optimization
    target_link_options(chis_flash_burner_bootloader PRIVATE 
        -Wl,--strip-all
        -Wl,--gc-sections
        -Wl,--strip-debug
        -flto
    )

    message(STATUS "Configuring bootloader target")
endif()

# Application target
if(BUILD_APP)
    create_target(chis_flash_burner_app
        "${APP_SOURCES};${USB_SOURCES};${IAP_SOURCES}"
        "-DIAP_APPLICATION_BUILD;-DUSER_VECT_TAB_ADDRESS;-DVECT_TAB_OFFSET=0x6000U"
        "STM32F103C8TX_FLASH_APP.ld"
        "app"
    )

    message(STATUS "Configuring application target")
endif()

# Legacy target
if(BUILD_LEGACY)
    create_target(chis_flash_burner_legacy
        "${APP_SOURCES};${USB_SOURCES};${IAP_SOURCES}"
        ""
        "STM32F103C8TX_FLASH.ld"
        ""
    )

    message(STATUS "Configuring legacy target")
endif()

##########################################################################################################################
# Custom Targets
##########################################################################################################################

# Clean all builds
add_custom_target(clean-all
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/build/bootloader
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/build/app
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/build/legacy
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/build
    COMMENT "Cleaning all build directories"
)

# Flash target (requires openocd)
if(BUILD_BOOTLOADER)
    add_custom_target(flash-bootloader
        COMMAND openocd -f interface/stlink.cfg -f target/stm32f1x.cfg 
                -c "program ${CMAKE_BINARY_DIR}/build/bootloader/chis_flash_burner_bootloader.hex verify reset exit"
        DEPENDS chis_flash_burner_bootloader
        COMMENT "Flashing bootloader"
    )
endif()

if(BUILD_APP)
    add_custom_target(flash-app
        COMMAND openocd -f interface/stlink.cfg -f target/stm32f1x.cfg 
                -c "program ${CMAKE_BINARY_DIR}/build/app/chis_flash_burner_app.hex verify reset exit"
        DEPENDS chis_flash_burner_app
        COMMENT "Flashing application"
    )
endif()

if(BUILD_LEGACY)
    add_custom_target(flash-legacy
        COMMAND openocd -f interface/stlink.cfg -f target/stm32f1x.cfg 
                -c "program ${CMAKE_BINARY_DIR}/build/legacy/chis_flash_burner_legacy.hex verify reset exit"
        DEPENDS chis_flash_burner_legacy
        COMMENT "Flashing legacy firmware"
    )
endif()

##########################################################################################################################
# Help Target
##########################################################################################################################

add_custom_target(cmake-help
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "STM32F103C8T6 chis_flash_burner CMake Build System"
    COMMAND ${CMAKE_COMMAND} -E echo "================================================="
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Available build configurations:"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_BOOTLOADER=ON  - Build IAP BootLoader only"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_APP=ON         - Build Application for IAP only"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_LEGACY=ON      - Build legacy single image"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E    echo "Example usage:"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake -B build/bootloader -DBUILD_BOOTLOADER=ON"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake --build build/bootloader"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake -B build/app -DBUILD_APP=ON"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake --build build/app"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake -B build/legacy -DBUILD_LEGACY=ON"
    COMMAND ${CMAKE_COMMAND} -E echo "  cmake --build build/legacy"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Additional targets:"
    COMMAND ${CMAKE_COMMAND} -E echo "  clean-all              - Clean all build directories"
    COMMAND ${CMAKE_COMMAND} -E echo "  flash-bootloader       - Flash bootloader using OpenOCD"
    COMMAND ${CMAKE_COMMAND} -E echo "  flash-app              - Flash application using OpenOCD"
    COMMAND ${CMAKE_COMMAND} -E echo "  flash-legacy           - Flash legacy firmware using OpenOCD"
    COMMAND ${CMAKE_COMMAND} -E echo "  help                   - Show this help"
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
message(STATUS "")
if(BUILD_BOOTLOADER)
    message(STATUS "Building: Bootloader (IAP)")
endif()
if(BUILD_APP)
    message(STATUS "Building: Application (IAP)")
endif()
if(BUILD_LEGACY)
    message(STATUS "Building: Legacy (Single Image)")
endif()
message(STATUS "")

# EOF
