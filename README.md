# 致知文章仿写

Windows x64 本地文章仿写应用。导入 DOCX、TXT、Markdown 范文或粘贴正文，输入新主题即可起草。右侧 Tiptap 编辑器支持修改新稿、导出 Word 和 TXT。

## 安装和导入模型

1. 从 [GitHub Releases](https://github.com/notCoolBean/windows/releases/latest) 下载单个 `Zhizhi-Writer-Setup-x64.exe`，双击安装，从桌面或开始菜单打开「致知文章仿写」。
2. 点击「导入模型」，选择本机的单文件 GGUF 语言模型。旧版用户可以直接选择原解压目录的 `models/model.gguf`。新用户可以提前下载 [MiniCPM-V 4 Q4_K_M 模型（2.19 GB）](https://huggingface.co/openbmb/MiniCPM-V-4-gguf/resolve/main/ggml-model-Q4_K_M.gguf?download=true)，也可以从 U 盘导入。
3. 等待显示「已就绪」，再选择范文并输入主题。导入会在当前用户的数据目录保存一份模型，需要与模型文件大小相当的可用磁盘空间。重启后应用会自动识别。导入和仿写均在本机完成。

点击「更换模型」可以选择其他兼容模型。首次切换到新的模型前，应用会先在本机试运行。卸载程序会保留用户的模型和范文。Windows 下模型副本保存在 `%LOCALAPPDATA%\致知离线工作台\writer-models`。

## 开发和打包

应用源码位于 [文章仿写版/源码](文章仿写版/源码)。`writer.py` 提供本机服务，`rag.py` 解析范文，`web/` 包含离线浏览器资源，`editor/` 包含 Tiptap 和 Word 导出的前端源码及依赖锁文件。修改编辑器后可在 `editor/` 执行 `npm ci` 和 `npm run build`。

在已安装 NSIS 3 的 macOS 上构建 Windows 安装包。从已安装的 Windows 应用目录复制 `runtime/` 到仓库的 `致知离线工作台/runtime/`，复制 `python/` 到 `致知离线工作台/应用/办公助手/python/`，再从仓库根目录运行：

```sh
python3 文章仿写版/源码/package.py windows
```

输出文件为 `文章仿写版/Zhizhi-Writer-Setup-x64.exe`。构建仅需要应用和运行库。
