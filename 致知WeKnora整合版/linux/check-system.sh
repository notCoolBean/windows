#!/bin/sh
# Read-only, offline inspection of the target OS and ABI. No administrator needed.
set -eu
if [ "$(uname -s)" != Linux ]; then
    echo '请在目标统信或麒麟电脑上运行。' >&2
    exit 2
fi
machine=$(uname -m)
case "$machine" in
    x86_64) package_arch=amd64 ;;
    aarch64) package_arch=arm64 ;;
    loongarch64) package_arch=loongarch64 ;;
    mips*) echo '此电脑为 MIPS 龙芯，不能安装 loongarch64 包。' >&2; exit 2 ;;
    *) echo "暂未支持的架构：$machine" >&2; exit 2 ;;
esac
printf '包架构：%s\n内核：%s\n' "$package_arch" "$(uname -r)"
if [ -r /etc/os-release ]; then
    sed -n '/^PRETTY_NAME=/p; /^ID=/p; /^VERSION_ID=/p' /etc/os-release
fi
if command -v getconf >/dev/null 2>&1; then
    getconf GNU_LIBC_VERSION 2>/dev/null || true
    printf '内存页大小：'
    getconf PAGE_SIZE 2>/dev/null || true
fi
if [ -r /proc/meminfo ]; then
    awk '/^MemTotal:/ {printf "总内存：%.2f GiB\n", $2/1048576}
         /^MemAvailable:/ {printf "当前可用内存：%.2f GiB\n", $2/1048576}' /proc/meminfo
fi
if command -v readelf >/dev/null 2>&1; then
    LC_ALL=C readelf -h /bin/sh | sed -n '/Machine:/p; /Flags:/p'
fi
if command -v ldconfig >/dev/null 2>&1; then
    ldconfig -p 2>/dev/null | awk '/libgtk-3\.so|libwebkit2gtk-4\.[01]\.so/ {print $1}' | sort -u
fi
echo '以上仅为环境信息；不代表已通过本应用的安装和推理验收。'
