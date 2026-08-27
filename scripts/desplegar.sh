#!/usr/bin/env bash
#
# Despliegue del portal al VPS.
#
#   ./scripts/desplegar.sh
#
# Construye AQUÍ y sube solo el resultado. No se construye en el servidor por
# dos razones medidas: `next build` pica en 1,16 GB de memoria —en una máquina
# de 4 GB que además corre Postgres, ese pico cae encima de la base— y el
# paquete `standalone` pesa 72 MB frente a los 569 MB de `node_modules`, en un
# disco de 15 GB.
#
# El servidor se llama `psi-vps` en ~/.ssh/config. Ahí están la IP y el puerto.
#
set -euo pipefail

SERVIDOR=psi-vps
DESTINO=/opt/psi/app
SITIO="https://portal.jbrpsicometrias.com"

cd "$(dirname "$0")/.."

echo "==> Comprobaciones antes de tocar producción"
pnpm typecheck
pnpm lint

echo "==> Leyendo la clave anónima del servidor"
# Las NEXT_PUBLIC_* se INCRUSTAN al construir. Si se construye con las de local,
# el paquete sale apuntando a 127.0.0.1:54321 y la app no encuentra la base.
ANON=$(ssh "$SERVIDOR" 'grep "^ANON_KEY=" /opt/supabase/psi/.env | cut -d= -f2-')
[ -n "$ANON" ] || { echo "no pude leer ANON_KEY del servidor" >&2; exit 1; }

echo "==> Construyendo con los valores de producción"
NEXT_PUBLIC_SITE_URL="$SITIO" \
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:8000" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" \
NEXT_PUBLIC_BRAND_NAME="JBR Psicometrías" \
  pnpm build

# `standalone` no incluye los estáticos ni siempre `public`; hay que ponerlos.
cp -r .next/static .next/standalone/.next/static

if grep -rq "54321" .next/standalone/.next/server; then
  echo "ABORTADO: el paquete lleva dentro la dirección de Supabase local" >&2
  exit 1
fi

echo "==> Subiendo $(du -sh .next/standalone | cut -f1)"
# --no-xattrs y COPYFILE_DISABLE: sin ellos macOS mete sus atributos extendidos
# y el tar de GNU del servidor escupe un aviso por CADA archivo. No rompe nada,
# pero entierra la salida útil bajo cientos de líneas de ruido.
ssh "$SERVIDOR" "rm -rf $DESTINO.nuevo && mkdir -p $DESTINO.nuevo"
COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C .next/standalone . \
  | ssh "$SERVIDOR" "tar xzf - -C $DESTINO.nuevo"

echo "==> Relevo"
# El intercambio de directorios va junto al reinicio para que la ventana en la
# que el disco y el proceso no coinciden dure lo mínimo.
ssh "$SERVIDOR" "
  set -e
  chown -R psi:psi $DESTINO.nuevo
  mkdir -p $DESTINO.nuevo/.next/cache && chown psi:psi $DESTINO.nuevo/.next/cache
  rm -rf $DESTINO.anterior
  [ -d $DESTINO ] && mv $DESTINO $DESTINO.anterior
  mv $DESTINO.nuevo $DESTINO
  systemctl restart psi-app
"

echo "==> Comprobando"
sleep 5
CODIGO=$(ssh "$SERVIDOR" 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/')
if [ "$CODIGO" = "200" ]; then
  echo "    la app responde 200. Listo."
  ssh "$SERVIDOR" "rm -rf $DESTINO.anterior"
else
  echo "    responde $CODIGO — REVIRTIENDO" >&2
  ssh "$SERVIDOR" "
    rm -rf $DESTINO && mv $DESTINO.anterior $DESTINO && systemctl restart psi-app
  "
  echo "    versión anterior restaurada. Mira: ssh $SERVIDOR journalctl -u psi-app -n 50" >&2
  exit 1
fi
