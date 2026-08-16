-- =============================================================================
-- El contenido del instrumento, contra el informe de muestra
--
-- Estas pruebas no miran permisos ni transiciones: miran que cada texto esté
-- BAJO SU PROPIO TÍTULO.
--
-- Existen porque faltaban. Seis apartados se importaron con la etiqueta de
-- otro —la fila de cabeceras de la hoja está corrida una columna— y el fallo
-- llegó impreso al informe de una persona: «Resumen del perfil» mostraba el
-- texto de «Sería más efectivo si». Las 117 pruebas de entonces comprobaban
-- que el texto LLEGA; ninguna que fuera EL SUYO.
--
-- La referencia es el informe de muestra que aportó la consulta, para el
-- Patrón del Especialista.
-- =============================================================================

begin;

create extension if not exists pgtap;

select plan(14);

\set patron 'PATRON DEL ESPECIALISTA'

/** El arranque del apartado, que es lo que lo identifica sin ambigüedad. */
create or replace function apartado(p_clave text, p_largo int) returns text
language sql stable as $$
  select left(t.cuerpo, p_largo)
  from public.assessment_texts t
  join public.assessments a on a.id = t.assessment_id
  where a.clave = 'disc_dominancia'
    and t.parameter_key = p_clave
    and t.nivel = 'PATRON DEL ESPECIALISTA';
$$;

select is(
  apartado('emociones', 20),
  'Moderación calculada',
  'Emociones'
);

select is(
  apartado('meta', 25),
  'Conservar el “status quo”',
  'Meta'
);

select is(
  apartado('juzga', 21),
  'Las normas de amistad',
  'Juzga a los otros según'
);

-- El que no existía: su columna no tiene cabecera en la hoja.
select is(
  apartado('influye', 29),
  'Su constancia en el desempeño',
  'Influye en otras personas mediante'
);

select is(
  apartado('valor', 23),
  'Planifica a corto plazo',
  'Su valor para la organización'
);

select is(
  apartado('abusa', 38),
  'La modestia; su miedo a correr riesgos',
  'Abusa de'
);

select is(
  apartado('bajo_presion', 36),
  'Se adapta a quienes tienen autoridad',
  'Bajo presión'
);

select is(
  apartado('teme', 32),
  'Los cambios; la desorganización.',
  'Teme'
);

select is(
  apartado('mas_efectivo', 25),
  'Compartiera más sus ideas',
  'Sería más efectivo(a) si'
);

select is(
  apartado('resumen', 46),
  'El Especialista se “lleva bien” con los demás.',
  'El resumen empieza por donde debe'
);

-- Y son SUS TRES párrafos, no uno: los otros dos venían rotulados
-- «CONCEPTO 2» y «CONVEPTO 3», y se quedaron fuera en la primera importación.
select is(
  (select count(*)::int
   from regexp_split_to_table(
     (select t.cuerpo from public.assessment_texts t
      join public.assessments a on a.id = t.assessment_id
      where a.clave = 'disc_dominancia'
        and t.parameter_key = 'resumen'
        and t.nivel = 'PATRON DEL ESPECIALISTA'),
     E'\n\n') as parrafo),
  3,
  'El resumen trae sus tres párrafos'
);

-- =============================================================================
-- Y el instrumento entero sigue en pie
-- =============================================================================
select is(
  (select count(*)::int from public.assessment_items
   where tipo = 'forced_choice'),
  28,
  '28 bloques, no los 29 del formulario: dos preguntaban lo mismo'
);

select is(
  (select count(*)::int from public.assessment_items where tipo = 'likert'),
  40,
  '40 afirmaciones de dominancia cerebral'
);

select is(
  (select count(distinct nivel)::int from public.assessment_texts
   where parameter_key = 'emociones'),
  15,
  'Los 15 patrones con textos, cada uno con su apartado'
);

select * from finish();
rollback;
