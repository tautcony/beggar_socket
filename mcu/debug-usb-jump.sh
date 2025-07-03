#!/bin/bash

# USB跳转问题调试脚本
# 用于排查"刷写完成后直接跳转无响应，断电重启后app正常"问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# 检查USB设备连接状态
check_usb_connection() {
    print_header "USB连接状态检查"
    
    # 检查系统USB设备
    print_info "检查系统USB设备列表..."
    if command -v lsusb &> /dev/null; then
        lsusb | grep -i "0483" || print_warning "未找到STM32 USB设备"
    elif command -v system_profiler &> /dev/null; then
        # macOS
        system_profiler SPUSBDataType | grep -A 5 -B 5 "STM32" || print_warning "未找到STM32 USB设备"
    else
        print_warning "无法检测USB设备"
    fi
    
    echo
    
    # 检查串口设备
    print_info "检查串口设备..."
    if [[ -d "/dev" ]]; then
        ls -la /dev/tty* | grep -E "(USB|ACM|usbmodem)" || print_warning "未找到USB串口设备"
    fi
    
    echo
}

# 检查USB寄存器状态
check_usb_registers() {
    print_header "USB寄存器状态检查"
    
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD未安装或不在PATH中"
        return 1
    fi
    
    print_info "启动OpenOCD并检查USB寄存器..."
    
    # 检查OpenOCD是否能连接
    local openocd_log="/tmp/openocd_test.log"
    timeout 10s openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > "$openocd_log" 2>&1 &
    local openocd_pid=$!
    
    # 等待OpenOCD启动
    sleep 3
    
    # 检查OpenOCD是否成功启动
    if ! kill -0 $openocd_pid 2>/dev/null; then
        print_error "OpenOCD启动失败，请检查设备连接"
        cat "$openocd_log"
        rm -f "$openocd_log"
        return 1
    fi
    
    # 检查telnet连接是否可用，增加重试机制
    local telnet_ready=false
    for i in {1..5}; do
        if echo "version" | nc -w 2 localhost 4444 >/dev/null 2>&1; then
            telnet_ready=true
            break
        elif command -v telnet &> /dev/null && (echo "version"; sleep 0.1; echo "exit") | timeout 3s telnet localhost 4444 >/dev/null 2>&1; then
            telnet_ready=true
            break
        fi
        print_info "等待OpenOCD telnet接口就绪... (尝试 $i/5)"
        sleep 1
    done
    
    if [[ "$telnet_ready" == "false" ]]; then
        print_error "无法连接到OpenOCD telnet接口，可能原因："
        echo "  - OpenOCD启动过程中出现错误"
        echo "  - 调试接口被应用程序禁用"
        echo "  - SWD通信异常"
        echo "OpenOCD日志："
        cat "$openocd_log"
        kill $openocd_pid 2>/dev/null || true
        wait $openocd_pid 2>/dev/null
        rm -f "$openocd_log"
        return 1
    fi
    
    print_info "OpenOCD连接成功，读取USB寄存器状态..."
    
    # 检查USB相关寄存器，使用netcat连接
    local register_output=""
    print_info "执行复位并暂停目标..."
    
    if command -v nc &> /dev/null; then
        register_output=$(timeout 15s bash -c '
            {
                echo "reset halt"
                sleep 2
                echo "mdw 0x40005C00 1"
                sleep 0.5
                echo "mdw 0x40005C44 1" 
                sleep 0.5
                echo "mdw 0x40005C4C 1"
                sleep 0.5
                echo "mdw 0x4002101C 1"
                sleep 0.5
                echo "mdw 0x40010800 1"
                sleep 0.5
                echo "mdw 0x40010804 1"
                sleep 0.5
                echo "resume"
                sleep 0.5
                echo "exit"
            } | nc localhost 4444 2>/dev/null
        ' 2>/dev/null)
    else
        # 回退到telnet，但使用更稳定的方式
        register_output=$(timeout 15s bash -c '
            (
                echo "reset halt"
                sleep 2
                echo "mdw 0x40005C00 1"
                sleep 0.5
                echo "mdw 0x40005C44 1" 
                sleep 0.5
                echo "mdw 0x40005C4C 1"
                sleep 0.5
                echo "mdw 0x4002101C 1"
                sleep 0.5
                echo "mdw 0x40010800 1"
                sleep 0.5
                echo "mdw 0x40010804 1"
                sleep 0.5
                echo "resume"
                sleep 0.5
                echo "exit"
            ) | telnet localhost 4444 2>/dev/null
        ' 2>/dev/null)
    fi
    
    if [[ -n "$register_output" ]] && echo "$register_output" | grep -q "0x"; then
        print_success "成功读取寄存器数据："
        echo "$register_output" | grep -E "(0x[0-9a-fA-F]+)" | head -10
        echo
        print_info "寄存器含义："
        echo "  0x40005C00 - USB_CNTR (USB控制寄存器)"
        echo "  0x40005C44 - USB_ISTR (USB中断状态寄存器)"
        echo "  0x40005C4C - USB_DADDR (USB设备地址寄存器)"
        echo "  0x4002101C - RCC_APB1ENR (包含USB时钟使能位)"
        echo "  0x40010800 - GPIOA_CRL (PA11/PA12配置)"
        echo "  0x40010804 - GPIOA_CRH (PA11/PA12配置)"
    else
        print_warning "无法读取寄存器数据，尝试简化命令..."
        # 尝试只读取最关键的寄存器
        local simple_output=""
        if command -v nc &> /dev/null; then
            simple_output=$(timeout 10s bash -c '
                {
                    echo "halt"
                    sleep 1
                    echo "mdw 0x4002101C 1"
                    sleep 1
                    echo "resume"
                    sleep 0.5
                    echo "exit"
                } | nc localhost 4444 2>/dev/null
            ' 2>/dev/null)
        fi
        
        if [[ -n "$simple_output" ]] && echo "$simple_output" | grep -q "0x"; then
            print_success "简化命令执行成功："
            echo "$simple_output" | grep -E "(0x[0-9a-fA-F]+)"
        else
            print_error "所有寄存器读取尝试都失败"
            echo "可能原因："
            echo "  - 应用程序禁用了调试接口"
            echo "  - SWD引脚被重新配置"
            echo "  - 目标处于深度睡眠或异常状态"
            echo "  - 应用程序可能正常运行，但不允许调试器访问"
        fi
    fi
    
    # 清理
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null
    rm -f "$openocd_log"
    
    echo
}

# 检查时钟配置
check_clock_config() {
    print_header "时钟配置检查"
    
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD未安装或不在PATH中"
        return 1
    fi
    
    print_info "检查系统时钟和USB时钟配置..."
    
    # 启动OpenOCD
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg &
    local openocd_pid=$!
    sleep 2
    
    print_info "读取时钟相关寄存器..."
    {
        echo "reset halt"
        sleep 0.5
        echo "# RCC_CR clock control register"
        echo "mdw 0x40021000 1"
        sleep 0.5
        echo "# RCC_CFGR clock config register"
        echo "mdw 0x40021004 1"
        sleep 0.5
        echo "# RCC_CIR clock interrupt register"
        echo "mdw 0x40021008 1"
        sleep 0.5
        echo "# RCC_APB2RSTR APB2 peripheral reset register"
        echo "mdw 0x4002100C 1"
        sleep 0.5
        echo "# RCC_APB1RSTR APB1 peripheral reset register"
        echo "mdw 0x40021010 1"
        sleep 0.5
        echo "# RCC_AHBENR AHB peripheral clock enable register"
        echo "mdw 0x40021014 1"
        sleep 0.5
        echo "# RCC_APB2ENR APB2 peripheral clock enable register"
        echo "mdw 0x40021018 1"
        sleep 0.5
        echo "# RCC_APB1ENR APB1 peripheral clock enable register - includes USB clock"
        echo "mdw 0x4002101C 1"
        sleep 0.5
        echo "# RCC_BDCR backup domain control register"
        echo "mdw 0x40021020 1"
        sleep 0.5
        echo "# RCC_CSR control/status register"
        echo "mdw 0x40021024 1"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || print_error "无法连接到OpenOCD"
    
    # 清理
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null
    
    print_info "时钟配置检查完成"
    print_info "重点关注："
    echo "  - RCC_APB1ENR bit23 (USBEN): USB时钟使能状态"
    echo "  - RCC_CFGR PLLMUL: PLL倍频因子（影响USB时钟）"
    echo "  - RCC_CFGR USBPRE: USB预分频器设置"
    echo
}

# 测试跳转流程
test_jump_sequence() {
    print_header "跳转流程测试"
    
    print_info "模拟App -> Bootloader -> App跳转序列..."
    
    # 这里可以添加具体的跳转测试逻辑
    # 比如通过串口命令触发跳转，然后检查设备状态
    
    print_warning "此功能需要根据具体硬件连接实现"
    echo
}

# 软重启设备
soft_reset_device() {
    print_header "软重启设备测试"
    
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD未安装或不在PATH中"
        return 1
    fi
    
    print_info "通过OpenOCD执行软重启..."
    
    # 启动OpenOCD
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg &
    local openocd_pid=$!
    sleep 2
    
    print_info "执行软重启命令..."
    {
        echo "reset halt"
        sleep 0.5
        echo "# Read register state before reset"
        echo "mdw 0x40005C00 1"
        echo "mdw 0x40005C44 1"
        echo "mdw 0x4002101C 1"
        sleep 0.5
        echo "# Execute soft reset"
        echo "reset"
        sleep 2
        echo "# Read register state after reset"
        echo "mdw 0x40005C00 1"
        echo "mdw 0x40005C44 1"
        echo "mdw 0x4002101C 1"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || print_error "无法连接到OpenOCD"
    
    # 清理
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null
    
    print_success "软重启完成"
    echo
}

# 测试USB响应能力
test_usb_response() {
    print_header "USB响应测试"
    
    print_info "检查USB设备枚举状态..."
    
    # 检查USB设备是否可见
    local usb_device_found=false
    if command -v lsusb &> /dev/null; then
        if lsusb | grep -i "0483" > /dev/null; then
            print_success "USB设备已枚举"
            lsusb | grep -i "0483"
            usb_device_found=true
        else
            print_error "USB设备未找到"
        fi
    elif command -v system_profiler &> /dev/null; then
        # macOS
        if system_profiler SPUSBDataType | grep -i "STM32" > /dev/null; then
            print_success "USB设备已枚举"
            system_profiler SPUSBDataType | grep -A 5 -B 5 "STM32"
            usb_device_found=true
        else
            print_error "USB设备未找到"
        fi
    fi
    
    if [ "$usb_device_found" = true ]; then
        print_info "尝试与USB设备通信..."
        
        # 查找USB串口设备
        local usb_port=""
        if [[ -d "/dev" ]]; then
            # Linux/macOS
            for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
                if [[ -e "$port" ]]; then
                    usb_port="$port"
                    break
                fi
            done
        fi
        
        if [[ -n "$usb_port" ]]; then
            print_info "找到USB串口: $usb_port"
            
            # 尝试发送版本查询命令测试USB响应
            print_info "发送版本查询命令测试..."
            if command -v python3 &> /dev/null; then
                # 使用Python发送二进制版本查询命令
                python3 -c "
import serial
import time
import sys

try:
    # 打开串口
    ser = serial.Serial('$usb_port', 115200, timeout=3)
    time.sleep(0.1)
    
    # 发送版本查询命令: 包大小(6) + 命令(0xFF) + 子命令(0x00) + CRC(0x0000)
    cmd = bytes([0x06, 0x00, 0xFF, 0x00, 0x00, 0x00])
    print(f'发送命令: {cmd.hex()}')
    ser.write(cmd)
    
    # 读取响应
    response = ser.read(64)  # 最多读取64字节
    if response:
        print(f'收到响应 ({len(response)} 字节): {response.hex()}')
        if len(response) >= 3:
            # 解析版本信息
            crc = int.from_bytes(response[0:2], 'little')
            major = response[2]
            minor = response[3] if len(response) > 3 else 0
            patch = response[4] if len(response) > 4 else 0
            print(f'版本信息: v{major}.{minor}.{patch}')
            print('USB通信正常!')
        else:
            print('响应数据长度不足')
    else:
        print('无响应 - USB通信异常!')
        sys.exit(1)
        
    ser.close()
except Exception as e:
    print(f'USB通信错误: {e}')
    sys.exit(1)
" && print_success "USB通信测试成功" || print_error "USB通信测试失败"
            else
                print_warning "Python3未安装，无法执行详细的USB通信测试"
                # 回退到简单的文本测试
                if command -v timeout &> /dev/null; then
                    timeout 3s sh -c "echo 'test' > $usb_port; cat $usb_port" > /dev/null 2>&1 && print_warning "设备有响应但可能不是预期的协议响应" || print_error "设备无任何响应"
                fi
            fi
        else
            print_warning "未找到USB串口设备"
        fi
    fi
    
    echo
}

# 深度分析USB状态
analyze_usb_deep() {
    print_header "深度USB状态分析"
    
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD未安装"
        return 1
    fi
    
    print_info "详细分析USB相关寄存器和状态..."
    
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg &
    local openocd_pid=$!
    sleep 2
    
    {
        echo "reset halt"
        sleep 1
        
        echo "# USB module status"
        echo "mdw 0x40005C00 1"
        echo "mdw 0x40005C04 1"
        echo "mdw 0x40005C08 1"
        echo "mdw 0x40005C0C 1"
        echo "mdw 0x40005C10 1"
        sleep 1
        
        echo "# Clock and reset status"
        echo "mdw 0x40021000 1"
        echo "mdw 0x40021004 1"
        echo "mdw 0x4002101C 1"
        echo "mdw 0x40021010 1"
        sleep 1
        
        echo "# GPIO configuration PA11/PA12"
        echo "mdw 0x40010800 1"
        echo "mdw 0x40010804 1"
        echo "mdw 0x40010808 1"
        echo "mdw 0x4001080C 1"
        sleep 1
        
        echo "# NVIC interrupt status"
        echo "mdw 0xE000E100 1"
        echo "mdw 0xE000E200 1"
        echo "mdw 0xE000E400 8"
        sleep 1
        
        echo "# USB endpoint status"
        echo "mdw 0x40006000 8"
        sleep 1
        
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || print_error "无法连接到OpenOCD"
    
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null
    
    echo
}

# 软重启前后对比测试
compare_before_after_reset() {
    print_header "软重启前后状态对比"
    
    print_info "此测试将对比软重启前后的USB状态和通信能力..."
    
    local temp_before="/tmp/usb_state_before.txt"
    local temp_after="/tmp/usb_state_after.txt"
    local temp_comm_before="/tmp/usb_comm_before.txt"
    local temp_comm_after="/tmp/usb_comm_after.txt"
    
    # 重启前状态
    print_info "记录重启前USB连接状态..."
    check_usb_connection > "$temp_before" 2>&1
    
    print_info "测试重启前USB通信能力..."
    test_usb_response > "$temp_comm_before" 2>&1
    
    # 执行软重启
    print_info "执行软重启..."
    soft_reset_device
    
    # 等待设备稳定
    print_info "等待设备稳定(5秒)..."
    sleep 5
    
    # 重启后状态
    print_info "记录重启后USB连接状态..."
    check_usb_connection > "$temp_after" 2>&1
    
    print_info "测试重启后USB通信能力..."
    test_usb_response > "$temp_comm_after" 2>&1
    
    # 对比结果
    print_info "USB连接状态对比结果:"
    echo "=== 重启前连接状态 ==="
    cat "$temp_before"
    echo
    echo "=== 重启后连接状态 ==="
    cat "$temp_after"
    echo
    
    print_info "USB通信能力对比结果:"
    echo "=== 重启前通信测试 ==="
    cat "$temp_comm_before"
    echo
    echo "=== 重启后通信测试 ==="
    cat "$temp_comm_after"
    echo
    
    # 分析差异
    print_info "关键差异分析："
    if grep -q "USB通信正常" "$temp_comm_before" && ! grep -q "USB通信正常" "$temp_comm_after"; then
        print_error "检测到关键问题：软重启前USB通信正常，重启后USB通信异常！"
        echo "  - 这确认了软重启导致USB功能失效的问题"
        echo "  - 建议检查USB模块重置序列和时钟配置"
    elif ! grep -q "USB通信正常" "$temp_comm_before" && ! grep -q "USB通信正常" "$temp_comm_after"; then
        print_warning "重启前后USB通信都异常，可能是硬件连接或配置问题"
    elif grep -q "USB通信正常" "$temp_comm_before" && grep -q "USB通信正常" "$temp_comm_after"; then
        print_success "重启前后USB通信都正常，问题可能已解决"
    else
        print_info "USB通信状态变化，需要进一步分析"
    fi
    
    # 清理临时文件
    rm -f "$temp_before" "$temp_after" "$temp_comm_before" "$temp_comm_after"
    
    print_info "对比完成，请检查USB设备状态变化"
    echo
}

# 分析常见问题
analyze_common_issues() {
    print_header "常见问题分析"
    
    print_info "USB跳转问题的常见原因："
    echo "1. USB外设状态未完全清理"
    echo "   - 解决方案：在跳转前调用USBD_Stop()和USBD_DeInit()"
    echo "   - 确保USB时钟被正确禁用和重新启用"
    echo
    
    echo "2. GPIO配置冲突"
    echo "   - 解决方案：在跳转前重置USB GPIO (PA11/PA12)"
    echo "   - 在目标程序中重新配置GPIO"
    echo
    
    echo "3. 时钟配置不匹配"
    echo "   - 解决方案：确保PLL和USB时钟配置一致"
    echo "   - 在跳转前调用HAL_RCC_DeInit()"
    echo
    
    echo "4. 中断状态残留"
    echo "   - 解决方案：清除所有USB相关中断"
    echo "   - 禁用NVIC中的USB中断"
    echo
    
    echo "5. USB缓冲区状态"
    echo "   - 解决方案：确保USB传输完成后再跳转"
    echo "   - 添加适当的延时"
    echo
    
    print_info "软重启后USB无响应的特定原因："
    echo "6. USB模块状态机混乱"
    echo "   - 软重启不会重置USB PHY"
    echo "   - USB设备地址可能保持旧值"
    echo "   - 端点配置状态不一致"
    echo
    
    echo "7. 主机端缓存问题"
    echo "   - 主机系统缓存了设备描述符"
    echo "   - USB枚举状态不一致"
    echo "   - 驱动程序状态异常"
    echo
    
    echo "8. 时序问题"
    echo "   - USB时钟恢复时序不当"
    echo "   - GPIO切换时序问题"
    echo "   - 复位释放时序异常"
    echo
    
    echo "9. 硬件层面问题"
    echo "   - USB上拉电阻状态"
    echo "   - 晶振启动时间"
    echo "   - 电源纹波影响"
    echo
}

# 提供修复建议
provide_fix_suggestions() {
    print_header "修复建议"
    
    print_info "推荐的修复步骤："
    echo "1. 在跳转函数中添加USB状态清理："
    echo "   - USBD_Stop(&hUsbDeviceFS);"
    echo "   - USBD_DeInit(&hUsbDeviceFS);"
    echo "   - __HAL_RCC_USB_CLK_DISABLE();"
    echo "   - HAL_GPIO_DeInit(GPIOA, GPIO_PIN_11 | GPIO_PIN_12);"
    echo
    
    echo "2. 在目标程序启动时强制重置USB："
    echo "   - __HAL_RCC_USB_FORCE_RESET();"
    echo "   - 延时等待"
    echo "   - __HAL_RCC_USB_RELEASE_RESET();"
    echo
    
    echo "3. 添加更多延时确保硬件稳定："
    echo "   - 在USB时钟操作后添加HAL_Delay()"
    echo "   - 在GPIO配置后添加延时"
    echo
    
    echo "4. 检查编译器优化设置："
    echo "   - 确保关键操作不被优化掉"
    echo "   - 使用volatile关键字"
    echo
    
    print_info "针对软重启USB无响应的专用建议："
    echo "5. 实现USB模块完全重置序列："
    echo "   - // 软重启前的清理"
    echo "   - USBD_Stop(&hUsbDeviceFS);"
    echo "   - USBD_DeInit(&hUsbDeviceFS);"
    echo "   - __HAL_RCC_USB_FORCE_RESET();"
    echo "   - HAL_Delay(10);"
    echo "   - __HAL_RCC_USB_RELEASE_RESET();"
    echo "   - HAL_GPIO_WritePin(GPIOA, GPIO_PIN_12, GPIO_PIN_RESET); // 强制断开USB"
    echo "   - HAL_Delay(100);"
    echo    
    echo "6. 在新程序启动时强制USB重新枚举："
    echo "   - // 在SystemClock_Config后立即执行"
    echo "   - __HAL_RCC_USB_CLK_ENABLE();"
    echo "   - __HAL_RCC_USB_FORCE_RESET();"
    echo "   - HAL_Delay(50);"
    echo "   - __HAL_RCC_USB_RELEASE_RESET();"
    echo "   - // 配置GPIO为USB功能"
    echo "   - GPIO_InitStruct.Pin = GPIO_PIN_11 | GPIO_PIN_12;"
    echo "   - GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;"
    echo "   - HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);"
    echo "   - HAL_Delay(100); // 等待USB稳定"
    echo
    
    echo "7. 添加USB连接检测和恢复机制："
    echo "   - 在主循环中定期检查USB连接状态"
    echo "   - 如果检测到连接异常，执行USB重置序列"
    echo "   - 实现USB设备重新枚举逻辑"
    echo
    
    echo "8. 调试时的验证步骤："
    echo "   - 使用示波器观察PA11/PA12信号"
    echo "   - 监控USB时钟的稳定性"
    echo "   - 记录USB寄存器状态变化"
    echo "   - 验证中断是否正常触发"
    echo
}

# 通过串口发送软重启命令
send_soft_reset_command() {
    print_header "通过串口发送软重启命令"
    
    # 查找USB串口设备
    local usb_port=""
    if [[ -d "/dev" ]]; then
        # Linux/macOS
        for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
            if [[ -e "$port" ]]; then
                usb_port="$port"
                break
            fi
        done
    fi
    
    if [[ -z "$usb_port" ]]; then
        print_error "未找到USB串口设备"
        return 1
    fi
    
    print_info "找到USB串口: $usb_port"
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python3未安装，无法发送二进制命令"
        return 1
    fi
    
    print_info "发送重启到bootloader命令..."
    python3 -c "
import serial
import time
import sys

try:
    # 打开串口
    ser = serial.Serial('$usb_port', 115200, timeout=3)
    time.sleep(0.1)
    
    # 发送重启到bootloader命令: 包大小(6) + 命令(0xFF) + 子命令(0xFF) + CRC(0x0000)
    cmd = bytes([0x06, 0x00, 0xFF, 0xFF, 0x00, 0x00])
    print(f'发送重启命令: {cmd.hex()}')
    ser.write(cmd)
    
    # 读取响应
    response = ser.read(16)  # 读取响应
    if response:
        print(f'收到响应 ({len(response)} 字节): {response.hex()}')
        if len(response) >= 1 and response[0] == 0xAA:
            print('设备确认重启命令，正在重启...')
        elif len(response) >= 1 and response[0] == 0xFF:
            print('设备拒绝重启命令')
        else:
            print('收到未知响应')
    else:
        print('无响应')
        
    ser.close()
    print('命令发送完成')
except Exception as e:
    print(f'发送重启命令错误: {e}')
    sys.exit(1)
"
    
    print_success "软重启命令发送完成"
    print_info "等待设备重启(3秒)..."
    sleep 3
    echo
}

# 测试设备是否在bootloader模式
test_bootloader_mode() {
    print_header "测试设备是否在Bootloader模式"
    
    # 查找USB串口设备
    local usb_port=""
    if [[ -d "/dev" ]]; then
        # Linux/macOS
        for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
            if [[ -e "$port" ]]; then
                usb_port="$port"
                break
            fi
        done
    fi
    
    if [[ -z "$usb_port" ]]; then
        print_error "未找到USB串口设备"
        return 1
    fi
    
    print_info "找到USB串口: $usb_port"
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python3未安装，无法测试"
        return 1
    fi
    
    print_info "发送版本查询命令测试模式..."
    python3 -c "
import serial
import time
import sys

try:
    # 打开串口
    ser = serial.Serial('$usb_port', 115200, timeout=3)
    time.sleep(0.1)
    
    # 发送版本查询命令: 包大小(6) + 命令(0xFF) + 子命令(0x00) + CRC(0x0000)
    cmd = bytes([0x06, 0x00, 0xFF, 0x00, 0x00, 0x00])
    print(f'发送版本查询命令: {cmd.hex()}')
    ser.write(cmd)
    
    # 读取响应
    response = ser.read(64)  # 最多读取64字节
    if response:
        print(f'收到响应 ({len(response)} 字节): {response.hex()}')
        if len(response) >= 9:  # 最少响应长度
            # 解析版本信息
            crc = int.from_bytes(response[0:2], 'little')
            major = response[2]
            minor = response[3]
            patch = response[4]
            build = int.from_bytes(response[5:7], 'little')
            timestamp = int.from_bytes(response[7:11], 'little') if len(response) >= 11 else 0
            version_type = response[11] if len(response) >= 12 else 0
            str_len = response[12] if len(response) >= 13 else 0
            
            print(f'版本信息: v{major}.{minor}.{patch} (build {build})')
            if version_type == 0:
                print('设备在 BOOTLOADER 模式')
            elif version_type == 1:
                print('设备在 APPLICATION 模式')
            else:
                print(f'未知版本类型: {version_type}')
                
            if str_len > 0 and len(response) >= 13 + str_len:
                version_str = response[13:13+str_len].decode('utf-8', errors='ignore')
                print(f'版本字符串: {version_str}')
        else:
            print('响应数据长度不足，无法解析版本信息')
    else:
        print('无响应 - 设备可能未连接或异常')
        
    ser.close()
except Exception as e:
    print(f'测试错误: {e}')
    sys.exit(1)
"
    
    echo
}

# 应用程序运行时的USB状态检查
check_running_usb_state() {
    print_header "应用程序运行时USB状态检查"
    
    if ! command -v openocd &> /dev/null; then
        print_error "OpenOCD未安装"
        return 1
    fi
    
    print_info "检查应用程序运行时的USB状态..."
    print_warning "此操作会暂停程序执行，检查完成后会恢复运行"
    
    openocd -f interface/stlink.cfg -f target/stm32f1x.cfg &
    local openocd_pid=$!
    sleep 2
    
    {
        echo "halt"
        sleep 0.5
        
        echo "# USB registers during runtime"
        echo "mdw 0x40005C00 1"
        echo "mdw 0x40005C04 1"
        echo "mdw 0x40005C0C 1"
        echo "mdw 0x4002101C 1"
        sleep 0.5
        
        echo "# GPIO state during runtime"
        echo "mdw 0x40010804 1"
        echo "mdw 0x40010808 1"
        echo "mdw 0x4001080C 1"
        sleep 0.5
        
        echo "# Resume execution"
        echo "resume"
        sleep 0.5
        echo "exit"
    } | telnet localhost 4444 2>/dev/null || print_error "无法连接到OpenOCD"
    
    kill $openocd_pid 2>/dev/null || true
    wait $openocd_pid 2>/dev/null
    
    print_info "运行时USB状态检查完成，程序已恢复运行"
    echo
}

# 测试软重启对USB的具体影响
test_reset_impact_on_usb() {
    print_header "测试软重启对USB的具体影响"
    
    print_info "步骤1: 检查重启前的USB通信"
    test_usb_response
    
    print_info "步骤2: 检查运行时USB寄存器状态"
    check_running_usb_state
    
    print_info "步骤3: 执行软重启"
    send_soft_reset_command
    
    print_info "步骤4: 等待重启完成"
    sleep 3
    
    print_info "步骤5: 检查重启后的USB通信"
    test_usb_response
    
    print_info "步骤6: 检查重启后的USB寄存器状态"
    check_running_usb_state
    
    print_info "软重启USB影响测试完成"
    echo
}

# 测试bootloader与app之间的相互跳转
test_bootloader_app_jump() {
    print_header "Bootloader与App相互跳转测试"
    
    print_info "此测试将检查bootloader与app之间的跳转功能和USB状态变化"
    
    # 首先检测当前模式
    print_info "步骤1: 检测当前运行模式..."
    local current_mode=$(detect_current_mode)
    
    case "$current_mode" in
        "no_usb_device")
            print_error "USB设备未枚举，请检查："
            echo "  - 设备是否已连接"
            echo "  - USB线缆是否正常"
            echo "  - 设备固件是否正常运行"
            return 1
            ;;
        "no_serial_port")
            print_error "USB设备已枚举但未找到串口，可能原因："
            echo "  - USB设备仅作为调试器使用（ST-Link模式）"
            echo "  - 应用程序USB功能异常"
            echo "  - 需要重新烧录固件"
            return 1
            ;;
        "no_python")
            print_error "Python3未安装，无法进行协议测试"
            return 1
            ;;
        "no_response"|"comm_error")
            print_error "USB通信异常，可能原因："
            echo "  - 设备固件崩溃或挂起"
            echo "  - USB通信协议不匹配"
            echo "  - 串口被其他程序占用"
            echo "  - 需要断电重启设备"
            return 1
            ;;
        "unknown")
            print_error "无法检测当前运行模式，设备状态异常"
            return 1
            ;;
        *)
            print_success "当前运行模式: $current_mode"
            ;;
    esac
    
    # 记录跳转前的USB状态
    print_info "步骤2: 记录跳转前USB寄存器状态..."
    local temp_before="/tmp/usb_jump_before.txt"
    check_usb_registers > "$temp_before" 2>&1
    
    # 执行跳转测试
    if [[ "$current_mode" == "APPLICATION" ]]; then
        print_info "步骤3: 从App跳转到Bootloader..."
        test_app_to_bootloader_jump
    else
        print_info "步骤3: 从Bootloader跳转到App..."
        test_bootloader_to_app_jump
    fi
    
    # 等待跳转完成
    print_info "等待跳转完成(5秒)..."
    sleep 5
    
    # 检测跳转后的模式
    print_info "步骤4: 检测跳转后运行模式..."
    local new_mode=$(detect_current_mode)
    
    if [[ "$new_mode" == "unknown" ]]; then
        print_error "跳转后无法检测运行模式，跳转可能失败"
    else
        print_success "跳转后运行模式: $new_mode"
        
        # 验证跳转是否成功
        if [[ "$current_mode" == "APPLICATION" && "$new_mode" == "BOOTLOADER" ]]; then
            print_success "App -> Bootloader 跳转成功"
        elif [[ "$current_mode" == "BOOTLOADER" && "$new_mode" == "APPLICATION" ]]; then
            print_success "Bootloader -> App 跳转成功"
        else
            print_error "跳转失败或模式检测异常"
        fi
    fi
    
    # 记录跳转后的USB状态
    print_info "步骤5: 记录跳转后USB寄存器状态..."
    local temp_after="/tmp/usb_jump_after.txt"
    check_usb_registers > "$temp_after" 2>&1
    
    # 对比跳转前后的USB状态
    print_info "步骤6: 对比跳转前后USB状态..."
    echo "=== 跳转前USB状态 ==="
    cat "$temp_before"
    echo
    echo "=== 跳转后USB状态 ==="
    cat "$temp_after"
    echo
    
    # 分析跳转结果
    analyze_jump_result "$current_mode" "$new_mode"
    
    # 清理临时文件
    rm -f "$temp_before" "$temp_after"
    
    echo
}

