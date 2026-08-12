import { Download } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import {
  FormularioContrasena,
  FormularioCorreo,
  FormularioDatosPersonales,
  FormularioEliminacion,
  FormularioPreferencias,
} from "@/components/perfil/formularios-perfil";
import { Card } from "@/components/ui/card";
import { exigirSesion } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis datos" };

/**
 * Mis datos (SPEC.md §7.5).
 *
 * Cuatro secciones separadas, cada una con su propio guardado. La de
 * privacidad no es opcional: bajo habeas data el titular tiene derecho de
 * acceso y supresión, y la ruta para ejercerlo tiene que estar en la interfaz,
 * no escondida en un correo a la consulta.
 */
function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">{titulo}</h2>
        {descripcion && (
          <p className="text-text-muted max-w-[62ch] text-sm">{descripcion}</p>
        )}
      </div>
      <Card className="flex flex-col gap-6">{children}</Card>
    </section>
  );
}

export default async function MisDatosPage() {
  const perfil = await exigirSesion();
  const supabase = await crearClienteServidor();

  const [{ data: user }, { data: fila }, { data: eliminacion }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("profiles")
        .select(
          "nombre, apellidos, telefono, fecha_nacimiento, documento, timezone, recordatorios_email",
        )
        .eq("id", perfil.id)
        .single(),
      supabase
        .from("account_deletion_requests")
        .select("id")
        .eq("user_id", perfil.id)
        .eq("status", "solicitada")
        .maybeSingle(),
    ]);

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Mis datos"
        descripcion="Tu información de contacto, tu cuenta y qué hacemos con tus datos."
      />

      <div className="flex max-w-[720px] flex-col gap-10">
        <Seccion
          titulo="Datos personales"
          descripcion="Los usa tu profesional para identificarte y ponerse en contacto contigo."
        >
          <FormularioDatosPersonales
            perfil={{
              nombre: fila?.nombre ?? null,
              apellidos: fila?.apellidos ?? null,
              telefono: fila?.telefono ?? null,
              fecha_nacimiento: fila?.fecha_nacimiento ?? null,
              documento: fila?.documento ?? null,
            }}
          />
        </Seccion>

        <Seccion
          titulo="Cuenta"
          descripcion="Cómo entras a la plataforma. Los cambios de correo se confirman por enlace."
        >
          <FormularioCorreo correoActual={user?.user?.email ?? ""} />
          <hr className="border-line" />
          <FormularioContrasena />
        </Seccion>

        <Seccion
          titulo="Preferencias"
          descripcion="Cómo se te muestran las horas y cuándo te avisamos."
        >
          <FormularioPreferencias
            timezone={fila?.timezone ?? "America/Bogota"}
            recordatorios={fila?.recordatorios_email ?? true}
          />
        </Seccion>

        <Seccion
          titulo="Privacidad"
          descripcion="Tus derechos sobre la información que guardamos."
        >
          <div className="flex flex-col items-start gap-3">
            <p className="text-text-body text-sm">
              Puedes descargar una copia completa de todo lo que la plataforma
              guarda sobre ti, en formato legible por máquina.
            </p>
            <a
              href="/mis-datos/exportar"
              download
              className="text-accent inline-flex items-center gap-2 text-sm font-medium"
            >
              <Download aria-hidden="true" className="size-4" />
              Descargar mis datos (JSON)
            </a>
          </div>

          <hr className="border-line" />

          <FormularioEliminacion yaSolicitada={Boolean(eliminacion)} />
        </Seccion>
      </div>
    </Pantalla>
  );
}
