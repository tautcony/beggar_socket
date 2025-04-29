import datetime
import struct
import time
import math

try:
    import serial
except ModuleNotFoundError:
    import os
    os.system("pip install pyserial -i https://pypi.tuna.tsinghua.edu.cn/simple")
    import serial

import serial.tools.list_ports


def writeRom(addr_word, dat):
    # if isinstance(dat, list):
    #     dat = bytearray(dat)

    if isinstance(dat, int):
        dat = struct.pack("<H", dat)

    cmd = []
    cmd.extend(struct.pack("<H", 2 + 1 + 4 + len(dat) + 2))
    cmd.append(0xf5)
    cmd.extend(struct.pack("<I", addr_word))
    cmd.extend(dat)
    cmd.extend([0, 0])

    # print("Write rom:", cmd)
    ser.write(cmd)

    ack = ser.read(1)
    # print("Ack:", list(ack))

    # time.sleep(0.01)


def readRom(addr_word, length_byte):

    cmd = []
    cmd.extend(struct.pack("<H", 2 + 1 + 4 + 2 + 2))
    cmd.append(0xf6)
    cmd.extend(struct.pack("<I", addr_word << 1))
    cmd.extend(struct.pack("<H", length_byte))
    cmd.extend([0, 0])

    # print("Read rom:", cmd)
    ser.write(cmd)

    respon = ser.read(length_byte+2)
    respon = respon[2:]
    # print("Respon:", list(respon))

    # time.sleep(0.01)

    return respon


def writeRam(addr, dat):
    # if isinstance(dat, list):
    #     dat = bytearray(dat)

    if isinstance(dat, int):
        dat = struct.pack("B", dat)

    cmd = []
    cmd.extend(struct.pack("<H", 2 + 1 + 4 + len(dat) + 2))
    cmd.append(0xf7)
    cmd.extend(struct.pack("<I", addr))
    cmd.extend(dat)
    cmd.extend([0, 0])

    # print("Write rom:", cmd)
    ser.write(cmd)

    ack = ser.read(1)
    # print("Ack:", list(ack))

    # time.sleep(0.01)


def readRam(addr, length_byte):

    cmd = []
    cmd.extend(struct.pack("<H", 2 + 1 + 4 + 2 + 2))
    cmd.append(0xf8)
    cmd.extend(struct.pack("<I", addr))
    cmd.extend(struct.pack("<H", length_byte))
    cmd.extend([0, 0])

    # print("Read rom:", cmd)
    ser.write(cmd)

    respon = ser.read(length_byte+2)
    respon = respon[2:]
    # print("Respon:", list(respon))

    # time.sleep(0.01)

    return respon


