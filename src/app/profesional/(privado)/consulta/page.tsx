import { Settings } from "lucide-react";
import type { Metadata } from "next";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { FormularioPlazo } from "@/components/profesional/formulario-plazo";
import {
  FormularioVentana,
  type InstrumentoConfigurable,
} from "@/components/profesional/formulario-ventana";
import { Alert } from "@/components/ui/alert";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { exigirProfesional } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configuración" };

/**
 * Lo único que queda por configurar.
 *
 * ESTA PANTALLA ERA LA DE LA AGENDA: anticipación mínima, duración del bloque,
 * jornada, pausa y días laborables. Todo eso gobernaba el reparto de citas, y
 * sin citas no gobierna nada — un ajuste que no cambia el comportamiento de
 * nada es peor que ninguno, porque alguien lo toca creyendo que sirve.
 *
 * Lo que sí hay que poder decidir es cuánto dura una prueba. Y no cuánto se
 * tarda en empezarla —eso es logística de la empresa, y vive en el plazo del
 * enlace— sino cuánto tiempo hay para TERMINARLA una vez empezada. Es una
 * condición de aplicación del instrumento: una psicotécnica respondida a lo
 * largo de tres semanas, consultando y comparando, no mide lo que dice medir.
 */
export default async function ConsultaPage() {
  await exigirProfesional();
  const supabase = await crearClienteServidor();

  const [{ data }, { data: ajustes }] = await Promise.all([
    supabase.rpc("instrumentos_configurables"),
    supabase.from("clinic_settings").select("dias_para_empezar").maybeSingle(),
  ]);

  const instrumentos = (data ?? []) as InstrumentoConfigurable[];
  const dias = ajustes?.dias_para_empezar ?? 30;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Las condiciones con las que se aplica cada prueba."
      />

      {/*
        Los dos plazos, arriba y una sola vez.

        Es lo único de esta pantalla que se puede entender mal, y de forma
        cara: quien confunda uno con otro pondría treinta minutos donde van
        treinta días y dejaría fuera a todo el mundo.
      */}
      <Alert tone="info" title="Dos plazos distintos">
        Uno es cuánto tiempo hay para <strong>abrir</strong> el enlace desde que
        se envía; el otro, cuánto hay para <strong>terminar</strong> la prueba
        una vez empezada. Se configuran por separado porque responden a cosas
        distintas: el primero es logística de la empresa, el segundo una
        condición del instrumento.
      </Alert>

      <FormularioPlazo dias={dias} />

      {instrumentos.length === 0 ? (
        <EstadoVacio
          icono={Settings}
          titulo="No hay pruebas activas"
          descripcion="Cuando haya un instrumento en el catálogo, sus condiciones de aplicación se configuran aquí."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {instrumentos.map((i) => (
            <FormularioVentana key={i.clave} instrumento={i} />
          ))}
        </div>
      )}
    </Pantalla>
  );
}
