#include <stddef.h>
#include "morse_code.h"

const morse_code_t morse_table[MORSE_TABLE_SIZE] = {
    [0] = {.character = 'A', .code = ".-"},
    [1] = {.character = 'B', .code = "-..."},
    [2] = {.character = 'C', .code = "-.-."},
    [3] = {.character = 'D', .code = "-.."},
    [4] = {.character = 'E', .code = "."},
    [5] = {.character = 'F', .code = "..-."},
    [6] = {.character = 'G', .code = "--."},
    [7] = {.character = 'H', .code = "...."},
    [8] = {.character = 'I', .code = ".."},
    [9] = {.character = 'J', .code = ".---"},
    [10] = {.character = 'K', .code = "-.-"},
    [11] = {.character = 'L', .code = ".-.."},
    [12] = {.character = 'M', .code = "--"},
    [13] = {.character = 'N', .code = "-."},
    [14] = {.character = 'O', .code = "---"},
    [15] = {.character = 'P', .code = ".--."},
    [16] = {.character = 'Q', .code = "--.-"},
    [17] = {.character = 'R', .code = ".-."},
    [18] = {.character = 'S', .code = "..."},
    [19] = {.character = 'T', .code = "-"},
    [20] = {.character = 'U', .code = "..-"},
    [21] = {.character = 'V', .code = "...-"},
    [22] = {.character = 'W', .code = ".--"},
    [23] = {.character = 'X', .code = "-..-"},
    [24] = {.character = 'Y', .code = "-.--"},
    [25] = {.character = 'Z', .code = "--.."},
    [26] = {.character = ' ', .code = " "}
};

/**
 * @brief 查找字符对应的摩尔斯电码
 * @param c 字符
 * @return 摩尔斯电码字符串，NULL表示未找到
 */
const char* morse_get_code(char c)
{
    for (int i = 0; i < MORSE_TABLE_SIZE; i++) {
        if (morse_table[i].character == c) {
            return morse_table[i].code;
        }
    }
    return NULL;
}