class AGB_GPIO:
    CART_WRITE_FNCPTR = None
    CART_READ_FNCPTR = None

    RTC_BUFFER = None

    # Addresses in byte
    GPIO_REG_DAT = 0xC4  # Data
    GPIO_REG_CNT = 0xC6  # IO Select
    GPIO_REG_RE = 0xC8  # Read Enable Flag Register

    # Commands
    RTC_RESET = 0x60
    RTC_WRITE_STATUS = 0x62
    RTC_READ_STATUS = 0x63
    RTC_WRITE_DATE = 0x64
    RTC_READ_DATE = 0x65
    RTC_WRITE_TIME = 0x66
    RTC_READ_TIME = 0x67
    RTC_WRITE_ALARM = 0x68
    RTC_READ_ALARM = 0x69

    def __init__(self, cart_write_fncptr=None, cart_read_fncptr=None):
        self.CART_WRITE_FNCPTR = cart_write_fncptr
        self.CART_READ_FNCPTR = cart_read_fncptr

    def CartRead(self, addr_byte, length=0):
        addr_word = addr_byte >> 1

        if length == 0:  # auto size:
            data = self.CART_READ_FNCPTR(addr_word, 2)
            data = struct.unpack("<H", data)[0]  # int
        else:
            data = self.CART_READ_FNCPTR(addr_word, length)  # bytes

        return data

    def CartWrite(self, commands, delay=False):
        for command in commands:
            addr_byte = command[0]
            value = command[1]

            addr_word = addr_byte >> 1
            self.CART_WRITE_FNCPTR(addr_word, value)

            if delay is not False:
                time.sleep(delay)

    def EncodeBCD(self, value):
        return math.floor(value / 10) << 4 | value % 10

    def RTCCommand(self, command):
        for i in range(0, 8):
            bit = (command >> (7 - i)) & 0x01  # msb out
            self.CartWrite([
                [self.GPIO_REG_DAT, 4 | (bit << 1)],  # cs 1, sck 0, sio bit
                [self.GPIO_REG_DAT, 4 | (bit << 1)],  # cs 1, sck 0, sio bit
                [self.GPIO_REG_DAT, 4 | (bit << 1)],  # cs 1, sck 0, sio bit
                [self.GPIO_REG_DAT, 5 | (bit << 1)]   # cs 1, sck 1, sio bit
            ])

    def RTCReadData(self):
        data = 0
        for _ in range(0, 8):
            self.CartWrite([
                [self.GPIO_REG_DAT, 4],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 4],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 4],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 4],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 4],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 5]   # cs 1, sck 1
            ])
            temp = self.CartRead(self.GPIO_REG_DAT) & 0xFF
            bit = (temp & 2) >> 1
            data = (data >> 1) | (bit << 7)  # lsb in
            # print("RTCReadData(): i={:d}/temp={:X}/bit={:x}/data={:x}".format(i, temp, bit, data))
        return data

    def RTCWriteData(self, data):
        for i in range(0, 8):
            bit = (data >> i) & 0x01  # lsb out
            self.CartWrite([
                [self.GPIO_REG_DAT, 4 | (bit << 1)],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 4 | (bit << 1)],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 4 | (bit << 1)],  # cs 1, sck 0
                [self.GPIO_REG_DAT, 5 | (bit << 1)]   # cs 1, sck 1
            ])

    def RTCReadStatus(self):
        self.CartWrite([
            [self.GPIO_REG_RE,  1],  # Enable RTC Mapping
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_DAT, 5],  # cs 1, sck 1
            [self.GPIO_REG_CNT, 7],  # Write Enable, gpio 012 output
        ])
        self.RTCCommand(self.RTC_READ_STATUS)
        self.CartWrite([
            [self.GPIO_REG_CNT, 5],  # Read Enable, gpio 1-sio input
        ])
        data = self.RTCReadData()
        self.CartWrite([
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_RE,  0],  # Disable RTC Mapping
        ])
        return data

    def RTCWriteStatus(self, value):
        self.CartWrite([
            [self.GPIO_REG_RE,  1],  # Enable RTC Mapping
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_DAT, 5],  # cs 1, sck 1
            [self.GPIO_REG_CNT, 7],  # Write Enable
        ])
        self.RTCCommand(self.RTC_WRITE_STATUS)
        self.RTCWriteData(value)

        self.CartWrite([
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_RE,  0],  # Disable RTC Mapping
        ])

    def HasRTC(self, buffer=None):

        if buffer:
            self.RTC_BUFFER = buffer[1:]

        if buffer is None:
            status = self.RTCReadStatus()  # hour format bit6 0:12 1:24
        else:
            status = buffer[0]

        print("RTC State:", format(status, '02X'))

        # 没电
        if (status >> 7) == 1:
            print("No RTC because of set RTC Status Register Power Flag:",
                  status >> 7 & 1)
            return 1
        # 用的是12小时格式
        if (status >> 6) != 1:
            print("Unexpected RTC Status Register 24h Flag:",
                  status >> 6 & 1)
            # return 2

        rom1 = self.CartRead(self.GPIO_REG_DAT, 6)
        if buffer is None:
            self.CartWrite([
                [self.GPIO_REG_RE, 1],  # Enable RTC Mapping
            ])
            rom2 = self.CartRead(self.GPIO_REG_DAT, 6)
            self.CartWrite([
                [self.GPIO_REG_RE, 0],  # Disable RTC Mapping
            ])
        else:
            rom2 = buffer[1:7]

        print(' '.join(format(x, '02X') for x in rom1),
              "/",
              ' '.join(format(x, '02X') for x in rom2))
        if (rom1 == rom2):
            print("No RTC because ROM data didn't change:", rom1, rom2)
            return 3

        return True

    def ReadRTC(self, buffer=None):

        if buffer is None:
            self.CartWrite([
                [self.GPIO_REG_RE,  1],  # Enable RTC Mapping
                [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
                [self.GPIO_REG_DAT, 5],  # cs 1, sck 1
                [self.GPIO_REG_CNT, 7],  # Write Enable
            ])
            self.RTCCommand(self.RTC_READ_DATE)
            self.CartWrite([
                [self.GPIO_REG_CNT, 5],  # Read Enable, gpio 1-sio input
            ])
            buffer = bytearray()
            for _ in range(0, 7):  # read 8 byte
                buffer.append(self.RTCReadData())

            self.CartWrite([
                [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
                [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
                [self.GPIO_REG_RE,  0],  # Disable RTC Mapping
            ])

        # Add timestamp of backup time
        # 24h mode = 0x40, reset flag = 0x80
        buffer.append(self.RTCReadStatus())
        buffer.extend(struct.pack("<Q", int(time.time())))  # uint64

        print(' '.join(format(x, '02X') for x in buffer))
        # Digits are BCD (Binary Coded Decimal)
        # [07] 00 01 27 05 06 30 20
        # [07] 00 01 27 05 06 30 28
        # [07] 00 01 27 05 06 52 18
        #      YY MM DD WW HH MM SS
        #      2000-01-27 sat 06:52:18

        self.RTC_BUFFER = buffer
        return buffer

    def WriteRTCDict(self, rtc_dict):
        buffer = bytearray(7)
        try:
            buffer[0] = self.EncodeBCD(rtc_dict["rtc_y"])
            buffer[1] = self.EncodeBCD(rtc_dict["rtc_m"])
            buffer[2] = self.EncodeBCD(rtc_dict["rtc_d"])
            buffer[3] = self.EncodeBCD(rtc_dict["rtc_w"])
            buffer[4] = self.EncodeBCD(rtc_dict["rtc_h"])
            if buffer[4] >= 12:
                buffer[4] |= 0x80
            buffer[5] = self.EncodeBCD(rtc_dict["rtc_i"])
            buffer[6] = self.EncodeBCD(rtc_dict["rtc_s"])
            print("New values: RTC_Y=0x{:02X}, RTC_M=0x{:02X}, RTC_D=0x{:02X}, RTC_W=0x{:02X}, RTC_H=0x{:02X}, RTC_I=0x{:02X}, RTC_S=0x{:02X}".
                  format(buffer[0], buffer[1], buffer[2],
                         buffer[3], buffer[4], buffer[5], buffer[6]))
        except ValueError as e:
            print("Couldn’t update the RTC register values\n", e)

        self.CartWrite([
            [self.GPIO_REG_RE,  1],  # Enable RTC Mapping
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_DAT, 5],  # cs 1, sck 1
            [self.GPIO_REG_CNT, 7],  # Write Enable
        ])
        self.RTCCommand(self.RTC_WRITE_DATE)
        for i in range(0, 7):
            self.RTCWriteData(buffer[i])

        self.CartWrite([
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [self.GPIO_REG_RE,  0],  # Disable RTC Mapping
        ])
        return True

    def WriteRTC(self, buffer, advance=False):
        rtc_status = None
        if buffer == bytearray([0xFF] * len(buffer)):  # Reset
            years = 0
            months = 1
            days = 1
            weekday = 0
            hours = 0
            minutes = 0
            seconds = 0
            rtc_status = 0x40 | 0x80
        else:
            years = self.DecodeBCD(buffer[0x00])
            months = self.DecodeBCD(buffer[0x01])
            days = self.DecodeBCD(buffer[0x02])
            weekday = self.DecodeBCD(buffer[0x03])
            hours = self.DecodeBCD(buffer[0x04] & 0x7F)
            minutes = self.DecodeBCD(buffer[0x05])
            seconds = self.DecodeBCD(buffer[0x06])
            rtc_status = buffer[0x07]
            if rtc_status == 0x01:
                rtc_status = 0x40  # old dumps had this value

        # if advance:
        #     try:
        #         dt_now = datetime.datetime.fromtimestamp(time.time())
        #         timestamp_then = struct.unpack("<Q", buffer[-8:])[0]
        #         timestamp_now = int(time.time())

        #         if timestamp_then < timestamp_now:
        #             dt_then = datetime.datetime.fromtimestamp(timestamp_then)
        #             dt_buffer = datetime.datetime.strptime("{:04d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
        #                 years + 2000, months % 13, days % 32, hours % 60, minutes % 60, seconds % 60), "%Y-%m-%d %H:%M:%S")
        #             rd = relativedelta(dt_now, dt_then)
        #             dt_new = dt_buffer + rd
        #             years = dt_new.year - 2000
        #             months = dt_new.month
        #             days = dt_new.day
        #             dt_buffer_notime = dt_buffer.replace(
        #                 hour=0, minute=0, second=0)
        #             dt_new_notime = dt_new.replace(hour=0, minute=0, second=0)
        #             days_passed = int(
        #                 (dt_new_notime.timestamp() - dt_buffer_notime.timestamp()) / 60 / 60 / 24)
        #             weekday += days_passed % 7
        #             hours = dt_new.hour
        #             minutes = dt_new.minute
        #             seconds = dt_new.second

        #         # dprint(years, months, days, weekday, hours, minutes, seconds)
        #         buffer[0x00] = Util.EncodeBCD(years)
        #         buffer[0x01] = Util.EncodeBCD(months)
        #         buffer[0x02] = Util.EncodeBCD(days)
        #         buffer[0x03] = Util.EncodeBCD(weekday)
        #         buffer[0x04] = Util.EncodeBCD(hours)
        #         if hours >= 12:
        #             buffer[0x04] |= 0x80
        #         buffer[0x05] = Util.EncodeBCD(minutes)
        #         buffer[0x06] = Util.EncodeBCD(seconds)

        #         dstr = ' '.join(format(x, '02X') for x in buffer)
        #         dprint("[{:02X}] {:s}".format(int(len(dstr)/3) + 1, dstr))

        #     except Exception as e:
        #         print("Couldn’t update the RTC register values\n", e)

        d = {
            "rtc_y": years,
            "rtc_m": months,
            "rtc_d": days,
            "rtc_w": weekday,
            "rtc_h": hours,
            "rtc_i": minutes,
            "rtc_s": seconds,
        }
        print(d)
        self.WriteRTCDict(d)

        if rtc_status is not None:
            self.RTCWriteStatus(rtc_status)

    def GetRTCDict(self, has_rtc=None):
        if has_rtc is None:
            has_rtc = self.HasRTC()

        if has_rtc is not True:
            if has_rtc is False or has_rtc in (2, 3):
                return {"string": "Not available"}
            elif has_rtc == 1:
                return {"string": "Not available / Battery dry"}

        if self.RTC_BUFFER is None:
            self.ReadRTC()
        rtc_buffer = self.RTC_BUFFER

        # weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        # bcd to int
        rtc_y = (rtc_buffer[0] & 0x0F) + ((rtc_buffer[0] >> 4) * 10)
        rtc_m = (rtc_buffer[1] & 0x0F) + ((rtc_buffer[1] >> 4) * 10)
        rtc_d = (rtc_buffer[2] & 0x0F) + ((rtc_buffer[2] >> 4) * 10)
        rtc_w = (rtc_buffer[3] & 0x0F) + ((rtc_buffer[3] >> 4) * 10)
        rtc_h = (rtc_buffer[4] & 0x0F) + (((rtc_buffer[4] >> 4) & 0x7) * 10)
        rtc_i = (rtc_buffer[5] & 0x0F) + ((rtc_buffer[5] >> 4) * 10)
        rtc_s = (rtc_buffer[6] & 0x0F) + ((rtc_buffer[6] >> 4) * 10)

        d = {
            "rtc_y": rtc_y,
            "rtc_m": rtc_m,
            "rtc_d": rtc_d,
            "rtc_w": rtc_w,
            "rtc_h": rtc_h,
            "rtc_i": rtc_i,
            "rtc_s": rtc_s,
            "rtc_24h": rtc_buffer[7] >> 6 & 1  # rtc_buffer[0] >> 6 & 1 明明是7才对
        }

        if rtc_y == 0 and rtc_m == 0 and rtc_d == 0 and rtc_h == 0 and rtc_i == 0 and rtc_s == 0:
            # raise ValueError("Invalid RTC data")
            d["string"] = "Invalid RTC data"
            d["rtc_valid"] = False
        else:
            d["string"] = "20{:02d}-{:02d}-{:02d} {:02d}:{:02d}:{:02d}".format(
                rtc_y, rtc_m, rtc_d, rtc_h, rtc_i, rtc_s)
            d["rtc_valid"] = True

        return d

    def GetRTCString(self, has_rtc=None):
        return self.GetRTCDict(has_rtc=has_rtc)["string"]


# ser = serial.Serial()
# ser.port = "COM3"
# ser.open()
# ser.dtr = True
# ser.dtr = False

portName = None
comports = serial.tools.list_ports.comports()
for i in range(0, len(comports)):
    if comports[i].vid == 0x0483 and comports[i].pid == 0x0721:
        portName = comports[i].device
        break

if portName is None:
    input("找不到烧卡器\n")
    exit()
else:
    print("打开", portName, "\n")
    ser = serial.Serial()
    ser.port = portName
    ser.open()
    ser.dtr = True
    ser.dtr = False


# read rom id test
print("Read rom flash ID:")
writeRom(0x000555, struct.pack("<H", 0xaa))
writeRom(0x0002aa, struct.pack("<H", 0x55))
writeRom(0x000555, struct.pack("<H", 0x90))  # ID (Autoselect) Entry

a = readRom(0x00, 2)
print("Manufacture ID", format(struct.unpack("<H", a)[0], "04x"))
a = readRom(0x01, 2)
print("Device ID     ", format(struct.unpack("<H", a)[0], "04x"))
a = readRom(0x0e, 2)
print("Device ID     ", format(struct.unpack("<H", a)[0], "04x"))
a = readRom(0x0f, 2)
print("Device ID     ", format(struct.unpack("<H", a)[0], "04x"), "\n")

writeRom(0x000000, struct.pack("<H", 0xf0))  # Reset/ASO Exit

print("Read ram flash ID:")
writeRam(0x5555, 0xaa)
writeRam(0x2aaa, 0x55)
writeRam(0x5555, 0x90)

a = readRam(0x0000, 1)
print("Device ID 0:", format(struct.unpack("B", a)[0], "02x"))
a = readRam(0x0001, 1)
print("Device ID 1:", format(struct.unpack("B", a)[0], "02x"))

writeRam(0x0000, 0xf0)

a = readRam(0x0000, 1)
print("Device ID 0:", format(struct.unpack("B", a)[0], "02x"))
a = readRam(0x0001, 1)
print("Device ID 1:", format(struct.unpack("B", a)[0], "02x"), "\n")

# exit()


# rtc test
gpio = AGB_GPIO(writeRom, readRom)

a = gpio.HasRTC()
if a is not False:  # True:有时钟 1:没电 2:非24小时格式 3:无rtc
    print("\n检测到RTC\n")
    print(a)

    if not isinstance(a, bool):  # 没电
        print("电池没电，重置rtc")

        gpio.CartWrite([
            [gpio.GPIO_REG_RE,  1],  # Enable RTC Mapping
            [gpio.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [gpio.GPIO_REG_DAT, 5],  # cs 1, sck 1
            [gpio.GPIO_REG_CNT, 7],  # Write Enable
        ])
        gpio.RTCCommand(gpio.RTC_RESET)
        gpio.CartWrite([
            [gpio.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [gpio.GPIO_REG_DAT, 1],  # cs 0, sck 1
            [gpio.GPIO_REG_RE,  0],  # Disable RTC Mapping
        ])

    rtcStr = gpio.GetRTCString()
    print("卡带时间:", rtcStr, "\n")

    print("同步时间")
    rtcDic = gpio.GetRTCDict()
    dt = datetime.datetime.now() + datetime.timedelta(seconds=1)
    rtcDic.update({
        "rtc_y": dt.year-2000,
        "rtc_m": dt.month,
        "rtc_d": dt.day,
        "rtc_w": dt.weekday(),
        "rtc_h": dt.hour,
        "rtc_i": dt.minute,
        "rtc_s": dt.second,
    })
    gpio.WriteRTCDict(rtcDic)

    while True:
        gpio.ReadRTC()
        rtcStr = gpio.GetRTCString(has_rtc=a)
        print("卡带时间:", rtcStr, "\n")
        time.sleep(2)

else:
    print("\n没检测到RTC")

ser.close()
# input()
