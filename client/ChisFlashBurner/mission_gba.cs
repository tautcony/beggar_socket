using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ChisFlashBurner
{
    public partial class Form1
    {

        void gba_sramSwitchBank(int bank)
        {
            bank = bank == 0 ? 0 : 1;

            rom_write(0x800000, BitConverter.GetBytes((UInt16)bank));
        }

        void gba_flashSwitchBank(int bank)
        {
            bank = bank == 0 ? 0 : 1;

            ram_write(0x5555, new byte[] { 0xaa });
            ram_write(0x2aaa, new byte[] { 0x55 });
            ram_write(0x5555, new byte[] { 0xb0 }); // FLASH_COMMAND_SWITCH_BANK
            ram_write(0x0000, new byte[] { (byte)bank });
        }

        void gba_romGetSize(out int secotrCount, out int sectorSize, out int bufferWriteBytes, out int deviceSize)
        {
            byte[] cfi = new byte[20];
            int temp, temp1;

            // CFI Query
            rom_write(0x55, BitConverter.GetBytes((UInt16)0x98));
            rom_read(0x27 << 1, ref cfi);
            // reset
            rom_write(0x00, BitConverter.GetBytes((UInt16)0xf0));

            temp = BitConverter.ToUInt16(cfi, 0); // 27h
            deviceSize = (int)Math.Pow(2, temp);

            temp = BitConverter.ToUInt16(cfi, 6); // 2a
            if (temp == 0)
                bufferWriteBytes = 0;
            else
                bufferWriteBytes = (int)Math.Pow(2, temp);

            temp = BitConverter.ToUInt16(cfi, 12);  // 2d
            temp1 = BitConverter.ToUInt16(cfi, 14); // 2e
            secotrCount = (((temp1 & 0xff) << 8) | (temp & 0xff)) + 1;

            temp = BitConverter.ToUInt16(cfi, 16); // 2f
            temp1 = BitConverter.ToUInt16(cfi, 18); // 30
            sectorSize = (((temp1 & 0xff) << 8) | (temp & 0xff)) * 256;
        }

        //////////////////////////////////////
        //////////////////////////////////////
        //////////////////////////////////////

        void mission_readRomID()
        {
            tmr_transTimeout.Start();

            byte[] id = new byte[8];
            bool ack = rom_readID(ref id);

            if (ack)
            {
                printLog(BitConverter.ToString(id).Replace("-", " "));

                if (id.SequenceEqual(new byte[] { 0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22 }))
                    printLog("S29GL256");
                else if (id.SequenceEqual(new byte[] { 0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22 }))
                    printLog("JS28F256");
                else
                    printLog("ID暂未收录，可能无法写入");

            }
            else
            {
                printLog("crc校验失败");
            }

            int deviceSize, secotrCount, sectorSize, bufferWriteBytes;
            gba_romGetSize(out secotrCount, out sectorSize, out bufferWriteBytes, out deviceSize);

            printLog(string.Format("容量:{0:d} 扇区数量:{1:d} 扇区大小:{2:d} BuffWr:{3:d}", deviceSize, secotrCount, sectorSize, bufferWriteBytes));

            tmr_transTimeout.Stop();
            port.Close();
            enableButton();
        }

        void mission_eraseChip()
        {
            tmr_transTimeout.Start();

            rom_eraseChip();
            transTimeout_feed(); // 喂狗

            //检查结果
            while (true)
            {
                byte[] respon = new byte[2];
                bool ack = rom_read(0x000000, ref respon);

                if (ack)
                {
                    printLog(string.Format("..... {0:x4}", BitConverter.ToUInt16(respon, 0)));
                    if (BitConverter.ToUInt16(respon, 0) == 0xffff)
                    {
                        printLog("擦除完毕");
                        break;
                    }
                    else
                    {
                        transTimeout_feed(); // 喂狗
                        Thread.Sleep(1000);
                    }
                }
                else
                {
                    printLog("crc校验失败");
                }
            }

            port.Close();
            enableButton();
            tmr_transTimeout.Stop();
        }

        void mission_programRom()
        {
            tmr_transTimeout.Start();

            // 打开文件
            string romFilePath = textBox_romPath.Text;

            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Open, FileAccess.Read);
            }
            catch (System.IO.IOException)
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                tmr_transTimeout.Stop();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] rom = new byte[fileLength];
            file.Read(rom, 0, fileLength);
            file.Close();

            // 获取rom flash buffer大小
            int deviceSize, secotrCount, sectorSize, bufferWriteBytes;
            gba_romGetSize(out secotrCount, out sectorSize, out bufferWriteBytes, out deviceSize);

            // 开始发送
            int writtenCount = 0;
            while (writtenCount < fileLength)
            {
                // 分包
                int sentLen = fileLength - writtenCount;
                sentLen = sentLen > 4096 ? 4096 : sentLen;

                byte[] sendPack = new byte[sentLen];
                Array.Copy(rom, writtenCount, sendPack, 0, sentLen);

                // 写入
                bool ack = rom_program((UInt32)writtenCount, sendPack, (UInt16)bufferWriteBytes);
                //bool ack = rom_program((UInt32)writtenCount, sendPack, 0);
                transTimeout_feed(); //喂狗

                if (ack)
                {
                    writtenCount += sentLen;
                    showProgress(writtenCount, fileLength);
                }
                else
                {
                    printLog(string.Format(
                        "0x{0:x8}发送失败，重传",
                        writtenCount
                    ));
                    continue;
                }
            }

            port.Close();
            enableButton();
            tmr_transTimeout.Stop();
            printLog("烧录结束");
        }

        void mission_dumpRom()
        {
            tmr_transTimeout.Start();

            int fileLength = (int)(double.Parse(comboBox_romSize.Text) * 1024 * 1024);
            byte[] rom = new byte[fileLength];

            int readCount = 0;
            while (readCount < fileLength)
            {
                // 分包
                int readLen = fileLength - readCount;
                readLen = readLen > 4096 ? 4096 : readLen;

                // 读取
                byte[] respon = new byte[readLen];
                bool ack = rom_read((UInt32)readCount, ref respon);

                transTimeout_feed(); // 喂狗

                if (ack)
                {
                    Array.Copy(respon, 0, rom, readCount, readLen);
                    readCount += readLen;
                    showProgress(readCount, fileLength);
                }
                else
                {
                    printLog(string.Format(
                        "0x{0:x8}接收失败，重传",
                        readCount
                    ));
                }

            }

            // 保存
            string romFilePath = textBox_romPath.Text; // 打开文件
            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Create, FileAccess.Write);
            }
            catch (System.IO.IOException)
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                tmr_transTimeout.Stop();
                return;
            }

            file.Write(rom, 0, fileLength);
            file.Close();

            port.Close();
            enableButton();
            tmr_transTimeout.Stop();

            printLog("导出结束");
        }

        void mission_verifyRom()
        {
            tmr_transTimeout.Start();

            // 打开文件
            string romFilePath = textBox_romPath.Text;

            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Open, FileAccess.Read);
            }
            catch (System.IO.IOException)
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                tmr_transTimeout.Stop();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] rom = new byte[fileLength];
            file.Read(rom, 0, fileLength);
            file.Close();

            int readCount = 0;
            while (readCount < fileLength)
            {
                // 分包
                int readLen = fileLength - readCount;
                readLen = readLen > 4096 ? 4096 : readLen;

                // 读取
                byte[] respon = new byte[readLen];
                bool ack = rom_read((UInt32)readCount, ref respon);

                transTimeout_feed(); // 喂狗

                if (ack)
                {
                    for (int i = 0; i < readLen; i++)
                    {
                        if (rom[readCount + i] != respon[i])
                        {
                            printLog(string.Format(
                                "0x{0:x8}校验失败，{1:x2} -> {2:x2}",
                                readCount + i,
                                rom[readCount + i],
                                respon[i]
                            ));
                            transTimeout_feed(); // 喂狗
                        }
                    }
                    readCount += readLen;
                    showProgress(readCount, fileLength);
                }
                else
                {
                    printLog(string.Format(
                        "0x{0:x8}接收失败，重传",
                        readCount
                    ));
                }

            }

            port.Close();
            enableButton();
            tmr_transTimeout.Stop();
            printLog("校验结束");
        }

        void mission_wrtieSram()
        {
            tmr_transTimeout.Start();

            // 打开文件
            string savFilePath = textBox_savePath.Text;

            FileStream file;
            try
            {
                file = new FileStream(savFilePath, FileMode.Open, FileAccess.Read);
            }
            catch (System.IO.IOException)
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                tmr_transTimeout.Stop();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] sav = new byte[fileLength];
            file.Read(sav, 0, fileLength);
            file.Close();

            // 如果是flash就擦除
            if (comboBox_ramType.Text == "FLASH")
            {
                // 擦除flash
                printLog("擦除flash");
                ram_write(0x5555, new byte[] { 0xaa });
                ram_write(0x2aaa, new byte[] { 0x55 });
                ram_write(0x5555, new byte[] { 0x80 });
                ram_write(0x5555, new byte[] { 0xaa });
                ram_write(0x2aaa, new byte[] { 0x55 });
                ram_write(0x5555, new byte[] { 0x10 }); // Chip-Erase

                // 等待擦除完成
                while (true)
                {
                    byte[] respon = new byte[1];

                    bool ack = ram_read(0x0000, ref respon);

                    if (ack)
                    {
                        printLog(string.Format("..... {0:x2}", respon[0]));
                        if (respon[0] == 0xff)
                        {
                            printLog("擦除完毕");
                            showProgress(0, fileLength);
                            break;
                        }
                        else
                        {
                            transTimeout_feed(); // 喂狗
                            Thread.Sleep(1000);
                        }
                    }
                    else
                    {
                        printLog("crc校验失败");
                    }
                }
            }

            // 开始写入
            int writtenCount = 0;
            while (writtenCount < fileLength)
            {
                // 切bank
                if (writtenCount == 0x00000)
                {
                    printLog("切换至Bank 0");
                    if (comboBox_ramType.Text == "FLASH")
                        gba_flashSwitchBank(0);
                    else
                        gba_sramSwitchBank(0);
                }
                if (writtenCount == 0x10000)
                {
                    printLog("切换至Bank 1");
                    if (comboBox_ramType.Text == "FLASH")
                        gba_flashSwitchBank(1);
                    else
                        gba_sramSwitchBank(1);
                }

                UInt32 baseAddr = (UInt32)(writtenCount & 0xffff);

                // 分包
                int sentLen = fileLength - writtenCount;
                sentLen = sentLen > 4096 ? 4096 : sentLen;

                byte[] sendPack = new byte[sentLen];
                Array.Copy(sav, writtenCount, sendPack, 0, sentLen);

                // 发送
                bool ack;
                if (comboBox_ramType.Text == "FLASH")
                    ack = ram_flashProgram(baseAddr, sendPack);
                else
                    ack = ram_write(baseAddr, sendPack);
                transTimeout_feed(); //喂狗

                if (ack)
                {
                    writtenCount += sentLen;
                    showProgress(writtenCount, fileLength);
                }
                else
                {
                    printLog(string.Format(
                        "0x{0:x8}发送失败，重传",
                        writtenCount
                    ));
                    continue;
                }
            }

            port.Close();
            enableButton();
            tmr_transTimeout.Stop();
            printLog("烧录结束");
        }

        void mission_dumpRam()
        {
            tmr_transTimeout.Start();

            int fileLength = (int)(double.Parse(comboBox_saveSize.Text) * 1024.0);
            byte[] sav = new byte[fileLength];

            int readCount = 0;
            while (readCount < fileLength)
            {
                // 切bank
                if (readCount == 0x00000)
                {
                    printLog("切换至Bank 0");
                    if (comboBox_ramType.Text == "FLASH")
                        gba_flashSwitchBank(0);
                    else
                        gba_sramSwitchBank(0);
                }
                if (readCount == 0x10000)
                {
                    printLog("切换至Bank 1");
                    if (comboBox_ramType.Text == "FLASH")
                        gba_flashSwitchBank(1);
                    else
                        gba_sramSwitchBank(1);
                }

                UInt32 baseAddr = (UInt32)(readCount & 0xffff);

                // 分包
                int readLen = fileLength - readCount;
                readLen = readLen > 4096 ? 4096 : readLen;

                // 读取
                byte[] respon = new byte[readLen];
                bool ack = ram_read((UInt32)baseAddr, ref respon);

                transTimeout_feed(); // 喂狗

                if (ack)
                {
                    Array.Copy(respon, 0, sav, readCount, readLen);
                    readCount += readLen;
                    showProgress(readCount, fileLength);
                }
                else
                {
                    printLog(string.Format(
                        "0x{0:x8}接收失败，重传",
                        readCount
                    ));
                    continue;
                }

            }

            // 保存
            string romFilePath = textBox_savePath.Text; // 打开文件
            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Create, FileAccess.Write);
            }
            catch (System.IO.IOException)
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                tmr_transTimeout.Stop();
                return;
            }

            file.Write(sav, 0, fileLength);
            file.Close();

            port.Close();
            enableButton();
            tmr_transTimeout.Stop();

            printLog("导出结束");
        }

        void mission_verifyRam()
        {
            tmr_transTimeout.Start();

            // 打开文件
            string savFilePath = textBox_savePath.Text;

            FileStream file;
            try
            {
                file = new FileStream(savFilePath, FileMode.Open, FileAccess.Read);
            }
            catch (System.IO.IOException)
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                tmr_transTimeout.Stop();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] sav = new byte[fileLength];
            file.Read(sav, 0, fileLength);
            file.Close();

            int readCount = 0;
            while (readCount < fileLength)
            {
                // 切bank
                if (readCount == 0x00000)
                {
                    printLog("切换至Bank 0");
                    if (comboBox_ramType.Text == "FLASH")
                        gba_flashSwitchBank(0);
                    else
                        gba_sramSwitchBank(0);
                }
                if (readCount == 0x10000)
                {
                    printLog("切换至Bank 1");
                    if (comboBox_ramType.Text == "FLASH")
                        gba_flashSwitchBank(1);
                    else
                        gba_sramSwitchBank(1);
                }

                UInt32 baseAddr = (UInt32)(readCount & 0xffff);

                // 分包
                int readLen = fileLength - readCount;
                readLen = readLen > 4096 ? 4096 : readLen;

                // 读取
                byte[] respon = new byte[readLen];
                bool ack = ram_read((UInt32)baseAddr, ref respon);

                transTimeout_feed(); // 喂狗

                if (ack)
                {
                    for (int i = 0; i < readLen; i++)
                    {
                        if (sav[readCount + i] != respon[i])
                        {
                            printLog(string.Format(
                                "0x{0:x8}校验失败，{1:x2} -> {2:x2}",
                                readCount + i,
                                sav[readCount + i],
                                respon[i]
                            ));
                            transTimeout_feed(); //喂狗
                        }
                    }
                    readCount += readLen;
                    showProgress(readCount, fileLength);
                }
                else
                {
                    printLog(string.Format(
                        "0x{0:x8}接收失败，重传",
                        readCount
                    ));
                    continue;
                }

            }

            printLog("校验结束");
            port.Close();
            enableButton();
            tmr_transTimeout.Stop();
        }

    }
}
