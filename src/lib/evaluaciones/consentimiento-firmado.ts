import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CONSENTIMIENTO,
  seccionesDelConsentimiento,
} from "@/lib/consentimiento";
import type { ConsentimientoInforme } from "@/lib/evaluaciones/estructura-informe";

/**
 * La clave con la que la BASE registra el consentimiento de una evaluación.
 *
 * No es `CONSENTIMIENTO.clave`, y esa discrepancia lleva ahí desde la
 * migración 0021: el módulo la llama `consentimiento_informado` —el documento—
 * y `consentir_evaluacion` escribe `consentimiento_evaluacion` —el acto—. La
 * VERSIÓN que se guarda sí es la del módulo, así que las dos mitades de la
 * evidencia se corresponden aunque la etiqueta no.
 *
 * Se deja escrito aquí en vez de unificarlo: cambiar la clave que escribe la
 * base dejaría huérfanos los consentimientos ya firmados, que es justo lo que
 * una tabla de evidencias no puede permitirse.
 *
 * El síntoma cuando no se sabe: el informe sale sin consentimiento y sin
 * ningún error, porque una consulta que no encuentra nada no falla.
 */
const CLAVE_EN_LA_BASE = "consentimiento_evaluacion";

/**
 * El consentimiento que firmó quien respondió una evaluación.
 *
 * Va dentro del informe porque quien recibe un perfil psicológico necesita
 * ver, en el mismo documento, que la persona supo a qué accedía y lo aceptó.
 *
 * -------------------------------------------------------------------------
 * SE DEVUELVE EL TEXTO DE LA VERSIÓN QUE ESA PERSONA ACEPTÓ, NO EL VIGENTE.
 *
 * Es toda la diferencia entre una evidencia y un adorno. El consentimiento se
 * versiona precisamente para poder demostrar qué redacción exacta se aceptó y
 * cuándo; enseñar la de hoy junto a una fecha de hace un año sería afirmar
 * algo que no ocurrió.
 *
 * Como el texto vive en el código y no en la base, solo se puede reconstruir
 * el de la versión vigente. Si la aceptada fue otra, se devuelven las secciones
 * en nulo: el informe enseña el acuse —quién, cuándo, qué versión— y dice
 * dónde está esa redacción. Un acuse sin texto es incompleto; un texto
 * equivocado es peor.
 * -------------------------------------------------------------------------
 *
 * Devuelve nulo si no consta aceptación. No es un fallo: una evaluación
 * vencida sin responder no tiene ninguna, y el informe se dibuja igual.
 */
export async function consentimientoFirmado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  asignacion: string,
  evaluado: {
    nombre: string;
    documento: string | null;
    empresa: string | null;
  },
): Promise<ConsentimientoInforme | null> {
  const { data } = await supabase
    .from("consents")
    .select("version, accepted_at, decision")
    .eq("assignment_id", asignacion)
    .eq("document_key", CLAVE_EN_LA_BASE)
    .eq("decision", "aceptado")
    /*
     * La ÚLTIMA aceptación, no la primera.
     *
     * La decisión es reversible mientras no se envíe la prueba: alguien puede
     * aceptar, retirarlo y volver a aceptar. Lo que vale es la que estaba en
     * pie al responder, que es la más reciente.
     */
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const esLaVigente = data.version === CONSENTIMIENTO.version;

  return {
    secciones: esLaVigente
      ? seccionesDelConsentimiento(evaluado.empresa)
      : null,
    version: data.version,
    aceptadoEl: data.accepted_at,
    nombre: evaluado.nombre,
    documento: evaluado.documento,
  };
}
