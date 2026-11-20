# 致知知识工作台（WeKnora 离线整合版）

主界面与知识库使用 WeKnora Lite，接入已有文章仿写、起草、校对、表格及图片问答工具。0.2 完整版包含模型引擎、文字/视觉模型、中文向量模型、SQLite、中文分词词典、文档解析组件和办公 Python 运行库，首次启动自动植入并连接模型。

当前更新：使用用户提供的蓝底白色「知」字 Logo，同步侧栏、登录页、网页图标、macOS 应用图标和 Windows 程序/安装器图标。离线模型注册后自动为未配置或已失效的「快速问答」绑定本地文字模型，并刷新智能体缓存；已有有效模型选择和其他设置保持不变。

Git 仓库保存源码、图标、许可证与构建脚本，不包含多 GB 模型权重、安装包、开发缓存或用户数据库。构建仍需准备下文列出的 Go/C++ 工具链、模型及原有应用运行库。

## 安装与使用

- Windows 10/11 x64：完整解压 `dist/Zhizhi-WeKnora-Windows-x64-Full.zip`，在解压后的 `Windows-Full` 目录运行 `Zhizhi-WeKnora-Setup-x64.exe`。必须保留安装器旁的 `bundled-models` 文件夹；不要在压缩包内直接运行安装器。安装器包含 WebView2 独立离线安装器和 VC++ 运行库，不需要 Docker、Python 或 Go 开发环境。
- Apple 芯片 Mac，macOS 13.3 及以上：打开 `dist/Zhizhi-WeKnora-macOS-Apple.dmg`，将应用拖到 Applications。此构建使用本地临时签名，未经 Apple 公证。
- 打开应用，等待首次模型校验与初始化完成。应用自动注册 Qwen3-4B-Instruct-2507 文字模型、MiniCPM-V4 视觉模型和 BGE 中文向量模型（512 维），无需配置接口地址或密钥。后续启动复用已有模型，不覆盖用户选定的办公模型。
- 新建知识库时选择已就绪的文字、向量模型，然后上传资料；对话页可直接选择本地文字模型聊天。「离线模型」仍支持手动导入其他 GGUF，视觉模型需配套 mmproj 文件。旧知识库保持绑定原向量模型；更换时请新建知识库并重新入库。
- 「致知办公」进入原有文章仿写以及起草、校对、表格等功能。办公文字功能使用「离线模型」页面选定的模型。

随包权重约 5.7 GB。首次植入会复制到用户数据目录，建议至少预留 20 GB 磁盘空间用于安装包、应用及用户模型副本。内存和处理器影响生成速度，Windows 版目前使用 CPU 推理，Mac 版使用随包 llama.cpp 的本地加速。

BGE 单次向量输入按 511 token 预算处理。应用会使用模型自己的分词器处理截断参数，保留特殊标记，避免长中文段落触发入库错误；知识库保存的原文不受影响。建议保持默认分段，避免把整篇长文设成一个检索片段。

## 数据与能力范围

