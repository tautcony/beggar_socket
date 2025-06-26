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
# C sources
C_SOURCES =  \
Core/Src/main.c \
Core/Src/stm32f1xx_it.c \
Core/Src/stm32f1xx_hal_msp.c \
Core/Src/cart_adapter.c \
Core/Src/uart.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pcd_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_ll_usb.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc_ex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_dma.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_cortex.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_pwr.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash.c \
Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash_ex.c \
Core/Src/system_stm32f1xx.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_core.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ctlreq.c \
Middlewares/ST/STM32_USB_Device_Library/Core/Src/usbd_ioreq.c \
Middlewares/ST/STM32_USB_Device_Library/Class/CDC/Src/usbd_cdc.c \
USB_DEVICE/App/usb_device.c \
USB_DEVICE/App/usbd_desc.c \
USB_DEVICE/App/usbd_cdc_if.c \
USB_DEVICE/Target/usbd_conf.c \
Core/Src/syscalls.c \
Core/Src/sysmem.c

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
-DSTM32F103xB

# AS includes
AS_INCLUDES = 

# C includes
C_INCLUDES =  \
-ICore/Inc \
-IDrivers/STM32F1xx_HAL_Driver/Inc \
-IDrivers/STM32F1xx_HAL_Driver/Inc/Legacy \
-IDrivers/CMSIS/Device/ST/STM32F1xx/Include \
-IDrivers/CMSIS/Include \
-IUSB_DEVICE/App \
-IUSB_DEVICE/Target \
-IMiddlewares/ST/STM32_USB_Device_Library/Core/Inc \
-IMiddlewares/ST/STM32_USB_Device_Library/Class/CDC/Inc

# compile gcc flags
ASFLAGS = $(MCU) $(AS_DEFS) $(AS_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections

CFLAGS += $(MCU) $(C_DEFS) $(C_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections

ifeq ($(DEBUG), 1)
CFLAGS += -g -gdwarf-2
endif

# Additional flags to ensure proper standard library linking
CFLAGS += -std=c99 -fno-common -fmessage-length=0 -fno-exceptions -ffunction-sections -fdata-sections -fomit-frame-pointer
# Force freestanding environment to use GCC's own stdint.h
CFLAGS += -ffreestanding
CFLAGS += -MMD -MP -MF"$(@:%.o=%.d)"

# Ensure newlib nano is properly linked
ASFLAGS += -x assembler-with-cpp

#######################################
# LDFLAGS
#######################################
# link script
LDSCRIPT = STM32F103C8TX_FLASH.ld

# libraries
LIBS = -lc -lm -lnosys 
LIBDIR = 
LDFLAGS = $(MCU) -specs=nano.specs -T$(LDSCRIPT) $(LIBDIR) $(LIBS) -Wl,-Map=$(BUILD_DIR)/$(TARGET).map,--cref -Wl,--gc-sections

# default action: build all
all: $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).hex $(BUILD_DIR)/$(TARGET).bin

#######################################
# build the application
#######################################
# list of objects
OBJECTS = $(addprefix $(BUILD_DIR)/,$(notdir $(C_SOURCES:.c=.o)))
vpath %.c $(sort $(dir $(C_SOURCES)))
# list of ASM program objects
OBJECTS += $(addprefix $(BUILD_DIR)/,$(notdir $(ASM_SOURCES:.s=.o)))
vpath %.s $(sort $(dir $(ASM_SOURCES)))

$(BUILD_DIR)/%.o: %.c Makefile | $(BUILD_DIR) 
	$(CC) -c $(CFLAGS) -Wa,-a,-ad,-alms=$(BUILD_DIR)/$(notdir $(<:.c=.lst)) $< -o $@

$(BUILD_DIR)/%.o: %.s Makefile | $(BUILD_DIR)
	$(AS) -c $(CFLAGS) $< -o $@

$(BUILD_DIR)/$(TARGET).elf: $(OBJECTS) Makefile
	$(CC) $(OBJECTS) $(LDFLAGS) -o $@
	$(SZ) $@

$(BUILD_DIR)/%.hex: $(BUILD_DIR)/%.elf | $(BUILD_DIR)
	$(HEX) $< $@
	
$(BUILD_DIR)/%.bin: $(BUILD_DIR)/%.elf | $(BUILD_DIR)
	$(BIN) $< $@	
	
$(BUILD_DIR):
	mkdir $@		

#######################################
# clean up
#######################################
clean:
	-rm -fR $(BUILD_DIR)

#######################################
# additional targets
#######################################
# Show size information
size: $(BUILD_DIR)/$(TARGET).elf
	$(SZ) $<

# Show detailed size information
size-detailed: $(BUILD_DIR)/$(TARGET).elf
	$(SZ) -A $<

# Flash using st-flash (if available)
flash: $(BUILD_DIR)/$(TARGET).bin
	@if command -v st-flash >/dev/null 2>&1; then \
		st-flash write $< 0x8000000; \
	else \
		echo "st-flash not found. Install st-link tools to flash firmware."; \
	fi

# Flash using openocd (if available)
flash-openocd: $(BUILD_DIR)/$(TARGET).hex
	@if command -v openocd >/dev/null 2>&1; then \
		openocd -f interface/stlink.cfg -f target/stm32f1x.cfg \
		-c "program $< verify reset exit"; \
	else \
		echo "openocd not found. Install OpenOCD to flash firmware."; \
	fi

# Generate disassembly
disasm: $(BUILD_DIR)/$(TARGET).elf
	$(PREFIX)objdump -S $< > $(BUILD_DIR)/$(TARGET).dis

# Show help
help:
	@echo "Available targets:"
	@echo "  all (default)   - Build firmware (.elf, .hex, .bin)"
	@echo "  clean          - Remove build artifacts"
	@echo "  size           - Show firmware size"
	@echo "  size-detailed  - Show detailed size information"
	@echo "  flash          - Flash firmware using st-flash"
	@echo "  flash-openocd  - Flash firmware using OpenOCD"
	@echo "  disasm         - Generate disassembly"
	@echo "  help           - Show this help"
	@echo ""
	@echo "Variables:"
	@echo "  DEBUG=1/0      - Enable/disable debug build (default: 1)"
	@echo "  OPT=-Ox        - Set optimization level (default: -Og)"
	@echo "  GCC_PATH=path  - Set custom ARM GCC path"
	@echo ""
	@echo "Examples:"
	@echo "  make                    - Build with debug"
	@echo "  make DEBUG=0 OPT=-O2    - Build optimized release"
	@echo "  make clean all          - Clean and rebuild"
	@echo "  make size              - Show firmware size"

.PHONY: all clean size size-detailed flash flash-openocd disasm help

#######################################
# dependencies
#######################################
-include $(wildcard $(BUILD_DIR)/*.d)

# *** EOF ***
