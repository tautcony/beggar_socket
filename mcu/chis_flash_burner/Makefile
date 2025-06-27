##########################################################################################################################
# STM32F103C8T6 Project Makefile
# Target: chis_flash_burner
# MCU: STM32F103C8T6 (Cortex-M3)
##########################################################################################################################

######################################
# target
######################################
TARGET = chis_flash_burner

######################################
# building variables
######################################
# debug build?
DEBUG = 1
# optimization
OPT = -Og

#######################################
# paths
#######################################
# Build path
BUILD_DIR = build

######################################
# source
######################################
# C sources - Common HAL sources (shared by all builds)
C_SOURCES_HAL =  \
Core/Src/stm32f1xx_hal_msp.c \
Core/Src/stm32f1xx_it.c \
Core/Src/syscalls.c \
Core/Src/sysmem.c \
Core/Src/system_stm32f1xx.c \
Core/Src/version.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_cortex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_exti.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pwr.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal.c

# BootLoader specific sources (minimal)
C_SOURCES_BOOTLOADER = \
Core/Src/bootloader.c \
Core/Src/iap.c \
Core/Src/uart_bootloader.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_ll_usb.c \
Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Src/usbd_cdc.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_core.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ctlreq.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ioreq.c \
USB_DEVICE/App/usb_device.c \
USB_DEVICE/App/usbd_cdc_if.c \
USB_DEVICE/App/usbd_desc.c \
USB_DEVICE/Target/usbd_conf.c

# Application/Legacy sources (full functionality)  
C_SOURCES_APP = \
Core/Src/main.c \
Core/Src/cart_adapter.c \
Core/Src/iap.c \
Core/Src/uart.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_dma.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_ll_usb.c \
Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Src/usbd_cdc.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_core.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ctlreq.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ioreq.c \
USB_DEVICE/App/usb_device.c \
USB_DEVICE/App/usbd_cdc_if.c \
USB_DEVICE/App/usbd_desc.c \
USB_DEVICE/Target/usbd_conf.c

# Default to app sources
C_SOURCES = $(C_SOURCES_HAL) $(C_SOURCES_APP)

# ASM sources
ASM_SOURCES =  \
Core/Startup/startup_stm32f103c8tx.s

#######################################
# binaries
#######################################
PREFIX = arm-none-eabi-
# The gcc compiler bin path can be either defined in make command via GCC_PATH variable (> make GCC_PATH=xxx)
# either it can be added to the PATH environment variable.
ifdef GCC_PATH
CC = $(GCC_PATH)/$(PREFIX)gcc
AS = $(GCC_PATH)/$(PREFIX)gcc -x assembler-with-cpp
CP = $(GCC_PATH)/$(PREFIX)objcopy
SZ = $(GCC_PATH)/$(PREFIX)size
else
CC = $(PREFIX)gcc
AS = $(PREFIX)gcc -x assembler-with-cpp
CP = $(PREFIX)objcopy
SZ = $(PREFIX)size
endif
HEX = $(CP) -O ihex
BIN = $(CP) -O binary -S

#######################################
# CFLAGS
#######################################
# cpu
CPU = -mcpu=cortex-m3

# fpu
# NONE for Cortex-M0/M0+/M3

# float-abi

# mcu
MCU = $(CPU) -mthumb $(FPU) $(FLOAT-ABI)

# macros for gcc
# AS defines
AS_DEFS = 

# C defines
C_DEFS =  \
-DUSE_HAL_DRIVER \
-DSTM32F103xB \
-DBUILD_TIMESTAMP=$(shell date +%s)

# Override for different build types
ifeq ($(BUILD_TYPE), APP)
LDSCRIPT = STM32F103C8TX_FLASH_APP.ld
TARGET = chis_flash_burner_app
BUILD_DIR = build/app
C_DEFS += -DIAP_APPLICATION_BUILD
C_SOURCES = $(C_SOURCES_HAL) $(C_SOURCES_APP)
endif

