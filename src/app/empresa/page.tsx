import { ClipboardCheck, ClipboardList, UserPlus, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  EncabezadoPagina,
  Pantalla,
} from "@/components/navegacion/encabezado-pagina";
import { buttonVariants } from "@/components/ui/button";
import { exigirEmpresa } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Inicio del área de la empresa.
 *
 * Antes contestaba «¿cuándo es lo próximo?», y esa pregunta ya no existe: no
 * hay fechas. Las tres que quedan son las que se traen a alguien a esta
 * pantalla: cuánto me queda, qué está pendiente de responder, y hay informes
 * nuevos.
 *
 * Nada más. Un panel que intenta decirlo todo no dice nada.
 */
export default async function InicioEmpresaPage() {
  await exigirEmpresa();
  const supabase = await crearClienteServidor();

  const [{ data: saldo }, { count: enCurso }, { count: informes }] =
    await Promise.all([
      supabase.rpc("saldo_de_usos"),
      supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .in("status", ["asignada", "en_curso"]),
      supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("status", "publicada"),
    ]);

  const disponibles = typeof saldo === "number" ? saldo : 0;

  return (
    <Pantalla>
      <EncabezadoPagina
        titulo="Tu espacio de empresa"
        descripcion="Compras usos, encargas evaluaciones y recibes los informes. Cada evaluación gasta un uso."
      >
        {/*
          La acción principal, SIEMPRE.

          Estuvo condicionada al saldo, y esconderla cuando no lo hay es el
          error de siempre: quien entra sin usos no descubre dónde vive lo
          único que ha venido a hacer, y tiene que deducir que primero hay que
          pasar por «Usos». Con saldo cero el formulario no se abre —se abre la
          explicación de por qué y el enlace para resolverlo—, que es una
          respuesta y no un callejón.
        */}
        <Link
          href="/empresa/evaluaciones/nueva"
          className={buttonVariants({ variant: "primary" })}
        >
          <UserPlus aria-hidden="true" className="size-4" />
          Encargar una evaluación
        </Link>
      </EncabezadoPagina>

      <div className="grid gap-4 sm:grid-cols-3">
        {/*
          El saldo primero, y se abre.

          Es el dato que gobierna todo lo demás: sin usos no hay nada que
          hacer aquí, y la pantalla desde la que se resuelve es «Usos». Sin
          enlace habría que adivinar dónde se piden.
        */}
        <Tarjeta
          href="/empresa/usos"
          icono={Wallet}
          titulo="Usos disponibles"
          dato={String(disponibles)}
          pie={
            disponibles === 0
              ? "Solicita más para poder encargar"
              : "Cada evaluación gasta uno"
          }
        />

        <Tarjeta
          href="/empresa/evaluaciones"
          icono={ClipboardCheck}
          titulo="Sin responder"
          dato={String(enCurso ?? 0)}
          pie={
            (enCurso ?? 0) === 0
              ? "No hay nadie pendiente"
              : "Ya tienen su enlace"
          }
        />

        <Tarjeta
          href="/empresa/evaluaciones"
          icono={ClipboardList}
          titulo="Informes listos"
          dato={String(informes ?? 0)}
          pie={
            (informes ?? 0) === 0
              ? "Llegan por correo al terminar"
              : "Se abren desde su evaluación"
          }
        />
      </div>
    </Pantalla>
  );
}

function Tarjeta({
  href,
  icono: Icono,
  titulo,
  dato,
  pie,
}: {
  href: string;
  icono: typeof Wallet;
  titulo: string;
  dato: string;
  pie: string;
}) {
  return (
    <Link
      href={href}
      className="border-line bg-panel hover:border-line-interactive ease-psi flex flex-col gap-3 rounded-lg border p-6 transition-colors duration-150"
    >
      <span className="bg-accent-soft text-accent grid size-10 place-items-center rounded-md">
        <Icono aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-h4">{titulo}</h2>
      <span className="text-h1 tabular leading-none">{dato}</span>
      <span className="text-text-muted text-sm">{pie}</span>
    </Link>
  );
}
