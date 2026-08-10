---
title: Windows 软修改区域及语言教程
description: 本文介绍了如何使用 Locale Emulator 程序在 Windows 系统中软转区以兼容运行日文资源。
banner: https://image.nullcloud.top/user/avatar/user_1/avatar.avif
date: 2026-01-01
userId: 1
---

## 前言

在运行日文资源或者机器翻译资源的时候，可能会遇到这类问题，这是由于这些资源在开发时使用了日语编码 Shift-JIS 与当前系统运行的中文编码 UTF-8 产生了不兼容的问题，就如同中文母语者可能看不懂日语，需要一个翻译官协助翻译

我们强烈不建议您直接修改 Windows 作业系统下的运行编码，这会导致部分 UTF-8 程序出现严重的错误，本方法将使用 Locale Emulator 程序对特定程序进行软转区来实现兼容运行资源

## 使用方法

首先解压下载好的 Locale Emulator 程序压缩包，并将其移动到合适的目录，因为程序安装会直接将程序的存放位置当作安装位置，我们建议您放入 C:\Program Files\Locale.Emulator.2.5.0.1 目录下

![](https://image.nullcloud.top/uploads/posts/locale/20241210105940.avif)

然后双击 LEInstaller(.exe) 来运行安装程序

![](https://image.nullcloud.top/uploads/posts/locale/20241210103549.avif)

随后点击按钮 Install for all users 即可完成安装

在遇到运行出现乱码现象的程序时，只需要 右键 - Locale Emulator - Run in Japanese 即可将程序以日语环境下运行

![](https://image.nullcloud.top/uploads/posts/locale/2024121201821.avif)

## 注意事项
关于 “以此程序配置运行”：通常情况下，您无需手动修改 Locale Emulator 的运行配置，如果发现程序仍然无法运行，请使用 Run in Japanese (Admin) 尝试解决

右键程序没有 Locale Emulator 或提示 “Locale Emulator 启动项丢失”：该程序只能转换 32 位的应用程序，在遇到 64 位程序时右键一般不会显示 Locale Emulator 选项

转区后仍出现乱码：汉化资源在非备注的情况下已对程序进行了编码转换，无需再转区运行，部分机器翻译资源或者汉化组资源可能存在仅窗口工具栏未转译但游戏内容正常的现象，直接无视即可