ifeq ($(BUILD_TYPE), LEGACY)
LDSCRIPT = STM32F103C8TX_FLASH.ld
TARGET = chis_flash_burner_legacy
BUILD_DIR = build
C_SOURCES = $(C_SOURCES_HAL) $(C_SOURCES_APP)
endif

# Default is BootLoader
ifeq ($(BUILD_TYPE), BOOTLOADER)
LDSCRIPT = STM32F103C8TX_FLASH_IAP.ld
TARGET = chis_flash_burner_bootloader
BUILD_DIR = build/bootloader
C_DEFS += -DIAP_BOOTLOADER_BUILD
C_SOURCES = $(C_SOURCES_HAL) $(C_SOURCES_BOOTLOADER)
# BootLoader 使用更激进的优化和精简选项
ifeq ($(DEBUG), 1)
OPT = -Os -fno-unwind-tables -fno-asynchronous-unwind-tables
else
OPT = -Os -fno-unwind-tables -fno-asynchronous-unwind-tables
endif
endif

ifndef BUILD_TYPE
BUILD_TYPE = BOOTLOADER
BUILD_DIR = build/bootloader
C_DEFS += -DIAP_BOOTLOADER_BUILD
C_SOURCES = $(C_SOURCES_HAL) $(C_SOURCES_BOOTLOADER)
# BootLoader 使用更激进的优化和精简选项
ifeq ($(DEBUG), 1)
OPT = -Os -fno-unwind-tables -fno-asynchronous-unwind-tables
else
OPT = -Os -fno-unwind-tables -fno-asynchronous-unwind-tables
endif
endif

# AS includes
AS_INCLUDES = 

# C includes
C_INCLUDES =  \
-ICore/Inc \
-IDrivers/CMSIS/Device/ST/STM32F1xx/Include \
-IDrivers/CMSIS/Include \
-IDrivers/STM32F1xx_HAL_Driver/Inc \
-IDrivers/STM32F1xx_HAL_Driver/Inc/Legacy \
-IMiddlewares/ST/STM32_USB_Device_Library/Class/CDC/Inc \
-IMiddlewares/ST/STM32_USB_Device_Library/Core/Inc \
-IUSB_DEVICE/App \
-IUSB_DEVICE/Target

