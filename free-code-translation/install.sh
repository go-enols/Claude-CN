#!/usr/bin/env bash
set -euo pipefail

# free-code installer
# Installs Bun if needed, clones the repo, builds with all experimental features,
# and symlinks free-code on your PATH.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- OS detection ---
OS="$(uname -s)"
case "$OS" in
  Darwin*) OS="macOS" ;;
  Linux*)  OS="Linux" ;;
  *)
    error "不支持的操作系统：$OS"
    error "free-code 仅支持 macOS 和 Linux（Windows 请使用 WSL）。"
    exit 1
    ;;
esac

info "检测到操作系统：$OS"

# --- Architecture detection ---
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    error "不支持的架构：$ARCH"
    exit 1
    ;;
esac

info "检测到架构：$ARCH"

# --- Check for prerequisites ---
check_command() {
  command -v "$1" >/dev/null 2>&1
}

# --- Install Bun if not present ---
if ! check_command bun; then
  info "Bun 未安装，正在安装 Bun..."
  curl -fsSL https://bun.sh/install | bash

  # Add Bun to PATH for the current script
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! check_command bun; then
    error "Bun 安装失败，请手动安装：https://bun.sh"
    exit 1
  fi

  success "Bun 安装成功（$(bun --version)）"
else
  info "Bun 已安装（$(bun --version)）"
fi

# --- Clone or update the repository ---
INSTALL_DIR="${FREE_CODE_INSTALL_DIR:-$HOME/.free-code}"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "仓库已存在于 $INSTALL_DIR，正在更新..."
  cd "$INSTALL_DIR"
  git pull origin main
else
  info "正在将 free-code 仓库克隆到 $INSTALL_DIR..."
  git clone https://github.com/paoloanzn/free-code.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# --- Install dependencies ---
info "正在安装依赖..."
bun install

# --- Build with all experimental features ---
info "正在构建（启用所有实验性功能）..."
bun run build:dev:full

# --- Symlink the binary ---
LINK_NAME="free-code"
LINK_PATH="/usr/local/bin/$LINK_NAME"

# Try to create symlink
if [ -w /usr/local/bin ]; then
  ln -sf "$INSTALL_DIR/cli-dev" "$LINK_PATH"
  success "已创建符号链接：$LINK_PATH -> $INSTALL_DIR/cli-dev"
else
  warn "没有 sudo 权限无法写入 /usr/local/bin。"
  info "使用 sudo 创建符号链接..."
  sudo ln -sf "$INSTALL_DIR/cli-dev" "$LINK_PATH"
  success "已创建符号链接：$LINK_PATH -> $INSTALL_DIR/cli-dev"
fi

# --- Verify installation ---
if check_command "$LINK_NAME"; then
  success "free-code 已添加到您的 PATH 中！"
  info "运行 '$LINK_NAME' 启动交互式 REPL。"
  info "运行 '$LINK_NAME /login' 使用您的 API 提供商进行身份验证。"
else
  warn "符号链接已创建，但 '$LINK_NAME' 不在您的 PATH 中。"
  info "您可能需要重启终端或将 /usr/local/bin 添加到 PATH 中。"
fi

echo ""
success "安装完成！"
info "  快速开始：$LINK_NAME"
info "  登录：      $LINK_NAME /login"
info "  帮助：       $LINK_NAME --help"
info ""
info "  了解更多信息，请访问：https://github.com/paoloanzn/free-code"
