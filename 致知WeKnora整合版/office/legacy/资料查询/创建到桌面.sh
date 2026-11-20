#!/bin/bash
# 资料查询 - 银河麒麟 Linux 一键创建桌面快捷方式
# 兼容银河麒麟 V4 / V10（含 UKUI / Peony / 中标麒麟等桌面）
# 功能：修复权限 + 在桌面创建快捷方式「资料查询」（用浏览器打开 HTML）+ 标记为可信
# 用法：右键此文件选“运行”，或终端执行：bash 创建到桌面.sh
# 说明：从 Windows/U盘 复制过来的文件会丢失可执行权限，本脚本会自动修复
#
# 兼容性要点（V4/V10 双兼容）：
#   - 不启用 `set -u`，避免旧内核/旧 Bash 下因未定义变量直接静默退出
#   - 任何一步失败都会用弹窗（zenity/kdialog/xmessage）或终端提示，绝不静默
#   - 桌面图标优先用同名 PNG（老桌面环境对 .ico 支持不佳），无 PNG 时用 ICO
#   - GUI 环境双击运行时，结束时弹窗告知，避免无终端时看似无反应

# ======================= 通用基础保障 =======================
set +e +u

APP_NAME="资料查询"
HTML_NAME="查询工具.html"
ICON_REL="logo/查询资料.ico"

# ===== 定位脚本目录 =====
SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
if [ -z "${SCRIPT_DIR}" ]; then
  SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
fi
cd "${SCRIPT_DIR}" 2>/dev/null || true
SELF_NAME="$(basename "$0")"

# ======================= GUI 反馈工具（V4/V10 通用） =======================
# 目的：图形桌面下双击运行时，若出现错误也能看到提示（旧桌面常常不弹出终端）
UI_TOOL=""
if command -v zenity >/dev/null 2>&1; then
  UI_TOOL="zenity"
elif command -v kdialog >/dev/null 2>&1; then
  UI_TOOL="kdialog"
elif command -v xmessage >/dev/null 2>&1; then
  UI_TOOL="xmessage"
fi

gui_info() {  # gui_info <标题> <正文>
  local title="$1" body="$2"
  case "${UI_TOOL}" in
    zenity)   zenity --info --width=460 --title="${title}" --text="${body}" >/dev/null 2>&1 ;;
    kdialog)  kdialog --title "${title}" --msgbox "${body}" >/dev/null 2>&1 ;;
    xmessage) xmessage -center "${title}

${body}" >/dev/null 2>&1 ;;
    *) : ;;
  esac
}

# 出错处理：打印 + 弹窗 + 退出（GUI 下不阻塞太久）
die() {
  local msg="$1"
  echo ""
  echo "错误：${msg}"
  echo ""
  gui_info "${APP_NAME} - 创建失败" "${msg}
 
请把以上信息截图反馈，或在终端执行：bash \"${SCRIPT_DIR}/${SELF_NAME}\" 查看详情。"
  exit 1
}

# 结束前暂停：有终端且交互时等待回车；否则给 GUI 一个短暂停留
finish_pause() {
  if [ -t 0 ]; then
    read -p "按回车键退出..." _
  else
    sleep 1
  fi
}

echo "=============================="
echo "  ${APP_NAME} - 创建到桌面"
echo "=============================="
echo ""

HTML_FILE="${SCRIPT_DIR}/${HTML_NAME}"
ICON_PATH="${SCRIPT_DIR}/${ICON_REL}"

# ===== 第1步：检查主文件与图标 =====
echo "[1/5] 检查文件..."
if [ ! -f "${HTML_FILE}" ]; then
  die "未找到主文件 ${HTML_NAME}
请确认本脚本与 ${HTML_NAME} 放在同一目录下。
当前目录：${SCRIPT_DIR}"
fi
echo "  主文件：${HTML_FILE}"

# 图标优先同名 PNG（老桌面更稳），其次 ICO
case "${ICON_PATH}" in
  *.ico)
    PNG_SIBLING="${ICON_PATH%.ico}.png"
    [ -f "${PNG_SIBLING}" ] && ICON_PATH="${PNG_SIBLING}"
    ;;
esac
if [ ! -f "${ICON_PATH}" ]; then
  echo "  警告：未找到图标 ${ICON_REL}，将使用默认图标"
  ICON_PATH=""
fi
[ -n "${ICON_PATH}" ] && echo "  图标：${ICON_PATH}"
echo ""