# compile gcc flags
ASFLAGS = $(MCU) $(AS_DEFS) $(AS_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections

CFLAGS += $(MCU) $(C_DEFS) $(C_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections

ifeq ($(DEBUG), 1)
CFLAGS += -g -gdwarf-2
endif

# Additional flags to ensure proper standard library linking
CFLAGS += -std=c11 -fno-common -fmessage-length=0 -fno-exceptions -ffunction-sections -fdata-sections -fomit-frame-pointer
# Force freestanding environment to use GCC's own stdint.h
CFLAGS += -ffreestanding
CFLAGS += -MMD -MP -MF"$(@:%.o=%.d)"

# Ensure newlib nano is properly linked
ASFLAGS += -x assembler-with-cpp

#######################################
# LDFLAGS
#######################################
# link script
# Default to IAP BootLoader
LDSCRIPT = STM32F103C8TX_FLASH_IAP.ld

# Override for different build types
ifeq ($(BUILD_TYPE), APP)
LDSCRIPT = STM32F103C8TX_FLASH_APP.ld
endif

ifeq ($(BUILD_TYPE), LEGACY)
LDSCRIPT = STM32F103C8TX_FLASH.ld
endif

# libraries
LIBS = -lc -lm -lnosys 
LIBDIR = 

# BootLoader 使用更激进的链接优化
ifeq ($(BUILD_TYPE), BOOTLOADER)
LDFLAGS = $(MCU) -specs=nano.specs -T$(LDSCRIPT) $(LIBDIR) $(LIBS) -Wl,-Map=$(BUILD_DIR)/$(TARGET).map,--cref -Wl,--gc-sections -Wl,--strip-all
else
LDFLAGS = $(MCU) -specs=nano.specs -T$(LDSCRIPT) $(LIBDIR) $(LIBS) -Wl,-Map=$(BUILD_DIR)/$(TARGET).map,--cref -Wl,--gc-sections
endif

# default action: build legacy (single image)
all: legacy

# Build specific target
build: $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).hex $(BUILD_DIR)/$(TARGET).bin

#######################################
# build the application
#######################################
# list of objects
OBJECTS = $(addprefix $(BUILD_DIR)/,$(notdir $(C_SOURCES:.c=.o)))
vpath %.c $(sort $(dir $(C_SOURCES)))
# list of ASM program objects
OBJECTS += $(addprefix $(BUILD_DIR)/,$(notdir $(ASM_SOURCES:.s=.o)))
vpath %.s $(sort $(dir $(ASM_SOURCES)))

$(BUILD_DIR)/%.o: %.c Makefile
	@mkdir -p $(BUILD_DIR)
	$(CC) -c $(CFLAGS) -Wa,-a,-ad,-alms=$(BUILD_DIR)/$(notdir $(<:.c=.lst)) $< -o $@

$(BUILD_DIR)/%.o: %.s Makefile
	@mkdir -p $(BUILD_DIR)
	$(AS) -c $(CFLAGS) $< -o $@

$(BUILD_DIR)/$(TARGET).elf: $(OBJECTS) Makefile
	@mkdir -p $(BUILD_DIR)
	$(CC) $(OBJECTS) $(LDFLAGS) -o $@
	$(SZ) $@

$(BUILD_DIR)/%.hex: $(BUILD_DIR)/%.elf
	@mkdir -p $(BUILD_DIR)
	$(HEX) $< $@
	
$(BUILD_DIR)/%.bin: $(BUILD_DIR)/%.elf
	@mkdir -p $(BUILD_DIR)
	$(BIN) $< $@

#######################################
# clean up
#######################################
clean:
	-rm -fR build

# Clean specific build type
clean-bootloader:
	-rm -fR build/bootloader

clean-app:
	-rm -fR build/app

clean-legacy:
	-rm -fR build/chis_flash_burner_legacy.*

#######################################
# additional targets
#######################################
# Show size information
size: $(BUILD_DIR)/$(TARGET).elf
	$(SZ) $<

# Flash the bootloader
flash: $(BUILD_DIR)/$(TARGET).hex
	openocd -f interface/stlink.cfg -f target/stm32f1x.cfg -c "program $(BUILD_DIR)/$(TARGET).hex verify reset exit"

# Build BootLoader (IAP)
bootloader:
	$(MAKE) BUILD_TYPE=BOOTLOADER build

# Build Application (for IAP)
app:
	$(MAKE) BUILD_TYPE=APP build

# Build Legacy (single image)
legacy:
	$(MAKE) BUILD_TYPE=LEGACY build

# Help target
help:
	@echo "Available targets:"
	@echo "  all       - Build legacy single image (default)"
	@echo "  bootloader- Build IAP BootLoader only (build/bootloader/)"
	@echo "  app       - Build Application for IAP only (build/app/)"
	@echo "  legacy    - Build legacy single image (build/)"
	@echo "  clean     - Clean all build files"
	@echo "  clean-bootloader - Clean bootloader build files only"
	@echo "  clean-app - Clean application build files only"
	@echo "  clean-legacy - Clean legacy build files only"
	@echo "  size      - Show size information"
	@echo "  flash     - Flash firmware using OpenOCD"
	@echo "  help      - Show this help"
	@echo ""
	@echo "Build configurations:"
	@echo "  DEBUG=1   - Enable debug symbols (default)"
	@echo "  DEBUG=0   - Release build"

.PHONY: all clean clean-bootloader clean-app clean-legacy size flash bootloader app legacy help

#######################################
# dependencies
#######################################
-include $(wildcard $(BUILD_DIR)/*.d)

# *** EOF ***
