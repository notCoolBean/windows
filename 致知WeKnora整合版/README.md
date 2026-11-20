# 致知知识工作台（WeKnora 离线整合版）

主界面与知识库使用 WeKnora Lite，接入已有文章仿写、起草、校对、表格及图片问答工具。本次雷神 Windows / 联想麒麟交付统一采用 MiniCPM-V 4.7 1B Instruct Q4_K_M，文字与视觉共用一份主权重，配套 F16 视觉组件。知识库采用本地关键词检索，不再依赖向量模型。新模型包不包含 BGE、Qwen 或旧版 MiniCPM。程序与模型分别分发，包含离线引擎、SQLite、中文分词、文档解析和 Python 运行库。

当前更新：使用去除外圈黑色背景的透明 PNG「知」字 Logo，主色为与 Logo 匹配的蓝色 `#0B52D2`，同步侧栏、登录页、办公页、网页图标、macOS 应用图标和 Windows 程序/安装器图标。界面、欢迎语、助手名称、默认提示词和桌面菜单统一使用「致知」。原始接口标识、用户数据目录及开源版权署名保留，以维持兼容性。离线模型注册后自动为未配置或已失效的「快速问答」绑定本地文字模型，并刷新智能体缓存；已有有效模型选择和其他设置保持不变。

Git 仓库保存源码、图标、许可证与构建脚本，不包含多 GB 模型权重、安装包、开发缓存或用户数据库。构建仍需准备下文列出的 Go/C++ 工具链、模型及原有应用运行库。

## 安装与使用

- 雷神 Windows 11 x64：打开 `dist/雷神-Windows11-x64-MiniCPM-V4.7-1B/`，先将独立模型 ZIP 解压到该目录，确保 `bundled-models` 与 `.exe` 安装器同级，再运行安装器。包含 WebView2 和 VC++ 离线运行库；本次仍使用 CPU 推理，尚未加入 RTX 4090 的 CUDA 加速。
- 联想麒麟 V10 ARM64（飞腾 D2000/8、约 8 GB 内存）：打开 `dist/联想-麒麟V10-ARM64-MiniCPM-V4.7-1B/`，以普通账户运行 `sh 致知-麒麟V10-ARM64-安装.run`，解压独立模型 ZIP 后运行其中的 `sh 导入模型.sh`。要求 glibc ≥ 2.31、X11 桌面或 XWayland，不需要联网、sudo、Docker 或开发工具。目标麒麟国防版的基础库版本和实机表现仍待核对。
- 两个版本的模型 ZIP 内容相同，包含约 672 MB 主权重、1.11 GB 视觉组件，总计约 1.78 GB。首次打开自动注册文字、视觉两个用途；文字和视觉在磁盘上共用主权重。
- 本次未重打 macOS 包。此前 Apple 芯片 Mac 的 DMG 仍为旧模型组合，macOS 13.3 起可用，采用本地临时签名，未经 Apple 公证。
- 新安装自动选择 MiniCPM-V 4.7 1B 为办公文字模型。升级保留用户目录中的历史模型、既有模型选择及知识库绑定，不自动清空用户资料；升级后可在「离线模型」页选择新文字模型。新模型包的精简不等于删除已经导入的历史权重。
- 新建知识库默认启用关键词检索，只需选择已就绪的文字模型，再上传资料；对话页可直接选择本地文字模型聊天。「离线模型」仍支持手动导入其他 GGUF，视觉模型需配套 mmproj 文件。旧知识库保留原索引策略；迁入纯关键词方案时请新建关键词知识库并重新入库。
- 侧边栏「文章仿写」可直接输入或粘贴范文，也可上传 DOCX、TXT、Markdown 文件（最大 8 MB），填写新文章主题与要求后，使用本地模型分析风格并生成新稿。生成后可编辑、复制或导出 Word/TXT。
- 「致知办公」进入起草、校对、表格等功能，也保留原有仿写入口。办公文字功能使用「离线模型」页面选定的模型。

本次双机模型包约 1.78 GB。首次植入会复制到用户数据目录，建议至少预留 12 GB 磁盘空间。Windows / 麒麟版使用 CPU 推理，内存和处理器影响生成速度；未以本机测试结果替代目标电脑的速度验收。

关键词检索通过本地 SQLite FTS5 对文档分段及中文双字词组建立索引，不调用向量模型。建议在问题中使用资料里的名称、术语或编号；不提供向量语义召回，同义改写可能无法命中。

## 数据与能力范围