# ===== 第2步：修复权限 =====
echo "[2/5] 修复可执行权限..."
chmod +x "${SCRIPT_DIR}"/*.sh 2>/dev/null
find "${SCRIPT_DIR}" -type f -exec chmod +r {} \; 2>/dev/null
echo "  完成"
echo ""

# ===== 第3步：检测浏览器 =====
echo "[3/5] 检测浏览器..."
BROWSER_BIN=""
# 资料查询依赖 File System Access API，优先选 Chrome/Edge 系内核浏览器
for b in google-chrome google-chrome-stable chromium chromium-browser \
         microsoft-edge microsoft-edge-stable \
         qaxbrowser qianxin-browser qianxinbrowser qianxinxinchuang \
         360browser peony-qt-browser ukylin-browser kylin-browser \
         firefox firefox-esr \
         xdg-open; do
  if command -v "$b" >/dev/null 2>&1; then
    BROWSER_BIN="$b"
    echo "  使用：$b"
    break
  fi
done

if [ -z "${BROWSER_BIN}" ]; then
  echo "  警告：未检测到浏览器，默认使用 xdg-open"
  BROWSER_BIN="xdg-open"
fi

# Chromium 内核浏览器加 --allow-file-access-from-files，保证 file:// 相对资源可用
BROWSER_ARGS=""
case "${BROWSER_BIN}" in
  *chrome*|*chromium*|*edge*|*qax*|*qianxin*|*360*)
    BROWSER_ARGS="--allow-file-access-from-files" ;;
esac
echo ""

# ===== 第4步：生成 .desktop 快捷方式 =====
echo "[4/5] 创建桌面快捷方式..."
TMP_DESKTOP="$(mktemp)"
if [ -z "${TMP_DESKTOP}" ] || [ ! -f "${TMP_DESKTOP}" ]; then
  TMP_DESKTOP="${SCRIPT_DIR}/.${APP_NAME}.desktop.tmp"
fi

# 先切换到脚本所在目录，保证页面 资料/、索引/ 等相对路径正常；路径含中文故加引号
EXEC_CMD="bash -c 'cd \"${SCRIPT_DIR}\" && exec ${BROWSER_BIN} ${BROWSER_ARGS} \"${HTML_FILE}\"'"

{
  echo "[Desktop Entry]"
  echo "Type=Application"
  echo "Name=${APP_NAME}"
  echo "Name[zh_CN]=${APP_NAME}"
  echo "Comment=${APP_NAME}（浏览器打开）"
  echo "Exec=${EXEC_CMD}"
  echo "Path=${SCRIPT_DIR}"
  [ -n "${ICON_PATH}" ] && echo "Icon=${ICON_PATH}"
  echo "Categories=Office;Utility;"
  echo "Terminal=false"
  echo "StartupNotify=true"
} > "${TMP_DESKTOP}"

chmod +x "${TMP_DESKTOP}" 2>/dev/null

# ===== 定位桌面目录 =====
USER_HOME="${HOME:-/root}"
DESKTOP_DIR=""
for d in \
  "${USER_HOME}/桌面" \
  "${USER_HOME}/Desktop" \
  "${XDG_DESKTOP_DIR:-}" \
  "/root/桌面" \
  "/root/Desktop"; do
  if [ -n "$d" ] && [ -d "$d" ]; then DESKTOP_DIR="$d"; break; fi
done

if [ -z "${DESKTOP_DIR}" ]; then
  echo "  未找到桌面目录，创建 ${USER_HOME}/桌面"
  mkdir -p "${USER_HOME}/桌面" 2>/dev/null
  DESKTOP_DIR="${USER_HOME}/桌面"
fi

DESKTOP_FILE="${DESKTOP_DIR}/${APP_NAME}.desktop"
cp -f "${TMP_DESKTOP}" "${DESKTOP_FILE}" 2>/dev/null \
  || die "无法写入桌面文件：${DESKTOP_FILE}"
chmod +x "${DESKTOP_FILE}" 2>/dev/null
rm -f "${TMP_DESKTOP}" 2>/dev/null
echo "  快捷方式：${DESKTOP_FILE}"
echo ""

# ===== 第5步：标记为可信（UKUI/麒麟桌面必须，否则双击无反应）=====
echo "[5/5] 标记为可信程序..."
TRUSTED_OK=""
if command -v gio >/dev/null 2>&1; then
  gio set "${DESKTOP_FILE}" metadata::trusted true 2>/dev/null && TRUSTED_OK="1"
  gio set -t string "${DESKTOP_FILE}" metadata::trusted true 2>/dev/null && TRUSTED_OK="1"
fi
if [ -n "${TRUSTED_OK}" ]; then
  echo "  gio trusted 已设置"
else
  echo "  gio 不可用，跳过（将尝试其它方式标记）"
fi

# 备用：确保桌面显示图标
gsettings set org.gnome.desktop.background show-desktop-icons true 2>/dev/null || true
gsettings set org.ukui.peony.settings show-computer-icon true 2>/dev/null || true

# 同步到开始菜单（失败不影响）
APPS_DIR="${USER_HOME}/.local/share/applications"
mkdir -p "${APPS_DIR}" 2>/dev/null
cp -f "${DESKTOP_FILE}" "${APPS_DIR}/${APP_NAME}.desktop" 2>/dev/null \
  && echo "  已加入开始菜单"

echo ""
echo "=============================="
echo "  创建完成！"
echo "=============================="
echo ""
echo "  现在请到桌面双击「${APP_NAME}」图标运行"
echo ""
echo "  ★ 如果桌面图标双击无反应："
echo "    1. 右键图标 -> 属性 -> 权限 -> 允许作为程序执行"
echo "    2. 或右键 -> “允许启动” / “标记为可信”"
echo "    3. 或直接在终端执行：bash \"${SCRIPT_DIR}/${SELF_NAME}\""
echo ""
echo "  卸载：删除桌面上的 ${APP_NAME}.desktop 即可"
echo ""

# 图形桌面下弹窗告知，避免双击后“看似无反应”
gui_info "${APP_NAME} 创建完成" "已在桌面创建快捷方式：
${DESKTOP_FILE}

请到桌面双击「${APP_NAME}」图标运行。
若双击无反应：右键图标 -> 允许启动 / 标记为可信。"

finish_pause
