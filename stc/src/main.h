#ifndef __MAIN_H__
#define __MAIN_H__

// typedef unsigned char uint8_t;
// typedef unsigned int uint16_t ;
// typedef unsigned long uint32_t;

#include <intrins.h>
#include <stdio.h>

#include "STC8H.h"
#include "stc8h_def.h"

#define PWR_5V P33
#define PWR_CART P63

#define LED_RUN P44
#define LED_RD P42
#define LED_WR P43

#define CART_CS1 P61
#define CART_CS2 P46
#define CART_RD P60
#define CART_WR P62
#define CART_IRQ P45
#define CART_AD0 P70
#define CART_AD1 P71
#define CART_AD2 P72
#define CART_AD3 P73
#define CART_AD4 P74
#define CART_AD5 P75
#define CART_AD6 P76
#define CART_AD7 P77
#define CART_AD8 P20
#define CART_AD9 P21
#define CART_AD10 P22
#define CART_AD11 P23
#define CART_AD12 P24
#define CART_AD13 P25
#define CART_AD14 P26
#define CART_AD15 P27
#define CART_A16 P00
#define CART_A17 P01
#define CART_A18 P02
#define CART_A19 P03
#define CART_A20 P04
#define CART_A21 P05
#define CART_A22 P06
#define CART_A23 P07

#define PORT_A P0
#define PORT_AD_L P7
#define PORT_AD_H P2

extern BOOL ep1Busy;

uint32_t reverse4(uint32_t d);
uint16_t reverse2(uint16_t w);
uint16_t reverse2_forIRQ(uint16_t w);


#endif
