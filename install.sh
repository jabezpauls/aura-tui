#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${PURPLE}${BOLD}"
echo "    ╔═══════════════════════════════╗"
echo "    ║         AuraTUI Setup         ║"
echo "    ╚═══════════════════════════════╝"
echo -e "${NC}"

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="macos"
elif [[ -f /etc/debian_version ]]; then
  OS="debian"
elif [[ -f /etc/arch-release ]]; then
  OS="arch"
elif [[ -f /etc/fedora-release ]]; then
  OS="fedora"
elif command -v apt &>/dev/null; then
  OS="debian"
elif command -v pacman &>/dev/null; then
  OS="arch"
elif command -v dnf &>/dev/null; then
  OS="fedora"
fi

echo -e "${BOLD}Detected OS:${NC} $OS"
echo ""

# ── Check & install prerequisites ──

install_pkg() {
  local name="$1"
  if command -v "$name" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $name"
    return 0
  fi

  echo -e "  ${YELLOW}⟳${NC} Installing $name..."
  case "$OS" in
    macos)  brew install "$name" ;;
    debian) sudo apt install -y "$name" ;;
    arch)   sudo pacman -S --noconfirm "$name" ;;
    fedora) sudo dnf install -y "$name" ;;
    *)
      echo -e "  ${RED}✗${NC} Cannot auto-install $name. Please install it manually."
      return 1
      ;;
  esac

  if command -v "$name" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $name installed"
  else
    echo -e "  ${RED}✗${NC} Failed to install $name"
    return 1
  fi
}

echo -e "${BOLD}Checking prerequisites...${NC}"

MISSING=0
install_pkg mpv   || MISSING=1
install_pkg curl  || MISSING=1

# yt-dlp needs special handling — pip or package manager
if command -v yt-dlp &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} yt-dlp"
else
  echo -e "  ${YELLOW}⟳${NC} Installing yt-dlp..."
  case "$OS" in
    macos)  brew install yt-dlp ;;
    arch)   sudo pacman -S --noconfirm yt-dlp ;;
    fedora) sudo dnf install -y yt-dlp ;;
    debian)
      if command -v pipx &>/dev/null; then
        pipx install yt-dlp
      elif command -v pip3 &>/dev/null; then
        pip3 install --break-system-packages yt-dlp 2>/dev/null || pip3 install yt-dlp
      elif command -v pip &>/dev/null; then
        pip install yt-dlp
      else
        sudo apt install -y python3-pip
        pip3 install --break-system-packages yt-dlp 2>/dev/null || pip3 install yt-dlp
      fi
      ;;
    *)
      echo -e "  ${RED}✗${NC} Cannot auto-install yt-dlp. Run: pip install yt-dlp"
      MISSING=1
      ;;
  esac

  if command -v yt-dlp &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} yt-dlp installed"
  else
    echo -e "  ${RED}✗${NC} Failed to install yt-dlp"
    MISSING=1
  fi
fi

# Check Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge 18 ]; then
    echo -e "  ${GREEN}✓${NC} node $(node -v)"
  else
    echo -e "  ${RED}✗${NC} Node.js v18+ required (found $(node -v))"
    MISSING=1
  fi
else
  echo -e "  ${RED}✗${NC} Node.js not found. Install from https://nodejs.org/"
  MISSING=1
fi

echo ""

if [ "$MISSING" -eq 1 ]; then
  echo -e "${RED}${BOLD}Some prerequisites are missing. Fix them and re-run this script.${NC}"
  exit 1
fi

# ── Install AuraTUI ──

echo -e "${BOLD}Installing AuraTUI...${NC}"

# Resolve the directory where install.sh lives (i.e. the repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build first
echo -e "  ${YELLOW}⟳${NC} Building..."
if command -v bun &>/dev/null; then
  (cd "$SCRIPT_DIR" && bun install && bun run build)
elif command -v npm &>/dev/null; then
  (cd "$SCRIPT_DIR" && npm install && npm run build)
else
  echo -e "${RED}✗ Neither npm nor bun found.${NC}"
  exit 1
fi

# Install globally from local repo
echo -e "  ${YELLOW}⟳${NC} Linking globally..."
npm install -g "$SCRIPT_DIR"

echo ""
echo -e "${GREEN}${BOLD}    ╔═══════════════════════════════╗"
echo "    ║      AuraTUI installed! 🎵    ║"
echo "    ╚═══════════════════════════════╝${NC}"
echo ""
echo -e "  Run ${PURPLE}${BOLD}aura${NC} to start."
echo ""
