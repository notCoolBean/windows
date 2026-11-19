# 致知文章仿写

Windows x64 离线文章仿写应用。选择 Word（DOCX）、TXT 或 Markdown 范文，或粘贴正文，输入新主题即可起草。生成后可以在右侧 Tiptap 编辑器中修改，并导出 Word 或 TXT。

## 下载和安装

从 [最新 Release](https://github.com/notCoolBean/windows/releases/latest) 下载 Windows 离线包。将 ZIP 完整解压到固定目录，双击 `Install.cmd`，以后可从桌面的「致知文章仿写」启动。包内包含本地模型、Python、推理程序和编辑器。安装及使用均可离线进行。

## 开发

应用代码位于 [文章仿写版/源码](文章仿写版/源码)。`writer.py` 启动本机服务，`rag.py` 处理参考文章，`web/` 包含实际提供给浏览器的资源，`editor/` 包含富文本编辑和 Word 导出的前端源码与锁文件。

在 Windows 上调试时，可先解压 Release，将 `writer.py`、`rag.py` 及整个 `web/` 复制到该解压目录，双击 `Start.cmd`。修改编辑器依赖或源码后，在 `editor/` 执行 `npm ci` 和 `npm run build`，然后同步更新的 `web/`。构建工具只用于开发。

原打包脚本 `package.py` 在 macOS 上组装 Windows 包。从 Release 解压目录将 `models/`、`runtime/` 放入仓库根目录的 `致知离线工作台/`，将 `python/` 放入 `致知离线工作台/应用/办公助手/python/`，然后在仓库根目录运行：

```sh
python3 文章仿写版/源码/package.py windows
```

构建脚本会校验模型与 ZIP 内各文件。模型、推理组件和编辑器依赖的许可证随离线包提供。
