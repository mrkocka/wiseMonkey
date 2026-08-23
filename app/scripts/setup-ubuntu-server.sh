#!/usr/bin/env bash

set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-20}"
INSTALL_MARIADB="${INSTALL_MARIADB:-true}"
ENABLE_UFW="${ENABLE_UFW:-true}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Ezt a scriptet rootként vagy sudo-val kell futtatni."
    exit 1
  fi
}

ensure_apt() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Ez a script apt-alapú rendszerre készült (Ubuntu / Debian)."
    exit 1
  fi
}

install_base_packages() {
  log "Csomaglista frissítése"
  apt-get update

  log "Alap csomagok telepítése"
  apt-get install -y \
    ca-certificates \
    curl \
    git \
    gnupg \
    lsb-release \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw
}

install_nodejs() {
  log "NodeSource repository beállítása Node.js ${NODE_MAJOR} verzióhoz"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -

  log "Node.js és npm telepítése"
  apt-get install -y nodejs

  log "PM2 globális telepítése"
  npm install -g pm2
}

install_mariadb() {
  if [[ "${INSTALL_MARIADB}" != "true" ]]; then
    log "MariaDB telepítés kihagyva az INSTALL_MARIADB=${INSTALL_MARIADB} miatt"
    return
  fi

  log "MariaDB szerver és kliens telepítése"
  apt-get install -y mariadb-server mariadb-client

  log "MariaDB szolgáltatás engedélyezése"
  systemctl enable mariadb
  systemctl start mariadb
}

configure_firewall() {
  if [[ "${ENABLE_UFW}" != "true" ]]; then
    log "UFW konfiguráció kihagyva az ENABLE_UFW=${ENABLE_UFW} miatt"
    return
  fi

  log "Tűzfal szabályok beállítása"
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  ufw --force enable
}

show_versions() {
  log "Telepített verziók"
  echo "git: $(git --version)"
  echo "curl: $(curl --version | head -n 1)"
  echo "nginx: $(nginx -v 2>&1)"
  echo "certbot: $(certbot --version)"
  echo "node: $(node --version)"
  echo "npm: $(npm --version)"
  echo "pm2: $(pm2 --version)"

  if [[ "${INSTALL_MARIADB}" == "true" ]]; then
    echo "mariadb: $(mariadb --version)"
  fi
}

print_next_steps() {
  log "Következő lépések"
  cat <<EOF
1. Klónozd vagy másold fel a projektet a szerverre.
2. Lépj be az app mappába: cd app
3. Hozd létre és töltsd ki a .env fájlt.
4. Futtasd: npm install
5. Indítsd az alkalmazást: pm2 start server.js --name wise-monkey
6. Mentsd a PM2 állapotot: pm2 save
7. Készíts nginx reverse proxy konfigurációt a Node alkalmazás elé.
8. Aktiváld a HTTPS-t: certbot --nginx

Hasznos kapcsolók:
- MariaDB kihagyása: INSTALL_MARIADB=false bash scripts/setup-ubuntu-server.sh
- UFW kihagyása: ENABLE_UFW=false bash scripts/setup-ubuntu-server.sh
- Más Node főverzió: NODE_MAJOR=22 bash scripts/setup-ubuntu-server.sh
EOF
}

main() {
  require_root
  ensure_apt
  install_base_packages
  install_nodejs
  install_mariadb
  configure_firewall
  show_versions
  print_next_steps
}

main "$@"
