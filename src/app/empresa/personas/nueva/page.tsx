import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioPersona } from "@/components/empresa/formulario-persona";
import { exigirEmpresa } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Cargar una persona" };

/**
 * Alta de una persona.
 *
 * Vive en su propia ruta y no incrustada en el listado: así el listado es un
 * listado —se lee de un vistazo— y el formulario puede abrirse como panel sin
 * duplicar nada.
 */
export default async function NuevaPersonaPage() {
  await exigirEmpresa();

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Cargar una persona"
        descripcion="Se identifica por su documento y no por su correo: así se le reconoce aunque cambie de trabajo o de dirección."
      />
      <FormularioPersona />
    </Pantalla>
  );
}