# 检测当前运行模式
detect_current_mode() {
    # 首先检查USB设备是否枚举
    local usb_device_exists=false
    if command -v system_profiler &> /dev/null; then
        if system_profiler SPUSBDataType | grep -i "STM32" >/dev/null 2>&1; then
            usb_device_exists=true
        fi
    fi
    
    if [[ "$usb_device_exists" == "false" ]]; then
        echo "no_usb_device"
        return 1
    fi
    
    local usb_port=""
    if [[ -d "/dev" ]]; then
        for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
            if [[ -e "$port" ]]; then
                usb_port="$port"
                break
            fi
        done
    fi
    
    if [[ -z "$usb_port" ]]; then
        echo "no_serial_port"
        return 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        echo "no_python"
        return 1
    fi
    
    local mode=$(python3 -c "
import serial
import time
import sys

try:
    ser = serial.Serial('$usb_port', 115200, timeout=2)
    time.sleep(0.1)
    
    # 发送版本查询命令
    cmd = bytes([0x06, 0x00, 0xFF, 0x00, 0x00, 0x00])
    ser.write(cmd)
    
    response = ser.read(64)
    if response and len(response) >= 12:
        version_type = response[11]
        if version_type == 0:
            print('BOOTLOADER')
        elif version_type == 1:
            print('APPLICATION')
        else:
            print('unknown')
    else:
        print('no_response')
        
    ser.close()
except Exception as e:
    print('comm_error')
    sys.exit(1)
")
    
    echo "$mode"
}

# 从App跳转到Bootloader
test_app_to_bootloader_jump() {
    print_info "执行App -> Bootloader跳转..."
    
    local usb_port=""
    if [[ -d "/dev" ]]; then
        for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
            if [[ -e "$port" ]]; then
                usb_port="$port"
                break
            fi
        done
    fi
    
    if [[ -z "$usb_port" ]]; then
        print_error "未找到USB串口设备"
        return 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python3未安装，无法发送跳转命令"
        return 1
    fi
    
    print_info "发送跳转到bootloader命令..."
    python3 -c "
import serial
import time
import sys

try:
    ser = serial.Serial('$usb_port', 115200, timeout=3)
    time.sleep(0.1)
    
    # 发送跳转到bootloader命令: 包大小(6) + 命令(0xFF) + 子命令(0xFF) + CRC(0x0000)
    cmd = bytes([0x06, 0x00, 0xFF, 0xFF, 0x00, 0x00])
    print(f'发送跳转命令: {cmd.hex()}')
    ser.write(cmd)
    
    response = ser.read(16)
    if response:
        print(f'收到响应 ({len(response)} 字节): {response.hex()}')
        if len(response) >= 1:
            if response[0] == 0xAA:
                print('设备确认跳转命令')
            elif response[0] == 0xFF:
                print('设备拒绝跳转命令')
            else:
                print('收到未知响应')
    else:
        print('无响应')
        
    ser.close()
except Exception as e:
    print(f'跳转命令发送错误: {e}')
"
}

# 从Bootloader跳转到App
test_bootloader_to_app_jump() {
    print_info "执行Bootloader -> App跳转..."
    
    local usb_port=""
    if [[ -d "/dev" ]]; then
        for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
            if [[ -e "$port" ]]; then
                usb_port="$port"
                break
            fi
        done
    fi
    
    if [[ -z "$usb_port" ]]; then
        print_error "未找到USB串口设备"
        return 1
    fi
    
    if ! command -v python3 &> /dev/null; then
        print_error "Python3未安装，无法发送跳转命令"
        return 1
    fi
    
    print_info "发送跳转到应用程序命令..."
    python3 -c "
import serial
import time
import sys

try:
    ser = serial.Serial('$usb_port', 115200, timeout=3)
    time.sleep(0.1)
    
    # 发送跳转到app命令: 包大小(6) + 命令(0xFF) + 子命令(0xFE) + CRC(0x0000)
    cmd = bytes([0x06, 0x00, 0xFF, 0xFE, 0x00, 0x00])
    print(f'发送跳转命令: {cmd.hex()}')
    ser.write(cmd)
    
    response = ser.read(16)
    if response:
        print(f'收到响应 ({len(response)} 字节): {response.hex()}')
        if len(response) >= 1:
            if response[0] == 0xAA:
                print('设备确认跳转命令')
            elif response[0] == 0xFF:
                print('设备拒绝跳转命令')
            else:
                print('收到未知响应')
    else:
        print('无响应')
        
    ser.close()
except Exception as e:
    print(f'跳转命令发送错误: {e}')
"
}

# 分析跳转结果
analyze_jump_result() {
    local before_mode="$1"
    local after_mode="$2"
    
    print_info "跳转结果分析:"
    
    if [[ "$before_mode" == "$after_mode" ]]; then
        print_error "跳转失败: 模式未改变 ($before_mode -> $after_mode)"
        echo "可能原因:"
        echo "  - 跳转命令被拒绝"
        echo "  - 目标程序未正确安装"
        echo "  - 跳转逻辑存在问题"
        echo "  - USB通信异常"
    elif [[ "$before_mode" == "APPLICATION" && "$after_mode" == "BOOTLOADER" ]]; then
        print_success "App -> Bootloader 跳转成功"
        echo "跳转分析:"
        echo "  - 应用程序成功跳转到bootloader"
        echo "  - USB设备重新枚举"
        echo "  - 建议检查USB初始化是否完整"
    elif [[ "$before_mode" == "BOOTLOADER" && "$after_mode" == "APPLICATION" ]]; then
        print_success "Bootloader -> App 跳转成功"
        echo "跳转分析:"
        echo "  - Bootloader成功跳转到应用程序"
        echo "  - USB设备重新枚举"
        echo "  - 建议检查应用程序USB初始化"
    elif [[ "$after_mode" == "unknown" ]]; then
        print_error "跳转后设备无响应"
        echo "可能原因:"
        echo "  - 跳转导致USB功能失效"
        echo "  - 目标程序崩溃或挂起"
        echo "  - USB时钟或GPIO配置错误"
        echo "  - 需要断电重启恢复"
    else
        print_warning "意外的跳转结果: $before_mode -> $after_mode"
    fi
    
    echo
}

# 跳转压力测试
test_jump_stress() {
    print_header "跳转压力测试"
    
    print_info "此测试将执行多次连续跳转，检验跳转稳定性"
    
    local test_count=${1:-10}
    local success_count=0
    local fail_count=0
    
    print_info "开始执行 $test_count 次跳转测试..."
    
    for ((i=1; i<=$test_count; i++)); do
        print_info "=== 第 $i 次跳转测试 ==="
        
        # 检测当前模式
        local current_mode=$(detect_current_mode)
        if [[ "$current_mode" == "unknown" ]]; then
            print_error "第 $i 次测试失败: 无法检测当前模式"
            ((fail_count++))
            continue
        fi
        
        print_info "当前模式: $current_mode"
        
        # 执行跳转
        if [[ "$current_mode" == "APPLICATION" ]]; then
            test_app_to_bootloader_jump
        else
            test_bootloader_to_app_jump
        fi
        
        # 等待跳转完成
        sleep 3
        
        # 检测跳转后模式
        local new_mode=$(detect_current_mode)
        if [[ "$new_mode" == "unknown" ]]; then
            print_error "第 $i 次测试失败: 跳转后无响应"
            ((fail_count++))
        elif [[ "$current_mode" == "$new_mode" ]]; then
            print_error "第 $i 次测试失败: 模式未改变"
            ((fail_count++))
        else
            print_success "第 $i 次测试成功: $current_mode -> $new_mode"
            ((success_count++))
        fi
        
        # 短暂休息
        sleep 2
    done
    
    # 统计结果
    print_header "跳转压力测试结果统计"
    echo "总测试次数: $test_count"
    echo "成功次数: $success_count"
    echo "失败次数: $fail_count"
    echo "成功率: $(( success_count * 100 / test_count ))%"
    
    if [[ $success_count -eq $test_count ]]; then
        print_success "所有跳转测试都成功，跳转功能稳定"
    elif [[ $success_count -gt 0 ]]; then
        print_warning "部分跳转测试失败，跳转功能不稳定"
        echo "建议:"
        echo "  - 增加跳转前的USB清理步骤"
        echo "  - 检查跳转时序和延时设置"
        echo "  - 验证USB重新初始化逻辑"
    else
        print_error "所有跳转测试都失败，跳转功能异常"
        echo "紧急建议:"
        echo "  - 检查跳转命令实现"
        echo "  - 验证目标程序是否正确安装"
        echo "  - 检查USB模块复位和初始化流程"
    fi
    
    echo
}

# USB连接诊断
diagnose_usb_connection() {
    print_header "USB连接问题诊断"
    
    print_info "步骤1: 检查USB设备枚举状态..."
    if command -v system_profiler &> /dev/null; then
        local stlink_found=false
        local usb_device_found=false
        
        # 检查ST-Link调试器
        if system_profiler SPUSBDataType | grep -i "STM32 STLink" >/dev/null 2>&1; then
            print_success "ST-Link调试器已连接"
            stlink_found=true
        else
            print_error "ST-Link调试器未找到"
        fi
        
        # 检查其他STM32设备
        local stm32_devices=$(system_profiler SPUSBDataType | grep -i "STM32" | grep -v "STLink")
        if [[ -n "$stm32_devices" ]]; then
            print_success "发现STM32 USB设备："
            echo "$stm32_devices"
            usb_device_found=true
        else
            print_warning "未发现STM32 USB设备（除调试器外）"
        fi
        
        if [[ "$stlink_found" == "true" && "$usb_device_found" == "false" ]]; then
            print_warning "只有调试器连接，应用程序USB可能异常"
            echo "建议："
            echo "  - 检查应用程序是否正常启动"
            echo "  - 验证USB初始化代码"
            echo "  - 尝试重新烧录固件"
        fi
    fi
    
    print_info "步骤2: 检查USB串口设备..."
    local serial_ports=()
    if [[ -d "/dev" ]]; then
        for port in /dev/tty.usbmodem* /dev/ttyACM* /dev/ttyUSB*; do
            if [[ -e "$port" ]]; then
                serial_ports+=("$port")
            fi
        done
    fi
    
    if [[ ${#serial_ports[@]} -eq 0 ]]; then
        print_error "未找到USB串口设备"
        echo "这表明："
        echo "  - 应用程序USB功能未启动"
        echo "  - USB枚举失败"
        echo "  - 固件可能存在问题"
    else
        print_success "找到 ${#serial_ports[@]} 个USB串口设备："
        for port in "${serial_ports[@]}"; do
            echo "  - $port"
        done
    fi
    
    print_info "步骤3: 检查设备通信能力..."
    if [[ ${#serial_ports[@]} -gt 0 ]]; then
        local port="${serial_ports[0]}"
        if command -v python3 &> /dev/null; then
            python3 -c "
import serial
import time
import sys

try:
    print(f'尝试连接到 $port ...')
    ser = serial.Serial('$port', 115200, timeout=2)
    time.sleep(0.1)
    
    # 发送版本查询命令
    cmd = bytes([0x06, 0x00, 0xFF, 0x00, 0x00, 0x00])
    ser.write(cmd)
    
    response = ser.read(64)
    if response:
        print(f'设备有响应 ({len(response)} 字节)')
        if len(response) >= 12:
            version_type = response[11]
            if version_type == 0:
                print('设备处于 BOOTLOADER 模式')
            elif version_type == 1:
                print('设备处于 APPLICATION 模式')
            else:
                print('设备响应异常，可能协议不匹配')
        else:
            print('响应数据不完整，可能通信异常')
    else:
        print('设备无响应，可能固件异常或协议错误')
        
    ser.close()
except Exception as e:
    print(f'通信测试失败: {e}')
" && print_success "通信测试完成" || print_error "通信测试失败"
        else
            print_warning "Python3未安装，无法进行通信测试"
        fi
    fi
    
    print_info "步骤4: OpenOCD连接测试..."
    if command -v openocd &> /dev/null; then
        local openocd_test_log="/tmp/openocd_test.log"
        timeout 8s openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > "$openocd_test_log" 2>&1 &
        local pid=$!
        sleep 3
        
        if kill -0 $pid 2>/dev/null; then
            print_success "OpenOCD连接成功"
            if grep -q "communication failure" "$openocd_test_log"; then
                print_warning "检测到通信失败，可能SWD接口被禁用"
            fi
        else
            print_error "OpenOCD连接失败"
        fi
        
        kill $pid 2>/dev/null || true
        wait $pid 2>/dev/null
        rm -f "$openocd_test_log"
    else
        print_warning "OpenOCD未安装，无法进行调试接口测试"
    fi
    
    print_info "诊断建议："
    echo "1. 如果只有ST-Link连接："
    echo "   - 应用程序可能崩溃或USB未初始化"
    echo "   - 尝试重新烧录bootloader和app"
    echo "   - 检查USB时钟和GPIO配置"
    echo
    echo "2. 如果有USB设备但无串口："
    echo "   - USB枚举成功但协议异常"
    echo "   - 检查USB描述符配置"
    echo "   - 验证USB类驱动"
    echo
    echo "3. 如果有串口但无响应："
    echo "   - 固件运行但协议处理异常"
    echo "   - 检查串口中断和处理逻辑"
    echo "   - 验证命令解析代码"
    echo
}

# 主函数
main() {
    print_header "USB跳转问题调试工具"
    
    echo "此工具用于排查STM32 IAP跳转时USB通信异常问题"
    echo "问题描述：刷写完成后直接跳转无响应，断电重启后app正常"
    echo
    
    # 检查Python和pyserial
    if command -v python3 &> /dev/null; then
        python3 -c "import serial" 2>/dev/null || print_warning "Python pyserial模块未安装，部分功能受限。安装命令: pip3 install pyserial"
    fi
    
    case "${1:-all}" in
        "usb")
            check_usb_connection
            ;;
        "registers")
            check_usb_registers
            ;;
        "clock")
            check_clock_config
            ;;
        "jump")
            test_jump_sequence
            ;;
        "reset")
            soft_reset_device
            ;;
        "response")
            test_usb_response
            ;;
        "deep")
            analyze_usb_deep
            ;;
        "compare")
            compare_before_after_reset
            ;;
        "analyze")
            analyze_common_issues
            ;;
        "fix")
            provide_fix_suggestions
            ;;
        "soft-reset")
            send_soft_reset_command
            ;;
        "test-mode")
            test_bootloader_mode
            ;;
        "running-state")
            check_running_usb_state
            ;;
        "reset-impact")
            test_reset_impact_on_usb
            ;;
        "jump-test")
            test_bootloader_app_jump
            ;;
        "jump-stress")
            cycles=${2:-5}
            test_jump_stress "$cycles"
            ;;
        "diagnose")
            diagnose_usb_connection
            ;;
        "debug")
            # 专门针对软重启USB问题的完整调试流程
            print_header "软重启USB问题完整调试"
            compare_before_after_reset
            test_usb_response
            analyze_usb_deep
            analyze_common_issues
            provide_fix_suggestions
            ;;
        "protocol-test")
            # 协议级别的完整测试流程
            print_header "协议级别完整测试"
            print_info "步骤1: 测试当前模式"
            test_bootloader_mode
            print_info "步骤2: 发送软重启命令"
            send_soft_reset_command
            print_info "步骤3: 测试重启后模式"
            test_bootloader_mode
            print_info "步骤4: 分析USB状态"
            analyze_usb_deep
            ;;
        "all")
            check_usb_connection
            check_usb_registers
            check_clock_config
            analyze_common_issues
            provide_fix_suggestions
            ;;
        *)
            echo "用法: $0 [选项]"
            echo "选项："
            echo "  usb           - 检查USB连接状态"
            echo "  registers     - 检查USB寄存器状态"
            echo "  clock         - 检查时钟配置"
            echo "  jump          - 测试跳转流程"
            echo "  reset         - 执行OpenOCD软重启设备"
            echo "  response      - 测试USB响应能力"
            echo "  deep          - 深度分析USB状态"
            echo "  compare       - 软重启前后状态对比"
            echo "  analyze       - 分析常见问题"
            echo "  fix           - 提供修复建议"
            echo "  soft-reset    - 通过串口发送软重启命令"
            echo "  test-mode     - 测试设备当前模式(App/Bootloader)"
            echo "  running-state - 检查应用程序运行时USB状态"
            echo "  reset-impact  - 测试软重启对USB的具体影响"
            echo "  jump-test     - 测试bootloader与app相互跳转"
            echo "  jump-stress   - 跳转压力测试(可指定次数)"
            echo "  diagnose      - USB连接问题诊断"
            echo "  debug         - 完整的软重启USB调试流程"
            echo "  protocol-test - 协议级别完整测试(推荐)"
            echo "  all           - 执行基础检查"
            echo
            echo "推荐测试流程："
            echo "1. $0 diagnose        # 诊断USB连接问题"
            echo "2. $0 test-mode       # 测试当前模式"
            echo "3. $0 jump-test       # 测试相互跳转功能"  
            echo "4. $0 running-state   # 检查运行时USB状态"  
            echo "5. $0 reset-impact    # 测试软重启USB影响"
            echo "6. $0 jump-stress 5   # 跳转压力测试"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
