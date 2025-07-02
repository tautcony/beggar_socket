#!/bin/bash

# 一键PC定位和源码查看脚本
# 专门为STM32F103调试设计

cd "$(dirname "$0")/chis_flash_burner"

echo "=== 一键PC定位脚本 ==="

# 启动OpenOCD并读取PC
echo "启动OpenOCD..."
openocd -f interface/stlink.cfg -f target/stm32f1x.cfg > /tmp/openocd.log 2>&1 &
OPENOCD_PID=$!
sleep 3

if ! kill -0 $OPENOCD_PID 2>/dev/null; then
    echo "错误: OpenOCD启动失败"
    cat /tmp/openocd.log
    exit 1
fi

echo "读取PC值..."
PC_VALUE=""
{
    echo "halt"
    sleep 1
    echo "reg pc"
    sleep 1
    echo "exit"
} | nc localhost 4444 > /tmp/pc_output.txt 2>&1

# 清理OpenOCD
kill $OPENOCD_PID 2>/dev/null
wait $OPENOCD_PID 2>/dev/null

# 从输出中提取PC值
if [[ -f /tmp/pc_output.txt ]]; then
    echo "OpenOCD输出:"
    cat /tmp/pc_output.txt
    echo ""

    PC_VALUE=$(strings /tmp/pc_output.txt | grep -o "0x[0-9a-fA-F]*" | tail -1)
fi

if [[ -z "$PC_VALUE" ]]; then
    echo "错误: 无法读取PC值"
    exit 1
fi

echo "当前PC: $PC_VALUE"

# 判断PC在哪个区域
PC_NUM=$(printf "%d" "$PC_VALUE" 2>/dev/null)
if [[ $? -ne 0 ]]; then
    echo "错误: PC值格式不正确: $PC_VALUE"
    exit 1
fi

if [[ $PC_NUM -ge $((0x08000000)) && $PC_NUM -lt $((0x08006000)) ]]; then
    echo "PC在Bootloader区域 (0x08000000-0x08005FFF)"
    ELF_FILE="build/bootloader/bootloader/chis_flash_burner_bootloader.elf"
    REGION="bootloader"
elif [[ $PC_NUM -ge $((0x08006000)) && $PC_NUM -lt $((0x08010000)) ]]; then
    echo "PC在Application区域 (0x08006000-0x0800FFFF)"
    ELF_FILE="build/app/app/chis_flash_burner_app.elf"
    REGION="app"
else
    echo "警告: PC不在预期的Flash区域内"
    echo "尝试用app ELF文件查找..."
    ELF_FILE="build/app/app/chis_flash_burner_app.elf"
    REGION="unknown"
fi

echo "使用ELF文件: $ELF_FILE"

if [[ ! -f "$ELF_FILE" ]]; then
    echo "错误: ELF文件不存在: $ELF_FILE"
    echo "请先编译对应的目标:"
    if [[ "$REGION" == "bootloader" ]]; then
        echo "  ../cmake-build.sh build bootloader"
    else
        echo "  ../cmake-build.sh build app"
    fi
    exit 1
fi

echo ""
echo "=== 源码位置查找 ==="

# 用addr2line查找源码位置
SOURCE_INFO=$(arm-none-eabi-addr2line -e "$ELF_FILE" -f -C "$PC_VALUE" 2>/dev/null)
if [[ $? -eq 0 && "$SOURCE_INFO" != "??:0" ]]; then
    FUNCTION_NAME=$(echo "$SOURCE_INFO" | head -1)
    FILE_LINE=$(echo "$SOURCE_INFO" | tail -1)

    echo "函数: $FUNCTION_NAME"
    echo "位置: $FILE_LINE"

    # 尝试显示源码
    if [[ "$FILE_LINE" =~ ^(.+):([0-9]+)$ ]]; then
        FILE_PATH="${BASH_REMATCH[1]}"
        LINE_NUM="${BASH_REMATCH[2]}"

        # 查找实际文件
        ACTUAL_FILE=""
        if [[ -f "$FILE_PATH" ]]; then
            ACTUAL_FILE="$FILE_PATH"
        else
            BASE_NAME=$(basename "$FILE_PATH")
            ACTUAL_FILE=$(find . -name "$BASE_NAME" -type f | head -1)
        fi

        if [[ -n "$ACTUAL_FILE" && -f "$ACTUAL_FILE" ]]; then
            echo ""
            echo "源码 (第${LINE_NUM}行附近):"
            echo "----------------------------------------"

            START_LINE=$((LINE_NUM - 3))
            END_LINE=$((LINE_NUM + 3))
            [[ $START_LINE -lt 1 ]] && START_LINE=1

            sed -n "${START_LINE},${END_LINE}p" "$ACTUAL_FILE" | nl -v$START_LINE | while IFS= read -r line; do
                CURRENT_LINE_NUM=$(echo "$line" | awk '{print $1}')
                if [[ $CURRENT_LINE_NUM -eq $LINE_NUM ]]; then
                    echo ">>> $line"  # 高亮当前行
                else
                    echo "    $line"
                fi
            done
            echo "----------------------------------------"
        else
            echo "未找到源文件: $FILE_PATH"
        fi
    fi
else
    echo "无法解析源码位置 (可能ELF文件被strip了)"
    echo ""
    echo "=== 反汇编信息 ==="
    START_ADDR=$((PC_NUM - 16))
    END_ADDR=$((PC_NUM + 32))
    START_HEX=$(printf "0x%x" $START_ADDR)
    END_HEX=$(printf "0x%x" $END_ADDR)

    echo "反汇编 ($START_HEX - $END_HEX):"
    arm-none-eabi-objdump -d "$ELF_FILE" --start-address="$START_HEX" --stop-address="$END_HEX" | while IFS= read -r line; do
        if echo "$line" | grep -q "$PC_VALUE"; then
            echo ">>> $line"
        else
            echo "    $line"
        fi
    done
fi

echo ""
echo "完成!"
