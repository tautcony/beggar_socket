using System;
using System.Collections.Generic;
using System.Diagnostics;
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

        void gba_romEraseSector(int addrFrom, int addrTo, int sectorSize)
        {
            addrFrom /= 2;
            addrTo /= 2;
            sectorSize /= 2;

            int sectorMask = sectorSize - 1;
            addrTo &= ~sectorMask;

            printLog(string.Format("擦除 0x{0:x8} - 0x{1:x8}", addrFrom, addrTo));

            for (int sa = addrTo; sa >= addrFrom; sa -= sectorSize)
            {
                printLog(string.Format("    0x{0:x8}", sa));

                // switch bank for 01g


                // Sector Erase
                rom_write(0x555, BitConverter.GetBytes((UInt16)0xaa));
                rom_write(0x2aa, BitConverter.GetBytes((UInt16)0x55));
                rom_write(0x555, BitConverter.GetBytes((UInt16)0x80));
                rom_write(0x555, BitConverter.GetBytes((UInt16)0xaa));
                rom_write(0x2aa, BitConverter.GetBytes((UInt16)0x55));
                rom_write((uint)sa, BitConverter.GetBytes((UInt16)0x30));

                showProgress((sa - addrFrom) / sectorSize + 1, (addrTo - addrFrom) / sectorSize + 1);

                byte[] temp = new byte[2];
                do
                {
                    rom_read((uint)(sa << 1), ref temp);
                    Thread.Sleep(20);
                } while (BitConverter.ToUInt16(temp, 0) != 0xffff);
            }
        }


        //////////////////////////////////////
        //////////////////////////////////////
        //////////////////////////////////////

        void mission_readRomID()
        {

            byte[] id = new byte[8];
            rom_readID(ref id);


            printLog(BitConverter.ToString(id).Replace("-", " "));

            if (id.SequenceEqual(new byte[] { 0x01, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22 }))
                printLog("S29GL256");
            else if (id.SequenceEqual(new byte[] { 0x89, 0x00, 0x7e, 0x22, 0x22, 0x22, 0x01, 0x22 }))
                printLog("JS28F256");
            else if (id.SequenceEqual(new byte[] { 0x01, 0x00, 0x7e, 0x22, 0x28, 0x22, 0x01, 0x22 }))
                printLog("S29GL01GS");
            else
                printLog("ID暂未收录，可能无法写入");

            int deviceSize, secotrCount, sectorSize, bufferWriteBytes;
            gba_romGetSize(out secotrCount, out sectorSize, out bufferWriteBytes, out deviceSize);

            printLog(string.Format("容量:{0:d} 扇区数量:{1:d} 扇区大小:{2:d} BuffWr:{3:d}", deviceSize, secotrCount, sectorSize, bufferWriteBytes));

            port.Close();
            enableButton();
        }

        void mission_eraseChip()
        {

            rom_eraseChip();

            //检查结果
            while (true)
            {
                byte[] respon = new byte[2];
                rom_read(0x000000, ref respon);

                printLog(string.Format("..... {0:x4}", BitConverter.ToUInt16(respon, 0)));
                if (BitConverter.ToUInt16(respon, 0) == 0xffff)
                {
                    printLog("擦除完毕");
                    break;
                }
                else
                {
                    Thread.Sleep(1000);
                }
            }

            port.Close();
            enableButton();
        }

        void mission_programRom()
        {
            // 打开文件
            string romFilePath = textBox_romPath.Text;

            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Open, FileAccess.Read);
            }
            catch
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] rom = new byte[fileLength];
            file.Read(rom, 0, fileLength);
            file.Close();

            // 获取rom flash buffer大小
            int deviceSize, secotrCount, sectorSize, bufferWriteBytes;
            gba_romGetSize(out secotrCount, out sectorSize, out bufferWriteBytes, out deviceSize);

            // 自动擦除flash
            byte[] temp = new byte[512];
            rom_read(0x000000, ref temp);
            bool blank = isBlank(temp);
            if (!blank)
            {
                Stopwatch swErase = new Stopwatch();
                swErase.Start();

                gba_romEraseSector(0, fileLength - 1, sectorSize);

                swErase.Stop();
                printLog(string.Format("擦除耗时 {0:f3} s", swErase.ElapsedMilliseconds / 1000.0f));
            }

            printLog("开始写入");

            // 开始发送
            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();

            int writtenCount = 0;
            while (writtenCount < fileLength)
            {
                // 分包
                int sentLen = fileLength - writtenCount;
                sentLen = sentLen > 4096 ? 4096 : sentLen;

                byte[] sendPack = new byte[sentLen];
                Array.Copy(rom, writtenCount, sendPack, 0, sentLen);

                // 写入
                rom_program((UInt32)writtenCount, sendPack, (UInt16)bufferWriteBytes);

                writtenCount += sentLen;
                showProgress(writtenCount, fileLength);
            }
            stopwatch.Stop();

            port.Close();
            enableButton();

            printScore(fileLength, stopwatch.ElapsedMilliseconds);
        }

        void mission_dumpRom()
        {
            int fileLength = (int)(double.Parse(comboBox_romSize.Text) * 1024 * 1024);
            byte[] rom = new byte[fileLength];

            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();

            int readCount = 0;
            while (readCount < fileLength)
            {
                // 分包
                int readLen = fileLength - readCount;
                readLen = readLen > 4096 ? 4096 : readLen;

                // 读取
                byte[] respon = new byte[readLen];
                rom_read((UInt32)readCount, ref respon);


                Array.Copy(respon, 0, rom, readCount, readLen);
                readCount += readLen;
                showProgress(readCount, fileLength);


            }

            stopwatch.Stop();

            // 保存
            string romFilePath = textBox_romPath.Text; // 打开文件
            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Create, FileAccess.Write);
            }
            catch
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                return;
            }

            file.Write(rom, 0, fileLength);
            file.Close();

            port.Close();
            enableButton();

            printScore(fileLength, stopwatch.ElapsedMilliseconds);
        }

        void mission_verifyRom()
        {
            // 打开文件
            string romFilePath = textBox_romPath.Text;

            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Open, FileAccess.Read);
            }
            catch
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] rom = new byte[fileLength];
            file.Read(rom, 0, fileLength);
            file.Close();

            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();

            int readCount = 0;
            while (readCount < fileLength)
            {
                // 分包
                int readLen = fileLength - readCount;
                readLen = readLen > 4096 ? 4096 : readLen;

                // 读取
                byte[] respon = new byte[readLen];
                rom_read((UInt32)readCount, ref respon);

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
                    }
                }
                readCount += readLen;
                showProgress(readCount, fileLength);
            }
            stopwatch.Stop();

            port.Close();
            enableButton();

            printScore(fileLength, stopwatch.ElapsedMilliseconds);
        }

        void mission_wrtieSram()
        {
            // 打开文件
            string savFilePath = textBox_savePath.Text;

            FileStream file;
            try
            {
                file = new FileStream(savFilePath, FileMode.Open, FileAccess.Read);
            }
            catch
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] sav = new byte[fileLength];
            file.Read(sav, 0, fileLength);
            file.Close();

            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();

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

                    ram_read(0x0000, ref respon);

                    printLog(string.Format("..... {0:x2}", respon[0]));
                    if (respon[0] == 0xff)
                    {
                        printLog("擦除完毕");
                        showProgress(0, fileLength);
                        break;
                    }
                    else
                    {
                        Thread.Sleep(1000);
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
                if (comboBox_ramType.Text == "FLASH")
                    ram_flashProgram(baseAddr, sendPack);
                else
                    ram_write(baseAddr, sendPack);


                writtenCount += sentLen;
                showProgress(writtenCount, fileLength);

            }
            stopwatch.Stop();

            port.Close();
            enableButton();

            printScore(fileLength, stopwatch.ElapsedMilliseconds);
        }

        void mission_dumpRam()
        {
            int fileLength = (int)(double.Parse(comboBox_saveSize.Text) * 1024.0);
            byte[] sav = new byte[fileLength];

            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();

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
                ram_read((UInt32)baseAddr, ref respon);

                Array.Copy(respon, 0, sav, readCount, readLen);
                readCount += readLen;
                showProgress(readCount, fileLength);
            }
            stopwatch.Stop();

            // 保存
            string romFilePath = textBox_savePath.Text; // 打开文件
            FileStream file;
            try
            {
                file = new FileStream(romFilePath, FileMode.Create, FileAccess.Write);
            }
            catch
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                return;
            }

            file.Write(sav, 0, fileLength);
            file.Close();

            port.Close();
            enableButton();

            printScore(fileLength, stopwatch.ElapsedMilliseconds);
        }

        void mission_verifyRam()
        {
            // 打开文件
            string savFilePath = textBox_savePath.Text;

            FileStream file;
            try
            {
                file = new FileStream(savFilePath, FileMode.Open, FileAccess.Read);
            }
            catch
            {
                printLog("文件被占用");
                port.Close();
                enableButton();
                return;
            }

            int fileLength = (int)file.Length;

            byte[] sav = new byte[fileLength];
            file.Read(sav, 0, fileLength);
            file.Close();

            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();

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
                ram_read((UInt32)baseAddr, ref respon);

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
                    }
                }
                readCount += readLen;
                showProgress(readCount, fileLength);


            }

            stopwatch.Stop();

            printLog("校验结束");
            port.Close();
            enableButton();

            printScore(fileLength, stopwatch.ElapsedMilliseconds);
        }

    }
}
