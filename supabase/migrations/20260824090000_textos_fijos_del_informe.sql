-- =============================================================================
-- 0059 · Lo que le faltaba al informe para parecerse al que se entrega
--
-- El informe que la consulta entrega hoy —una hoja de cálculo exportada a PDF—
-- tiene por cada escala TRES textos, y la base solo guardaba dos:
--
--   1. Qué mide la escala. Fijo, igual para todo el mundo. YA ESTABA, con
--      `nivel` nulo.
--   2. Sus características clave. Fijo también. NO ESTABA.
--   3. Qué significa ESTE puntaje. Cambia con el resultado. YA ESTABA, por
--      nivel.
--
-- Lo mismo con los cuatro cuadrantes cerebrales: les faltaban las palabras que
-- encabezan su recuadro —«LÓGICO · CRÍTICO · MATEMÁTICO · CUANTITATIVO»— que
-- son las que permiten leer el gráfico sin haber leído el párrafo.
--
-- Entra como TEXTO Y NO COMO CÓDIGO por la razón de siempre en esta tabla: es
-- contenido, y el profesional querrá corregir una redacción sin esperar a un
-- despliegue.
-- =============================================================================

insert into public.assessment_texts (assessment_id, parameter_key, nivel, cuerpo)
select a.id, v.clave, null, v.cuerpo
from public.assessments a,
(values
  ('claves_D',
   'Son líderes naturales, asumen riesgos, toman decisiones rápidas y se centran en el panorama general. Suelen ser competitivas, ambiciosas y no les gusta la indecisión o la lentitud.'),
  ('claves_I',
   'Son extrovertidas, carismáticas y verbales. Les gusta el reconocimiento social, el trabajo en equipo y las nuevas experiencias. Tienden a enfocarse en las relaciones y son muy buenas para construir redes de contactos.'),
  ('claves_S',
   'Son confiables, amigables y de apoyo. Son excelentes oyentes y se adaptan bien a las rutinas y a los roles de equipo. Suelen ser cautelosas con los cambios y buscan la estabilidad por encima de todo.'),
  ('claves_C',
   'Son metódicas, organizadas y minuciosas. Tienen un pensamiento crítico, buscan la perfección en su trabajo y se guían por los datos y la lógica. Suelen ser reservadas y prefieren trabajar de forma independiente en tareas que requieren atención al detalle.'),

  ('descriptores_cuadrante_a', 'Lógico · Crítico · Matemático · Cuantitativo'),
  ('descriptores_cuadrante_b',
   'Planificado · Secuencial · Organizado · Controlado · Detallado'),
  ('descriptores_cuadrante_c',
   'Interpersonal · Humanístico · Espiritual · Emocional · Sensorial · Musical'),
  ('descriptores_cuadrante_d',
   'Visual · Global · Creativo · Holístico · Integrador · Sintético · Conceptual · Artístico')
) as v(clave, cuerpo)
where a.clave = 'disc_dominancia'
on conflict do nothing;

-- =============================================================================
-- Los textos fijos, para quien lee un informe
--
-- `assessment_texts` está cerrada desde la migración 0018 —el banco de ítems y
-- sus textos son el producto— y eso sigue bien: nadie debe poder descargarse el
-- instrumento entero.
--
-- Pero un informe sin la descripción de las escalas es una lista de números.
-- Lo que se abre aquí es SOLO lo fijo —`nivel` nulo—, que es lo que explica qué
-- mide cada escala. Los textos por nivel no salen: esos son la baremación, y a
-- quien lee su informe le llegan ya escogidos dentro de su resultado.
-- =============================================================================
create or replace function public.textos_fijos_del_instrumento(p_assessment uuid)
returns table (parameter_key text, cuerpo text)
language sql
stable
security definer
set search_path = public
as $$
  select t.parameter_key, t.cuerpo
  from public.assessment_texts t
  where t.assessment_id = p_assessment
    and t.nivel is null;
$$;

comment on function public.textos_fijos_del_instrumento(uuid) is
  'Las descripciones fijas de las escalas de un instrumento. NO los textos por '
  'nivel: esos son baremación y viajan dentro del resultado de cada persona.';

revoke all on function public.textos_fijos_del_instrumento(uuid) from public;
grant execute on function public.textos_fijos_del_instrumento(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- El servidor necesita leer las ETIQUETAS de los parámetros
--
-- `assessment_parameters` estaba abierta a `authenticated` y a nadie más, y el
-- informe de quien responde se compone con la clave de servicio: esa persona no
-- tiene sesión —su credencial era el pase, y el pase se apaga al enseñárselo—.
--
-- Sin este permiso la consulta no fallaba: devolvía vacío, y el documento salía
-- con las claves crudas donde van los títulos —«MAS_EFECTIVO» en lugar de
-- «Sería más efectivo(a) si»—. Se vio mirando el informe, no leyendo el código.
--
-- Se concede solo la lectura, y solo de los parámetros: son el CONTRATO del
-- instrumento —qué devuelve y cómo se llama cada cosa—, no su banco de ítems,
-- que sigue cerrado.
-- -----------------------------------------------------------------------------
grant select on public.assessment_parameters to service_role;
