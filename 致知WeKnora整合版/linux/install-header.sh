#!/bin/sh
# The packaging script appends a gzip tar archive after __PAYLOAD__.
set -eu
if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != aarch64 ]; then
    echo '此安装包仅用于 Linux ARM64，不适用于 Windows 或 macOS。' >&2
    exit 1
fi
if [ "$(id -u)" = 0 ]; then
    echo '请用日常登录账户安装，无需 sudo 或 root。' >&2
    exit 1
fi
getconf GNU_LIBC_VERSION | awk '{split($2,v,"."); exit !(v[1]>2 || (v[1]==2 && v[2]>=31))}' || {
    echo '需要 glibc 2.31 或更新版本；本安装包不会替换系统基础库。' >&2
    exit 1
}
base="$HOME/.local/share/zhizhi"
mkdir -p "$base" "$HOME/.local/share/applications"
stage=$(mktemp -d "$base/.install-XXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
line=$(awk '/^__PAYLOAD__$/ {print NR+1; exit}' "$0")
echo '正在解压致知程序与离线运行环境…'
tail -n +"$line" "$0" | tar -xz -C "$stage"
(cd "$stage" && sha256sum -c SHA256SUMS >/dev/null)
if [ -e "$base/program" ]; then
    mv "$base/program" "$base/program.backup-$(date +%Y%m%d-%H%M%S)"
fi
mv "$stage" "$base/program"
ln -s ../bundled-models "$base/program/bundled-models"
"$base/program/libexec/gdk-pixbuf-query-loaders" "$base/program"/lib/gdk-pixbuf-2.0/2.10.0/loaders/*.so > "$base/program/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"
cat > "$HOME/.local/share/applications/zhizhi.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=致知知识工作台
Comment=本地知识问答与文章仿写
Exec="$base/program/launch.sh"
Icon=$base/program/zhizhi.png
Terminal=false
Categories=Office;
StartupNotify=true
EOF
echo '安装完成。模型文件与程序分开保存。'
echo '请解压模型包，运行其中的「导入模型.sh」，然后从应用菜单打开「致知知识工作台」。'
echo '升级会保留旧程序备份，以及知识库、模型与办公资料。'
exit 0
__PAYLOAD__
