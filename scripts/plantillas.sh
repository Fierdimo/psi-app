#!/usr/bin/env bash
#
# Publica las plantillas de correo de autenticación en el servidor.
#
#   ./scripts/plantillas.sh
#
# Estas plantillas NO las manda la aplicación: las manda Supabase (GoTrue) al
# registrarse, al recuperar la contraseña y al cambiar de dirección. Por eso no
# viajan con `desplegar.sh`, que sube la app.
#
# Y no se leen del disco: GoTrue las DESCARGA por HTTP —su documentación dice
# «URL to the template»—. Montarlas dentro del contenedor no funciona: intenta
# resolver la ruta contra API_EXTERNAL_URL y falla con «no such host». Las
# sirve Caddy en http://host.docker.internal/, accesible solo desde los
# contenedores.
#
set -euo pipefail

SERVIDOR=psi-vps
cd "$(dirname "$0")/.."

echo "==> Subiendo las plantillas"
scp -q supabase/templates/*.html "$SERVIDOR":/opt/psi/plantillas/
ssh "$SERVIDOR" 'chown caddy:caddy /opt/psi/plantillas/*.html'

# GoTrue las cachea diez minutos (GOTRUE_MAILER_TEMPLATE_MAX_AGE). Sin este
# reinicio, editar una plantilla y probarla enseguida enseña la versión vieja
# —y se pierde un rato buscando el error en el sitio equivocado.
echo "==> Reiniciando auth para vaciar su caché de plantillas"
ssh "$SERVIDOR" 'cd /opt/supabase/psi && docker compose restart auth' 2>&1 | tail -1

echo "==> Comprobando que GoTrue las alcanza"
for f in confirmacion recuperacion cambio-de-correo invitacion; do
  printf '    %-18s ' "$f"
  ssh "$SERVIDOR" "cd /opt/supabase/psi && docker compose exec -T auth wget -q -O - http://host.docker.internal/$f.html 2>/dev/null | head -c 1 >/dev/null && echo OK || echo FALLA"
done