WeKnora 数据位于 macOS 的 `~/Library/Application Support/致知知识工作台/`，或 Windows 的 `%APPDATA%\致知知识工作台\`。办公模块独立数据位于 macOS 同一目录的 `office/`，或 Windows `%LOCALAPPDATA%\致知知识工作台\office\`。退出应用后可备份这些目录。卸载保留用户目录内的知识库与模型。

新应用不改写原「致知离线工作台」数据库。原有范文与资料可通过导出、导入迁入；办公范文库与 WeKnora 知识库目前仍分别保存。「致知办公」也提供多维分析、致知笔记、记事本、资料查询的原有页面入口。原工具的系统专属动作及目录授权仍受操作系统和 WebView 能力限制，尚未完成跨平台逐项验收。

常用 TXT、Markdown、CSV、JSON 沿用 WeKnora 本地解析。DOCX、XLSX、PPTX 和文字 PDF 使用随包的文本提取组件，可用于知识库检索；不保证保留复杂排版、图表或公式。含扫描页的 PDF 会提示先 OCR，不能把空白结果当作入库成功。旧版 DOC/XLS/PPT 需要先另存为新格式。

图像问答需要兼容的视觉模型；语音转写、联网搜索、在线连接器、云沙箱等不能仅靠文字 GGUF 完成。Lite 不包含标准版的多团队协作能力。为控制内存，本地模型按请求切换，同一时刻运行一个推理进程。此版本未在 Windows 实机执行完整安装和推理验收。

## 构建

### 国产 Linux 适配状态

交付目标为 16 GB 内存、无独立 GPU 的 `amd64`、`arm64`、`loongarch64` 三种架构。三种包复用相同的 Qwen 文字、BGE 向量及 MiniCPM 视觉权重；推理引擎、Python、桌面及数据库运行库须分别构建。Linux 已明确禁用 GPU 卸载，沿用单推理进程调度；知识库、模型和办公数据均写入 `${XDG_CONFIG_HOME:-~/.config}/致知知识工作台/`。16 GB 是目标配置，不代表已在所有 CPU 上验证生成速度或峰值内存。

当前 **尚未生成可交付的 Linux 安装包**。主界面保留 Wails/WeKnora 桌面方案，仍需确定首批统信/麒麟版本与运行库基线并完成实机验收。特别是龙芯：当前 DuckDB Go 依赖没有龙芯预编译库，需额外构建与 Go 绑定匹配的 DuckDB 1.5.2；旧 MIPS 龙芯不属于 `loongarch64`，LoongArch 新旧 ABI 也不能只凭架构名视为兼容。

`linux/check-system.sh` 可在目标电脑离线运行，仅读取系统版本、架构、内存、glibc、ELF 标志与桌面库信息，不联网、不改系统、不要求管理员权限：

```sh
sh linux/check-system.sh
```

已增加三个本机 Linux 构建入口，需在相应架构、目标 ABI 基线的构建环境内执行。构建机须备齐 Go 1.26、C/C++ 编译器、GTK3/WebKitGTK 开发库和 Go 模块；交付电脑不需要开发工具。它们只生成桌面二进制，不会把缺少运行库的目录标成完整离线包：

```sh
python3 build.py linux-amd64
python3 build.py linux-arm64
ZZ_DUCKDB_LIB_DIR=/path/to/duckdb/lib python3 build.py linux-loongarch64
```

Linux ARM64 原生、AMD64 模拟执行的断网容器已通过模型管理与 CPU 参数测试；ARM64 容器还通过办公页面、鉴权、进程退出、用户数据路径和文档解析测试。这不等同于完整桌面、真实模型推理或国产机器验收。amd64/arm64 的 llama.cpp 构建须避免依赖构建机专属指令集；龙芯库须匹配目标 ABI。最终验收应覆盖断网安装、首次模型初始化、资料入库、带引用问答、办公生成、重启及卸载保留数据。

### 已有 Windows / macOS 构建

上游来源：https://github.com/Tencent/WeKnora ，基线提交 `74767642db6e9f9b55a943475c6db28f7601866e`。保留原仓库许可证和第三方说明。

`build.py` 使用 `.build-tools/go` 中的 Go 1.26 和已锁定的 Go 模块；Windows 交叉构建使用 MinGW。前端依赖由 `WeKnora/frontend/package-lock.json` 锁定。

```sh
python3 build.py frontend
python3 build.py mac
python3 build.py windows
python3 package.py mac
python3 package.py dmg
python3 package.py windows
```

`package.py` 从工作区原有应用复用 llama.cpp 和 Python。`office/vendor` 包含 `office/requirements.txt` 锁定的纯 Python 文档依赖及许可证。`bundle_models.py` 整理本地 MiniCPM 主权重、视觉投影和 `.build-tools` 中的 Qwen、BGE 文件，生成 SHA-256 清单；模型卡、来源及许可证同时分发。Windows 使用安装器加外部模型目录组成 ZIP64 完整包，macOS 模型位于应用资源目录。

## 验证记录

- 前端生产构建和 TypeScript 检查通过。
- 离线模型管理单元测试及竞态检查通过；现有 MiniCPM 权重的实际导入与文字推理通过；BGE 中文向量模型的导入、向量生成及维度检测通过。
- 随包模型损坏拒绝、路径校验、取消及重复初始化测试通过；真实视觉模型对测试图片识别出红色。
- 官方 Lite 端到端测试通过：临时数据库内的上传、索引、混合检索、流式问答和会话保存；该测试的模型响应由测试服务提供。
- 0.2 版另使用随包 Qwen、BGE、MiniCPM 进行真实离线端到端测试：图片识别、文章仿写、校对、上传索引、中英文检索、带文档引用的问答、会话保存、知识库复制与资料迁移均通过。问答测试正确从新上传文档中回答出测试代号，并附上实际文档引用。
- BGE 实际长中文输入的向量化及特殊标记保留测试通过，避免将 vLLM 截断参数直接传给 llama.cpp 导致超长输入失败。
- 桌面包相关 Go 测试及办公服务的页面、资源和鉴权测试通过。
- DOCX、XLSX、PPTX、文字 PDF 的解析测试与扫描页拒绝测试通过。
- macOS 包已实际启动并完成默认用户、数据库初始化及前端接口访问。窗口自动操作工具未成功返回，完整界面交互尚未自动验收。
- Windows 原生二进制、NSIS 安装器已构建；安装包完整性检查通过。Windows 实机验收仍待完成。
