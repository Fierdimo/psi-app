import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Brand } from "@/components/marca/brand";

/**
 * Página de verificación del sistema de diseño (F0).
 *
 * No es parte del producto: es la prueba de que los tokens, los componentes y
 * las reglas de accesibilidad del spec están realmente implementados y no solo
 * documentados. Se elimina cuando la landing real ocupe esta ruta.
 */

const BRAND_RAMP = [
  ["50", "bg-brand-50", "text-brand-700"],
  ["100", "bg-brand-100", "text-brand-700"],
  ["200", "bg-brand-200", "text-brand-700"],
  ["300", "bg-brand-300", "text-brand-900"],
  ["400", "bg-brand-400", "text-brand-900"],
  ["500", "bg-brand-500", "text-surface-0"],
  ["600", "bg-brand-600", "text-surface-0"],
  ["700", "bg-brand-700", "text-surface-0"],
  ["800", "bg-brand-800", "text-surface-0"],
  ["900", "bg-brand-900", "text-surface-0"],
  ["950", "bg-brand-950", "text-surface-0"],
] as const;

const CONTRAST = [
  ["ink-900 / blanco", "15.72", "AAA", "Títulos y texto principal"],
  ["ink-700 / blanco", "10.24", "AAA", "Cuerpo de texto"],
  ["ink-500 / blanco", "4.76", "AA", "Texto atenuado"],
  ["ink-400 / blanco", "3.08", "AA · UI", "Borde de campos interactivos"],
  ["brand-600 / blanco", "6.94", "AA", "Enlaces y botón primario"],
  ["blanco / brand-800", "12.05", "AAA", "Cabecera del profesional"],
] as const;

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-line flex flex-col gap-5 border-t pt-12">
      <div className="flex flex-col gap-1.5">
        <span className="text-micro text-accent font-semibold tracking-[0.1em] uppercase">
          {eyebrow}
        </span>
        <h2 className="text-h2">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SistemaDeDisenoPage() {
  return (
    <main id="contenido" className="mx-auto w-full max-w-4xl px-6 py-16">
      <header className="flex flex-col gap-6 pb-12">
        <div className="flex items-center justify-between gap-4">
          <Brand size="md" />
          <span className="text-micro text-text-muted tabular">
            F0 · Verificación del sistema
          </span>
        </div>
        <h1 className="text-h1 tracking-[-0.02em]">
          Los tokens del spec, ya implementados
        </h1>
        <p className="text-text-body max-w-[62ch] text-lg">
          Todo lo que aparece en esta página se renderiza con los tokens de{" "}
          <code className="bg-sunken rounded-sm px-1.5 py-0.5 text-sm">
            src/styles/tokens.css
          </code>
          . Ningún componente declara un color propio, y la guardia de color lo
          verifica en cada build.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        <Section eyebrow="Color" title="Azul rey">
          <div className="overflow-hidden rounded-lg shadow-xs">
            <div className="grid grid-cols-11">
              {BRAND_RAMP.map(([step, bg, fg]) => (
                <div
                  key={step}
                  className={`${bg} flex aspect-[2/3] items-end p-1.5`}
                >
                  <span className={`${fg} text-micro tabular`}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="bg-brand-600 mb-2.5 h-11 rounded-sm" />
              <p className="text-text-strong text-sm font-semibold">Azul rey</p>
              <p className="text-micro text-text-muted">brand-600 · primario</p>
            </Card>
            <Card className="p-4">
              <div className="bg-brand-800 mb-2.5 h-11 rounded-sm" />
              <p className="text-text-strong text-sm font-semibold">
                Azul rey oscuro
              </p>
              <p className="text-micro text-text-muted">brand-800 · marca</p>
            </Card>
            <Card className="p-4">
              <div className="bg-ink-900 mb-2.5 h-11 rounded-sm" />
              <p className="text-text-strong text-sm font-semibold">
                Tinta, no negro
              </p>
              <p className="text-micro text-text-muted">ink-900 · texto</p>
            </Card>
          </div>

          <Alert tone="info" title="El texto más oscuro de la app es ink-900">
            No existe negro puro en ninguna parte: ni en texto, ni en bordes, ni
            en sombras. Las sombras derivan de brand-950. La guardia de color
            falla el build ante cualquier intento.
          </Alert>
        </Section>

        <Section eyebrow="Accesibilidad" title="Contraste validado">
          <div className="border-line overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-line border-b">
                  {["Par", "Ratio", "Nivel", "Uso"].map((h) => (
                    <th
                      key={h}
                      className="text-micro text-text-muted px-4 py-2.5 text-left font-semibold tracking-[0.08em] uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONTRAST.map(([par, ratio, nivel, uso]) => (
                  <tr key={par} className="border-line border-b last:border-0">
                    <td className="text-text-strong px-4 py-2.5">{par}</td>
                    <td className="text-text-strong tabular px-4 py-2.5">
                      {ratio}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-micro text-success-600 font-semibold">
                        {nivel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{uso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-text-muted max-w-[66ch] text-sm">
            El borde de un campo interactivo usa ink-400 (3.08:1) y no el gris
            más suave que se vería mejor: WCAG 1.4.11 exige 3:1 para el límite
            visual de un componente interactivo.
          </p>
        </Section>

        <Section eyebrow="Tipografía" title="Escala Inter">
          <div className="flex flex-col">
            {(
              [
                ["H1 · 36/42 · 600", "text-h1 font-semibold", "Tu calendario"],
                [
                  "H2 · 30/38 · 600",
                  "text-h2 font-semibold",
                  "Solicitar una cita",
                ],
                [
                  "Cita · 20/28 · 600",
                  "text-h4 font-semibold",
                  "Martes 18 de agosto",
                ],
                [
                  "Hora · 18 · tabular",
                  "text-lg tabular text-text-body",
                  "10:00 – 11:00 · Presencial",
                ],
                [
                  "Cuerpo · 16/26",
                  "text-base text-text-body",
                  "Puedes solicitar un cambio hasta 24 horas antes.",
                ],
                [
                  "Micro · 12/18",
                  "text-micro text-text-muted",
                  "Tus cambios se guardan automáticamente",
                ],
              ] as const
            ).map(([meta, cls, sample]) => (
              <div
                key={meta}
                className="border-line grid grid-cols-1 gap-1 border-t py-3.5 sm:grid-cols-[160px_1fr] sm:gap-5"
              >
                <span className="text-micro text-text-muted tabular">
                  {meta}
                </span>
                <span className={`${cls} text-text-strong min-w-0 truncate`}>
                  {sample}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="Componentes" title="Botones y campos">
          <Card sunken edge="border" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Solicitar cita</Button>
              <Button variant="secondary">Ver detalle</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="destructive-quiet">Cancelar cita</Button>
              <Button disabled>Deshabilitado</Button>
              <Button loading="Enviando…">Enviar</Button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="demo-correo"
                label="Correo electrónico"
                type="email"
                placeholder="nombre@correo.com"
                help="Te enviaremos un enlace de verificación"
              />
              <Field
                id="demo-error"
                label="Teléfono"
                defaultValue="123"
                error="Ingresa un número de al menos 7 dígitos"
              />
            </div>

            <p className="text-text-muted text-sm">
              Navega con Tab: el anillo de foco es visible en cada elemento, sin
              excepciones.
            </p>
          </Card>
        </Section>

        <Section eyebrow="Estado" title="Citas y avisos">
          <div className="flex flex-wrap gap-2">
            <Badge tone="warning">Solicitada</Badge>
            <Badge tone="success">Confirmada</Badge>
            <Badge tone="accent">Realizada</Badge>
            <Badge tone="neutral">Cancelada</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card accent edge="shadow" className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-micro text-text-muted font-semibold tracking-[0.09em] uppercase">
                  Próxima cita
                </span>
                <Badge tone="success">Confirmada</Badge>
              </div>
              <CardHeader>
                <CardTitle>Martes 18 de agosto</CardTitle>
                <p className="text-text-body tabular text-lg">
                  10:00 – 11:00 · Presencial
                </p>
                <CardDescription>
                  Consultorio 402, Av. Principal 1234
                </CardDescription>
              </CardHeader>
              <div>
                <span className="bg-accent-soft text-accent-on-soft inline-block rounded-sm px-2.5 py-1 text-sm font-medium">
                  En 6 días
                </span>
              </div>
              <CardFooter>
                <Button variant="secondary" size="sm">
                  Reprogramar
                </Button>
                <Button size="sm">Ver detalle</Button>
              </CardFooter>
            </Card>

            <div className="flex flex-col gap-3">
              <Alert tone="success" title="Cita confirmada">
                El profesional autorizó tu solicitud del 18 de agosto.
              </Alert>
              <Alert tone="warning" title="Solicitud por confirmar">
                Todavía no es un compromiso. Te avisaremos al confirmarla.
              </Alert>
              <Alert tone="danger" title="Revisa los campos marcados">
                No pudimos enviar la solicitud.
              </Alert>
            </div>
          </div>
        </Section>
      </div>

      <footer className="border-line text-text-muted mt-16 flex flex-wrap justify-between gap-4 border-t pt-6 text-sm">
        <span>Psi · Verificación del sistema de diseño</span>
        <span>Spec y plan en docs/</span>
      </footer>
    </main>
  );
}
