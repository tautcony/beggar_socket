#!/bin/bash

# USB诊断脚本 - 检查USB时钟、寄存器、设备状态
# 用于诊断STM32F103C8T6 USB CDC无法枚举的问题

set -e

echo "=== USB CDC 诊断脚本 ==="
echo

# 检查OpenOCD是否运行
if ! pgrep -f openocd > /dev/null; then
    echo "❌ OpenOCD未运行，请先启动OpenOCD"
    echo "   运行: openocd -f interface/stlink.cfg -f target/stm32f1x.cfg"
    exit 1
fi

echo "🔍 正在检查USB相关寄存器状态..."

# 连接telnet并获取寄存器信息
{
    echo "reset halt"
    sleep 1

    echo "# === RCC寄存器检查 ==="
    echo "# RCC_AHBENR (0x40021014) - AHB外设时钟使能"
    echo "mdw 0x40021014 1"

    echo "# RCC_APB1ENR (0x4002101C) - APB1外设时钟使能 (USB在APB1)"
    echo "mdw 0x4002101C 1"

    echo "# RCC_CFGR (0x40021004) - 时钟配置寄存器"
    echo "mdw 0x40021004 1"

    echo "# === USB寄存器检查 ==="
    echo "# USB_CNTR (0x40005C40) - USB控制寄存器"
    echo "mdw 0x40005C40 1"

    echo "# USB_ISTR (0x40005C44) - USB中断状态寄存器"
    echo "mdw 0x40005C44 1"

    echo "# USB_DADDR (0x40005C4C) - USB设备地址寄存器"
    echo "mdw 0x40005C4C 1"

    echo "# USB_BTABLE (0x40005C50) - USB缓冲区表寄存器"
    echo "mdw 0x40005C50 1"

    echo "# === GPIO寄存器检查 (PA11/PA12 - USB D-/D+) ==="
    echo "# GPIOA_CRH (0x40010804) - PA11/PA12配置"
    echo "mdw 0x40010804 1"

    echo "# GPIOA_IDR (0x40010808) - PA输入数据"
    echo "mdw 0x40010808 1"

    echo "# === NVIC中断检查 ==="
    echo "# NVIC_ISER1 (0xE000E104) - 中断使能寄存器1 (USB中断19号)"
    echo "mdw 0xE000E104 1"

    echo "# NVIC_ISPR1 (0xE000E204) - 中断挂起寄存器1"
    echo "mdw 0xE000E204 1"

    echo "# === PC位置检查 ==="
    echo "reg pc"

    echo "exit"
} | telnet localhost 4444 2>/dev/null | grep -v "telnet\|Connected\|Escape\|Connection" | while IFS= read -r line; do
    if [[ $line =~ ^#.*=== ]]; then
        echo
        echo "📋 ${line#"# "}"
    elif [[ $line =~ ^# ]]; then
        echo "   ${line#"# "}"
    elif [[ $line =~ ^mdw.*0x[0-9a-fA-F]+.*1$ ]]; then
        # 提取地址
        addr=$(echo "$line" | grep -o '0x[0-9a-fA-F]\+')
        echo -n "   [$addr]: "
    elif [[ $line =~ ^0x[0-9a-fA-F]+:.*0x[0-9a-fA-F]+ ]]; then
        # 解析寄存器值
        value=$(echo "$line" | grep -o '0x[0-9a-fA-F]\+$')
        echo "$value"

        # 根据地址解析关键位
        case $addr in
            "0x40021014") # RCC_AHBENR
                echo "     USB时钟位: $((($value & 0x1000) ? 1 : 0)) (位12)"
                ;;
            "0x4002101c") # RCC_APB1ENR  
                echo "     USB外设时钟: $((($value & 0x800000) ? 1 : 0)) (位23)"
                ;;
            "0x40021004") # RCC_CFGR
                usbpre=$(($value >> 22 & 1))
                echo "     USB预分频: $usbpre (0=48MHz, 1=32MHz)"
                ;;
            "0x40005c40") # USB_CNTR
                pwdn=$(($value & 2))
                fres=$(($value & 1))
                echo "     PWDN: $((pwdn >> 1)), FRES: $fres"
                ;;
            "0x40005c44") # USB_ISTR
                echo "     中断状态: $value"
                ;;
            "0x40010804") # GPIOA_CRH
                pa11_mode=$(($value >> 12 & 0xF))
                pa12_mode=$(($value >> 16 & 0xF))
                echo "     PA11模式: $pa11_mode, PA12模式: $pa12_mode"
                ;;
            "0xe000e104") # NVIC_ISER1
                usb_int_en=$(($value >> 3 & 1))
                echo "     USB中断使能: $usb_int_en (位19-32=位3)"
                ;;
        esac
    elif [[ $line =~ pc.*0x[0-9a-fA-F]+ ]]; then
        pc=$(echo "$line" | grep -o '0x[0-9a-fA-F]\+' | head -1)
        echo "   当前PC: $pc"

        # 判断PC位置 - 使用printf转换十六进制
        pc_val=$(printf "%d" "$pc" 2>/dev/null || echo 0)
        if (( pc_val >= 0x08000000 && pc_val < 0x08002000 )); then
            echo "   📍 位置: Bootloader区域"
        elif (( pc_val >= 0x08002000 && pc_val < 0x08020000 )); then
            echo "   📍 位置: App区域"
        else
            echo "   📍 位置: 其他区域"
        fi
    fi
done

echo
echo "=== USB诊断分析 ==="
echo "🔍 检查要点："
echo "1. RCC_APB1ENR位23应为1 (USB外设时钟使能)"
echo "2. USB_CNTR的PWDN位应为0, FRES位应为0"
echo "3. PA11/PA12应配置为复用推挽输出(0xB)"
echo "4. USB中断应已使能"
echo "5. PC应在App区域正常运行"
echo
echo "💡 如发现问题，可尝试："
echo "- 检查时钟配置和USB时钟源"
echo "- 确认GPIO复用功能配置正确"
echo "- 验证USB库初始化流程"
echo "- 检查是否有USB复位/断开操作"
