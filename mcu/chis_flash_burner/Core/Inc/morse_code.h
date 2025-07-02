#ifndef __MORSE_CODE_H
#define __MORSE_CODE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* 摩尔斯电码相关定义 */
#define MORSE_DOT_TIME    100   // 点的持续时间(ms)
#define MORSE_DASH_TIME   400   // 划的持续时间(ms)
#define MORSE_GAP_TIME    100   // 符号间隔时间(ms)
#define MORSE_LETTER_GAP  300   // 字母间隔时间(ms)
#define MORSE_WORD_GAP   1000   // 单词间隔时间(ms)

/* 摩尔斯电码状态枚举 */
typedef enum {
    MORSE_STATE_IDLE = 0,
    MORSE_STATE_SENDING_BIT,
    MORSE_STATE_GAP_BETWEEN_BITS,
    MORSE_STATE_GAP_BETWEEN_LETTERS,
    MORSE_STATE_GAP_BETWEEN_WORDS
} morse_state_t;

/* 摩尔斯电码表结构 */
typedef struct {
    char character;
    const char* code;
} morse_code_t;

/* 摩尔斯电码表大小 */
#define MORSE_TABLE_SIZE 27

/* 摩尔斯电码表外部声明 */
extern const morse_code_t morse_table[MORSE_TABLE_SIZE];

/* 摩尔斯电码相关函数声明 */
const char* morse_get_code(char c);


#ifdef __cplusplus
}
#endif

#endif /* __MORSE_CODE_H */
