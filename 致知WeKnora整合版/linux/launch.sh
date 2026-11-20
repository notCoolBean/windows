#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$(uname -m)" != aarch64 ]; then
    echo '此版本仅用于 ARM64 飞腾/鲲鹏电脑。' >&2
    exit 1
fi
getconf GNU_LIBC_VERSION | awk '{split($2,v,"."); exit !(v[1]>2 || (v[1]==2 && v[2]>=31))}' || {
    echo '此构建需要 glibc 2.31 或更高版本，请提供本机环境检查结果。' >&2
    exit 1
}
export ZZ_OFFLINE_LOW_MEMORY=1
export ZZ_WAILS_LOCAL_HTTP=1
export WEBKIT_EXEC_PATH="$root/libexec/webkit2gtk-4.0"
export WEBKIT_INJECTED_BUNDLE_PATH="$root/libexec/webkit2gtk-4.0/injected-bundle"
export GSETTINGS_SCHEMA_DIR="$root/share/glib-2.0/schemas"
export XDG_DATA_DIRS="$root/share:${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
export GIO_EXTRA_MODULES="$root/lib/gio/modules"
export GDK_PIXBUF_MODULEDIR="$root/lib/gdk-pixbuf-2.0/2.10.0/loaders"
export GDK_PIXBUF_MODULE_FILE="$root/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"
cd "$root"
exec "$root/Zhizhi" "$@"
