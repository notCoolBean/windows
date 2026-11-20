#!/bin/sh
set -eu
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/bundled-models
if [ "$(id -u)" = 0 ]; then
    echo '请用安装致知时的登录账户运行，无需 sudo。' >&2
    exit 1
fi
echo '正在检查模型文件完整性…'
(cd "$source_dir" && sha256sum -c SHA256SUMS)
base="$HOME/.local/share/zhizhi"
mkdir -p "$base"
stage=$(mktemp -d "$base/.models-XXXXXX")
trap 'rm -rf "$stage"' EXIT HUP INT TERM
echo '正在复制模型到本机，请勿拔出 U 盘…'
cp -R "$source_dir/." "$stage/"
(cd "$stage" && sha256sum -c SHA256SUMS >/dev/null)
if [ -e "$base/bundled-models" ]; then
    mv "$base/bundled-models" "$base/bundled-models.backup-$(date +%Y%m%d-%H%M%S)"
fi
mv "$stage" "$base/bundled-models"
echo '模型已复制，可以拔出 U 盘。首次打开致知时会自动验证并初始化模型。'
