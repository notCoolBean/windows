#!/bin/bash
# ============================================================
# 多维分析 · 系统截图（冻结画面 → 拖动框选 → 双击/回车确认）
# ------------------------------------------------------------
# 两种调用方式：
#   1) 本地服务（127.0.0.1:8737）：截图.sh --print
#      截图完成后把 PNG 以 base64 单行打印（前缀 DAIMG:），页面据此直接插图；
#      若拿不到图片文件，则打印 DAIMG:CLIPBOARD，页面改为读取系统剪贴板。
#   2) zzoffice:// 协议：截图.sh
#      仅调起系统截图工具（结果进入系统剪贴板），页面回到窗口时自动读入。
#
# 优先选择“能冻结画面 + 框选”的工具（麒麟/UKUI/Deepin/Flameshot），
# 找不到时再退回只框选不冻结的工具（gnome/xfce/mate/scrot）。
# ============================================================
set +e +u

PRINT=0
[ "${1:-}" = "--print" ] && PRINT=1

have() { command -v "$1" >/dev/null 2>&1; }

WORK="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/da-shot-$$")"
mkdir -p "$WORK" 2>/dev/null
IMG="$WORK/截图.png"

newest_png() { ls -t "$WORK"/*.png 2>/dev/null | head -n 1; }

# 把文件放入系统剪贴板（供页面读入）
to_clipboard() {
  [ -s "$1" ] || return 1
  if have wl-copy; then wl-copy --type image/png <"$1" >/dev/null 2>&1 && return 0; fi
  if have xclip;   then xclip -selection clipboard -t image/png -i "$1" >/dev/null 2>&1 && return 0; fi
  return 1
}

# 读取系统剪贴板里的 PNG 到 $1
from_clipboard() {
  rm -f "$1"
  if have wl-paste; then wl-paste --type image/png >"$1" 2>/dev/null && [ -s "$1" ] && return 0; fi
  if have xclip;    then xclip -selection clipboard -t image/png -o >"$1" 2>/dev/null && [ -s "$1" ] && return 0; fi
  if have python3; then
    python3 - "$1" <<'PYEOF' >/dev/null 2>&1
import sys
try:
    import gi
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk, Gdk
    img = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD).wait_for_image()
    if img is not None:
        img.savev(sys.argv[1], 'png', [], [])
except Exception:
    pass
PYEOF
    [ -s "$1" ] && return 0
  fi
  return 1
}

finish() {
  if [ "$PRINT" = "1" ]; then
    if [ -n "${1:-}" ] && [ -s "$1" ]; then
      printf 'DAIMG:'
      base64 -w0 "$1" 2>/dev/null || base64 "$1" 2>/dev/null | tr -d '\n'
      printf '\n'
    else
      echo 'DAIMG:CLIPBOARD'
    fi
  fi
  exit 0
}

# $1 = 图片文件（可能为空）：有文件先拷入剪贴板；--print 模式再回传 base64
shot() {
  local f="${1:-}"
  [ -n "$f" ] && to_clipboard "$f"
  if [ "$PRINT" = "1" ]; then
    if [ -n "$f" ] && [ -s "$f" ]; then finish "$f"; fi
    from_clipboard "$IMG" || true
    finish "$IMG"
  fi
  exit 0
}

# ---------- 一、冻结 + 框选，结果进剪贴板（麒麟 / UKUI / Deepin） ----------
if have kylin-screenshot;      then kylin-screenshot      >/dev/null 2>&1; shot "$(newest_png)"; fi
if have ukui-screenshot;       then ukui-screenshot       >/dev/null 2>&1; shot "$(newest_png)"; fi
if have kylin-screenshot-tool; then kylin-screenshot-tool >/dev/null 2>&1; shot "$(newest_png)"; fi
if have deepin-screenshot;     then deepin-screenshot     >/dev/null 2>&1; shot "$(newest_png)"; fi

# ---------- 二、冻结 + 框选，结果输出到文件 ----------
if have flameshot; then flameshot gui --path "$WORK" >/dev/null 2>&1; shot "$(newest_png)"; fi
if have spectacle; then spectacle --region --background --nonotify --output "$IMG" >/dev/null 2>&1; shot "$IMG"; fi

# ---------- 三、仅框选（不冻结），结果输出到文件 ----------
if have gnome-screenshot;     then gnome-screenshot -a -f "$IMG" >/dev/null 2>&1; shot "$IMG"; fi
if have mate-screenshot;      then mate-screenshot -a -f "$IMG" >/dev/null 2>&1; shot "$IMG"; fi
if have xfce4-screenshooter;  then xfce4-screenshooter -r -s "$IMG" >/dev/null 2>&1; shot "$IMG"; fi
if have scrot;                then scrot -s "$IMG" >/dev/null 2>&1; shot "$IMG"; fi

echo '未找到可用的系统截图工具（kylin-screenshot / ukui-screenshot / deepin-screenshot / flameshot / scrot 等）' >&2
if [ "$PRINT" = "1" ]; then echo 'DAIMG:CLIPBOARD'; exit 0; fi
exit 1