WeKnora 数据位于 macOS 的 `~/Library/Application Support/致知知识工作台/`，或 Windows 的 `%APPDATA%\致知知识工作台\`。办公模块独立数据位于 macOS 同一目录的 `office/`，或 Windows `%LOCALAPPDATA%\致知知识工作台\office\`。退出应用后可备份这些目录。卸载保留用户目录内的知识库与模型。

新应用不改写原「致知离线工作台」数据库。原有范文与资料可通过导出、导入迁入；办公范文库与 WeKnora 知识库目前仍分别保存。「致知办公」也提供多维分析、致知笔记、记事本、资料查询的原有页面入口。原工具的系统专属动作及目录授权仍受操作系统和 WebView 能力限制，尚未完成跨平台逐项验收。

常用 TXT、Markdown、CSV、JSON 沿用 WeKnora 本地解析。DOCX、XLSX、PPTX 和文字 PDF 使用随包的文本提取组件，可用于知识库检索；不保证保留复杂排版、图表或公式。含扫描页的 PDF 会提示先 OCR，不能把空白结果当作入库成功。旧版 DOC/XLS/PPT 需要先另存为新格式。

图像问答需要兼容的视觉模型；语音转写、联网搜索、在线连接器、云沙箱等不能仅靠文字 GGUF 完成。Lite 不包含标准版的多团队协作能力。为控制内存，本地模型按请求切换，同一时刻运行一个推理进程。此版本未在 Windows 实机执行完整安装和推理验收。

## 构建

### 国产 Linux 适配状态

交付目标为 16 GB 内存、无独立 GPU 的 `amd64`、`arm64`、`loongarch64` 三种架构。模型权重可以跨架构复用；推理引擎、Python、桌面及数据库运行库须分别构建。Linux 已明确禁用 GPU 卸载，沿用单推理进程调度；知识库、模型和办公数据均写入 `${XDG_CONFIG_HOME:-~/.config}/致知知识工作台/`。16 GB 是目标配置，不代表已在所有 CPU 上验证生成速度或峰值内存。

已生成 **麒麟 V10 ARM64 待实机验收包**，依据首台飞腾 D2000/8、实际约 8 GB 内存的配置单，采用 CPU、6 线程、文字上下文 4096、单推理进程。MiniCPM-V 4.7 1B 主权重及视觉组件单独分发，程序更新不需重新传送权重。安装到 `~/.local/share/zhizhi/program`，模型导入目录为 `~/.local/share/zhizhi/bundled-models`；知识库与运行时模型仍在上述用户配置目录。建议预留至少 12 GB 空间，首次初始化会另存模型副本。安装器保留上个程序版本及用户资料。

ARM64 包在 Ubuntu 20.04 / glibc 2.31 基线原生构建，私有打包 GTK3、WebKitGTK 2.38.6、C++ 运行库、Python 3.11.18 和通用 ARMv8-A llama.cpp，不安装或替换目标电脑系统库。旧 WebKit 的自定义 URI 不支持读取 POST 请求体，因此仅对构建副本中的 Wails 2.12.0 增加本机回环 HTTP 适配，保留原生调用来源校验，并拒绝其他 Host/Origin；界面端口按用户保存以维持本地存储。WebKit 的两个辅助进程路径改为包内路径，随包提供对应源码与修改脚本。

`linux/build-arm64-runtime.sh` 在专用 ARM64 构建环境编译，`linux/package-arm64.py` 生成程序安装器，`linux/package-models.py` 生成分离模型包。下载的工具链、Python、llama.cpp 和 C++ 运行库校验值已固定在脚本中。程序包不含 GGUF 权重。ARM64 二进制依赖检查、普通账户安装及纯 MiniCPM-V 模型导入已在隔离容器通过。本次在断网 ARM64 环境完成 MiniCPM-V 4.7 1B 真实图片识别、文章仿写、校对、关键词入库与中英文检索、带文档引用的问答、会话保存、知识库复制、资料迁移与删除、FAQ 新建和编辑检索测试；未安装任何向量模型。这不代表已经在飞腾或麒麟国防版实机验收。

AMD64 和 LoongArch64 的完整 Linux 包尚未生成。特别是龙芯：当前 DuckDB Go 依赖没有龙芯预编译库，需额外构建与 Go 绑定匹配的 DuckDB 1.5.2；旧 MIPS 龙芯不属于 `loongarch64`，LoongArch 新旧 ABI 也不能只凭架构名视为兼容。

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

Linux ARM64 原生、AMD64 模拟执行的断网容器已通过模型管理与 CPU 参数测试；ARM64 容器还通过办公页面、鉴权、进程退出、用户数据路径和文档解析测试。国产机器最终验收应覆盖断网安装、首次模型初始化、资料入库、带引用问答、办公生成、重启及卸载保留数据。

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

`package.py` 从工作区原有应用复用 llama.cpp 和 Python。`office/vendor` 包含 `office/requirements.txt` 锁定的纯 Python 文档依赖及许可证。`bundle_models.py` 校验并整理固定版本的 MiniCPM-V 4.7 1B 主权重及视觉投影，生成 SHA-256 清单；模型卡、来源及许可证同时分发。MiniCPM 的固定提交、文件名、大小和 SHA-256 见 `model-assets/minicpm47/source.json`；下载的两个 GGUF 放到 `.build-tools/minicpm47/`。官方根目录 GGUF 预先关闭思考模式，应用也按固定模型校验值显式设置 `--reasoning off`，使用指令模式。本次使用 `python3 package.py windows-program` 只生成 Windows 程序安装器，`python3 linux/package-models.py` 将共享外部模型 ZIP 放入两个交付目录。Windows 安装时先解压模型到安装器旁边；麒麟通过导入脚本复制模型。macOS 历史版本的模型仍位于应用资源目录。

## 验证记录

- 本次 MiniCPM-V 4.7 1B 交付：原生麒麟桌面已验证自动注册两个模型用途、新建知识库默认关键词检索且不要求向量模型；前端生产构建、TypeScript 检查、关键词索引回归和检索引擎测试通过；真实模型端到端流程在断网 ARM64 Linux 通过。模型 ZIP 仅含主权重和视觉组件，逐文件官方 SHA-256、ZIP 完整性及两个平台模型包一致性均校验。以下 0.2 版旧模型记录属于历史验证，不表示本次仍包含这些模型。

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
