/*---------------------------------------------------------------------*/
/* --- STC MCU Limited ------------------------------------------------*/
/* --- STC 1T Series MCU Demo Programme -------------------------------*/
/* --- Mobile: (86)13922805190 ----------------------------------------*/
/* --- Fax: 86-0513-55012956,55012947,55012969 ------------------------*/
/* --- Tel: 86-0513-55012928,55012929,55012966 ------------------------*/
/* --- Web: www.STCAI.com ---------------------------------------------*/
/* --- Web: www.STCMCUDATA.com  ---------------------------------------*/
/* --- BBS: www.STCAIMCU.com  -----------------------------------------*/
/* --- QQ:  800003751 -------------------------------------------------*/
/* 如果要在程序中使用此代码,请在程序中注明使用了STC的资料及程序        */
/*---------------------------------------------------------------------*/

#include "main.h"
#include "usb_desc.h"

// 设备描述符
char code DEVICEDESC[18] =
    {
        0x12,       // bLength(18);
        0x01,       // bDescriptorType(Device); 设备描述符
        0x00, 0x02, // bcdUSB(2.00);
        0x02,       // bDeviceClass(2:Communication Device Class);
        0x00,       // bDeviceSubClass0);
        0x00,       // bDeviceProtocol(0);  稍后再定义
        0x40,       // bMaxPacketSize0(64); 端点0最大包长
        0x83, 0x04, // idVendor(0483);   厂商id
        0x21, 0x07, // idProduct(0721);  产品id
        0x00, 0x01, // bcdDevice(1.00);  产品版本1.0
        0x01,       // iManufacturer(1); 厂商字符串索引
        0x02,       // iProduct(2);      产品字符串索引
        0x00,       // iSerialNumber(0); 设备序列号字符串索引
        0x01        // bNumConfigurations(1); 有多少个配置
};

