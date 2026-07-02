#!/usr/bin/env bash
set -euo pipefail

# free-code 安装程序
# 使用方法：curl -fsSL https://raw.githubusercontent.com/paoloanzn/free-code/main/install.sh | bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

REPO="https://github.com/paoloanzn/free-code.git"
INSTALL_DIR="$HOME/free-code"
BUN_MIN_VERSION="1.3.11"

info()  { printf "${CYAN}[*]${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}[+]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[!]${RESET} %s\n" "$*"; }
fail()  { printf "${RED}[x]${RESET} %s\n" "$*"; exit 1; }

header() {
  echo ""
  printf "${BOLD}${CYAN}"
  cat << 'ART'
   ___                            _
  / _|_ __ ___  ___        ___ __| | ___
 | |_| '__/ _ \/ _ \_____ / __/ _` |/ _ \
 |  _| | |  __/  __/_____| (_| (_| |  __/
 |_| |_|  \___|\___|      \___\__,_|\___|

ART
  printf "${RESET}"
  printf "${DIM}  Claude Code 的自由构建版${RESET}\n"
  echo ""
}

# -------------------------------------------------------------------
# 系统检查
# -------------------------------------------------------------------

check_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *)      fail "不支持的操作系统：$(uname -s)。需要 macOS 或 Linux。" ;;
  esac
  ok "操作系统：$(uname -s) $(uname -m)"
}

check_git() {
  if ! command -v git &>/dev/null; then
    fail "git 未安装。请先安装：
    macOS：  xcode-select --install
    Linux：  sudo apt install git（或您的发行版对应命令）"
  fi
  ok "git：$(git --version | head -1)"
}

# 比较语义化版本号：$1 >= $2 时返回 0
version_gte() {
  [ "$(printf '%s\n' "$1" "$2" | sort -V | head -1)" = "$2" ]
}

check_bun() {
  if command -v bun &>/dev/null; then
    local ver
    ver="$(bun --version 2>/dev/null || echo "0.0.0")"
    if version_gte "$ver" "$BUN_MIN_VERSION"; then
      ok "bun：v${ver}"
      return
    fi
    warn "发现 bun v${ver}，但需要 v${BUN_MIN_VERSION}+。正在升级..."
  else
    info "未找到 bun。正在安装..."
  fi
  install_bun
}

install_bun() {
  curl -fsSL https://bun.sh/install | bash
  # 加载更新后的配置文件，使 bun 在当前会话中可用
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun &>/dev/null; then
    fail "bun 安装成功但在 PATH 中未找到二进制文件。
    请将其添加到您的 shell 配置文件并重启：
      export PATH=\"$HOME/.bun/bin:$PATH\""
  fi
  ok "bun：v$(bun --version)（刚刚安装）"
}

# -------------------------------------------------------------------
# 克隆与构建
# -------------------------------------------------------------------

clone_repo() {
  if [ -d "$INSTALL_DIR" ]; then
    warn "$INSTALL_DIR 已存在"
    if [ -d "$INSTALL_DIR/.git" ]; then
      info "正在拉取最新更改..."
      git -C "$INSTALL_DIR" pull --ff-only origin main 2>/dev/null || {
        warn "拉取失败，继续使用现有副本"
      }
    fi
  else
    info "正在克隆仓库..."
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
  fi
  ok "源码位置：$INSTALL_DIR"
}

install_deps() {
  info "正在安装依赖..."
  cd "$INSTALL_DIR"
  bun install --frozen-lockfile 2>/dev/null || bun install
  ok "依赖安装完成"
}

build_binary() {
  info "正在构建 free-code（已启用所有实验性功能）..."
  cd "$INSTALL_DIR"
  bun run build:dev:full
  ok "二进制文件构建完成：$INSTALL_DIR/cli-dev"
}

link_binary() {
  local link_dir="$HOME/.local/bin"
  mkdir -p "$link_dir"

  ln -sf "$INSTALL_DIR/cli-dev" "$link_dir/free-code"
  ok "已创建符号链接：$link_dir/free-code"

  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$link_dir"; then
    warn "$link_dir 不在您的 PATH 环境变量中"
    echo ""
    printf "${YELLOW}  请将此添加到您的 shell 配置文件（~/.bashrc、~/.zshrc 等）：${RESET}\n"
    printf "${BOLD}    export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}\n"
    echo ""
  fi
}

# -------------------------------------------------------------------
# 主流程
# -------------------------------------------------------------------

header
info "正在开始安装..."
echo ""

check_os
check_git
check_bun
echo ""

clone_repo
install_deps
build_binary
link_binary

echo ""
printf "${GREEN}${BOLD}  安装完成！${RESET}\n"
echo ""
printf "  ${BOLD}运行方式：${RESET}\n"
printf "    ${CYAN}free-code${RESET}                          # 交互式 REPL\n"
printf "    ${CYAN}free-code -p \"您的提示词\"${RESET}           # 单次执行模式\n"
echo ""
printf "  ${BOLD}设置您的 API 密钥：${RESET}\n"
printf "    ${CYAN}export ANTHROPIC_API_KEY=\"sk-ant-...\"${RESET}\n"
echo ""
printf "  ${BOLD}或通过 Claude.ai 登录：${RESET}\n"
printf "    ${CYAN}free-code /login${RESET}\n"
echo ""
printf "  ${DIM}源码位置：$INSTALL_DIR${RESET}\n"
printf "  ${DIM}二进制文件：$INSTALL_DIR/cli-dev${RESET}\n"
printf "  ${DIM}链接：~/.local/bin/free-code${RESET}\n"
echo ""