// 配置描述符
char code CONFIGDESC[67] = {
    /******************************配置描述符******************************/
    0x09,       // bLength(9);
    0x02,       // bDescriptorType(Configuration); 配置描述符
    0x43, 0x00, // wTotalLength(67);  配置描述符集合总长度（配置+接口+类+端点描述符）
    0x02,       // bNumInterfaces(2); 接口数量
    0x01,       // bConfigurationValue(1); 配置索引
    0x00,       // iConfiguration(0);      配置字符串索引
    0x80,       // bmAttributes(BUSPower); 由总线供电
    0x32,       // MaxPower(100mA);

    /****************************CDC类接口描述符********************************/
    0x09, // bLength(9);
    0x04, // bDescriptorType(Interface); 接口描述符
    0x00, // bInterfaceNumber(0);        接口索引
    0x00, // bAlternateSetting(0);
    0x01, // bNumEndpoints(1);           用1个端点
    0x02, // bInterfaceClass(Communication Interface Class); 接口使用的类，CDC接口类
    0x02, // bInterfaceSubClass(Abstract Control Model);     接口使用的子类，Abstract Control Model（抽象控制模型）
    0x01, // bInterfaceProtocol(Common AT commands);         接口使用的协议，Common At Commands（通用AT指令）
    0x00, // iInterface(0);

    /********************************CDC类特殊功能描述符********************************/
    0x05,       // bLength(5);
    0x24,       // bDescriptorType(CS_INTERFACE);
    0x00,       // bDescriptorSubtype(Header Functional Descriptor); 头功能描述符
    0x10, 0x01, // bcdCDC(1.10); CDC版本号

    0x05, // bLength(5);
    0x24, // bDescriptorType(CS_INTERFACE);
    0x01, // bDescriptorSubtype(Call Management Functional Descriptor);      呼叫管理功能描述符
    0x00, // bmCapabilities(Device does not handles call management itself); 设备不处理呼叫管理（0x00）
    0x01, // bDataInterface(1);                                              数据接口编号

    0x04, // bLength(4);
    0x24, // bDescriptorType(CS_INTERFACE);
    0x02, // bDescriptorSubtype(Abstract Control Management Functional Descriptor);   抽象控制管理功能描述符
    0x02, // bmCapabilities(Set/Get_Line_Coding,Serial_State,Set_Control_Line_State); 支持设置/获取线路编码、串口状态、设置控制线状态

    0x05, // bLength(5);
    0x24, // bDescriptorType(CS_INTERFACE);
    0x06, // bDescriptorSubtype(Union Functional descriptor); 联合功能描述符
    0x00, // bMasterInterface(0); 主接口编号
    0x01, // bSlaveInterface0(1); 从接口编号

    /********************************CDC控制端点描述符********************************/
    0x07, // bLength(7);
    0x05, // bDescriptorType(Endpoint);
    0x82, // bEndpointAddress(EndPoint2 as IN); 端点2 in
    0x03, // bmAttributes(Interrupt); 中断端点
    0x40,
    0x00, // wMaxPacketSize(64); 包长64
    0xff, // bInterval(255ms);   轮询时间

    /********************************数据类接口描述符*********************************/
    0x09, // bLength(9);
    0x04, // bDescriptorType(Interface); 接口描述符
    0x01, // bInterfaceNumber(1);        接口索引
    0x00, // bAlternateSetting(0);
    0x02, // bNumEndpoints(2);           使用2个端点
    0x0a, // bInterfaceClass(Data Interface Class); 数据类
    0x00, // bInterfaceSubClass(AData Interface Class SubClass Codes);
    0x00, // bInterfaceProtocol(USB SPEC);
    0x00, // iInterface(0);

    /********************************批量输入端点描述符*****************************/
    0x07,       // bLength(7);
    0x05,       // bDescriptorType(Endpoint);
    0x81,       // bEndpointAddress(EndPoint1 as IN); 端点1 in
    0x02,       // bmAttributes(Bulk);                批量端点
    0x40, 0x00, // wMaxPacketSize(64);                包长64
    0x00,       // bInterval(Ignored);

    /********************************批量输出端点描述符*****************************/
    0x07,       // bLength(7);
    0x05,       // bDescriptorType(Endpoint);
    0x01,       // bEndpointAddress(EndPoint1 as OUT); 端点1 out
    0x02,       // bmAttributes(Bulk);                 批量端点
    0x40, 0x00, // wMaxPacketSize(64);                 包长64
    0x00        // bInterval(Ignored);
};

char code LANGIDDESC[4] = {
    0x04,      // 长度
    0x03,      // 字符串描述符
    0x09, 0x04 // 美式英语
};

char code MANUFACTDESC[] = {
    26,         // 该描述符的长度为26字节
    0x03,       // 字符串描述符的类型编码为0x03
    0x43, 0x00, // C
    0x4e, 0x00, // N
    0x59, 0x00, // Y
    0x20, 0x00, //
    0x49, 0x00, // I
    0x6e, 0x00, // n
    0x64, 0x00, // d
    0x75, 0x00, // u
    0x73, 0x00, // s
    0x74, 0x00, // t
    0x72, 0x00, // r
    0x79, 0x00  // y
};

char code PRODUCTDESC[] = {
    50,         // 该描述符的长度为50字节
    0x03,       // 字符串描述符的类型编码为0x03
    0x47, 0x00, // G
    0x42, 0x00, // B
    0x41, 0x00, // A
    0x20, 0x00, //
    0x42, 0x00, // B
    0x75, 0x00, // u
    0x72, 0x00, // r
    0x6e, 0x00, // n
    0x65, 0x00, // e
    0x72, 0x00, // r
    0x20, 0x00, //
    0x66, 0x00, // f
    0x6f, 0x00, // o
    0x72, 0x00, // r
    0x20, 0x00, //
    0x43, 0x00, // C
    0x68, 0x00, // h
    0x69, 0x00, // i
    0x73, 0x00, // s
    0x46, 0x00, // F
    0x6c, 0x00, // l
    0x61, 0x00, // a
    0x73, 0x00, // s
    0x68, 0x00  // h
};

char code PACKET0[2] = {0, 0};

char code PACKET1[2] = {1, 0};
