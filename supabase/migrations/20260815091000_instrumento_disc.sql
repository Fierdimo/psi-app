-- =============================================================================
-- 0019 · El instrumento real de la consulta
--
-- SPEC.md §9.2
--
-- Los 68 ítems se extrajeron del formulario que la consulta usa hoy, no se
-- transcribieron a mano. El material está licenciado; lo confirmó el titular.
--
-- Dos cosas que el formulario original tenía mal y aquí se corrigen:
--
--   · Tenía 29 bloques para una prueba de 28. Los bloques 23 y 24 preguntaban
--     exactamente los mismos cuatro adjetivos, así que quien respondía puntuaba
--     ese bloque dos veces. Se carga una sola vez.
--   · Dos bloques distintos llevaban la etiqueta «Pregunta 12». Aquí la
--     posición es el número y no puede repetirse: lo impide la base.
--
-- Y lo que NO se puede cargar todavía, con su motivo:
--
--   · A qué escala tributa cada adjetivo (D, I, S o C). El formulario no lo
--     dice —solo lista los cuatro adjetivos— y sin ese mapa no hay forma de
--     puntuar. Va en `escala: null` en cada opción, esperando el dato.
--     Inventarlo produciría perfiles equivocados con apariencia de correctos,
--     que es peor que no tener nada.
--   · La tabla que traduce el código de segmentos a un patrón con nombre. Del
--     informe de muestra solo se conoce una entrada, «Patrón del
--     Especialista»; faltan las demás.
-- =============================================================================

-- La subescala a la que pertenece un ítem. En un bloque de elección forzada la
-- escala va en cada opción; en una afirmación de escala Likert es del ítem
-- entero, y no tenía dónde vivir.
alter table public.assessment_items add column escala text;

do $$
declare
  v_prueba uuid;
begin

insert into public.assessments (clave, nombre, descripcion, motor, version, kind)
values (
  'disc_dominancia',
  'Perfil DISC y dominancia cerebral',
  'Inventario de DISCernimiento Personal (28 bloques de elección forzada) junto '
  'con el análisis de dominancia cerebral (40 afirmaciones en escala de 1 a 5). '
  'Se aplican en una sola sesión y producen un informe con dos secciones.',
  'disc_dominancia',
  '1',
  'inventario'
)
returning id into v_prueba;

-- 28 bloques DISC y 40 afirmaciones de dominancia cerebral.

insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 1, 'forced_choice', 'Bloque 1', '[{"id":"a","texto":"Entusiasta","escala":null}, {"id":"b","texto":"Rápido(a)","escala":null}, {"id":"c","texto":"Lógico(a)","escala":null}, {"id":"d","texto":"Apacible","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 2, 'forced_choice', 'Bloque 2', '[{"id":"a","texto":"Cauteloso(a)","escala":null}, {"id":"b","texto":"Decidido(a)","escala":null}, {"id":"c","texto":"Receptivo(a)","escala":null}, {"id":"d","texto":"Bondadoso(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 3, 'forced_choice', 'Bloque 3', '[{"id":"a","texto":"Amigable","escala":null}, {"id":"b","texto":"Preciso(a)","escala":null}, {"id":"c","texto":"Franco(a)","escala":null}, {"id":"d","texto":"Tranquilo(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 4, 'forced_choice', 'Bloque 4', '[{"id":"a","texto":"Elocuente","escala":null}, {"id":"b","texto":"Controlado(a)","escala":null}, {"id":"c","texto":"Tolerante","escala":null}, {"id":"d","texto":"Decisivo(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 5, 'forced_choice', 'Bloque 5', '[{"id":"a","texto":"Atrevido(a)","escala":null}, {"id":"b","texto":"Concienzudo(a)","escala":null}, {"id":"c","texto":"Comunicativo(a)","escala":null}, {"id":"d","texto":"Moderado(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 6, 'forced_choice', 'Bloque 6', '[{"id":"a","texto":"Ameno(a)","escala":null}, {"id":"b","texto":"Ingenioso(a)","escala":null}, {"id":"c","texto":"Investigador(a)","escala":null}, {"id":"d","texto":"Acepta Riesgos","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 7, 'forced_choice', 'Bloque 7', '[{"id":"a","texto":"Expresivo(a)","escala":null}, {"id":"b","texto":"Cuidadoso(a)","escala":null}, {"id":"c","texto":"Dominante","escala":null}, {"id":"d","texto":"Sensible","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 8, 'forced_choice', 'Bloque 8', '[{"id":"a","texto":"Extrovertido(a)","escala":null}, {"id":"b","texto":"Precavido(a)","escala":null}, {"id":"c","texto":"Constante","escala":null}, {"id":"d","texto":"Impaciente","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 9, 'forced_choice', 'Bloque 9', '[{"id":"a","texto":"Discreto(a)","escala":null}, {"id":"b","texto":"Complaciente","escala":null}, {"id":"c","texto":"Encantador(a)","escala":null}, {"id":"d","texto":"Insistente","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 10, 'forced_choice', 'Bloque 10', '[{"id":"a","texto":"Valeroso(a)","escala":null}, {"id":"b","texto":"Anima a los demás","escala":null}, {"id":"c","texto":"Pacifico(a)","escala":null}, {"id":"d","texto":"Perfeccionista","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 11, 'forced_choice', 'Bloque 11', '[{"id":"a","texto":"Reservado(a)","escala":null}, {"id":"b","texto":"Atento(a)","escala":null}, {"id":"c","texto":"Osado(a)","escala":null}, {"id":"d","texto":"Alegre","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 12, 'forced_choice', 'Bloque 12', '[{"id":"a","texto":"Estimulante","escala":null}, {"id":"b","texto":"Gentil","escala":null}, {"id":"c","texto":"Perceptivo(a)","escala":null}, {"id":"d","texto":"Independiente","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 13, 'forced_choice', 'Bloque 13', '[{"id":"a","texto":"Competitivo(a)","escala":null}, {"id":"b","texto":"Considerado(a)","escala":null}, {"id":"c","texto":"Alegre","escala":null}, {"id":"d","texto":"Sagaz","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 14, 'forced_choice', 'Bloque 14', '[{"id":"a","texto":"Meticuloso(a)","escala":null}, {"id":"b","texto":"Obediente","escala":null}, {"id":"c","texto":"Ideas Firmes","escala":null}, {"id":"d","texto":"Alentador(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 15, 'forced_choice', 'Bloque 15', '[{"id":"a","texto":"Popular","escala":null}, {"id":"b","texto":"Reflexivo(a)","escala":null}, {"id":"c","texto":"Tenaz","escala":null}, {"id":"d","texto":"Calmado(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 16, 'forced_choice', 'Bloque 16', '[{"id":"a","texto":"Analítico(a)","escala":null}, {"id":"b","texto":"Audaz","escala":null}, {"id":"c","texto":"Leal","escala":null}, {"id":"d","texto":"Promotor(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 17, 'forced_choice', 'Bloque 17', '[{"id":"a","texto":"Sociable","escala":null}, {"id":"b","texto":"Paciente","escala":null}, {"id":"c","texto":"Autosuficiente","escala":null}, {"id":"d","texto":"Certero(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 18, 'forced_choice', 'Bloque 18', '[{"id":"a","texto":"Adaptable","escala":null}, {"id":"b","texto":"Resuelto(a)","escala":null}, {"id":"c","texto":"Prevenido(a)","escala":null}, {"id":"d","texto":"Vivaz","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 19, 'forced_choice', 'Bloque 19', '[{"id":"a","texto":"Agresivo(a)","escala":null}, {"id":"b","texto":"Impetuoso(a)","escala":null}, {"id":"c","texto":"Amistoso(a)","escala":null}, {"id":"d","texto":"Discerniente","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 20, 'forced_choice', 'Bloque 20', '[{"id":"a","texto":"De trato Fácil","escala":null}, {"id":"b","texto":"Compasivo(a)","escala":null}, {"id":"c","texto":"Cauto(a)","escala":null}, {"id":"d","texto":"Habla Directo","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 21, 'forced_choice', 'Bloque 21', '[{"id":"a","texto":"Evaluador(a)","escala":null}, {"id":"b","texto":"Generoso(a)","escala":null}, {"id":"c","texto":"Animado(a)","escala":null}, {"id":"d","texto":"Persistente","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 22, 'forced_choice', 'Bloque 22', '[{"id":"a","texto":"Impulsivo(a)","escala":null}, {"id":"b","texto":"Cuida los Detalles","escala":null}, {"id":"c","texto":"Enérgico(a)","escala":null}, {"id":"d","texto":"Tranquilo(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 23, 'forced_choice', 'Bloque 23', '[{"id":"a","texto":"Sociable","escala":null}, {"id":"b","texto":"Sistemático(a)","escala":null}, {"id":"c","texto":"Vigoroso(a)","escala":null}, {"id":"d","texto":"Tolerante","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 24, 'forced_choice', 'Bloque 24', '[{"id":"a","texto":"Cautivador(a)","escala":null}, {"id":"b","texto":"Contento(a)","escala":null}, {"id":"c","texto":"Exigente","escala":null}, {"id":"d","texto":"Apegado(a) a las normas","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 25, 'forced_choice', 'Bloque 25', '[{"id":"a","texto":"Le agrada discutir","escala":null}, {"id":"b","texto":"Metódico(a)","escala":null}, {"id":"c","texto":"Comedido(a)","escala":null}, {"id":"d","texto":"Desenvuelto(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 26, 'forced_choice', 'Bloque 26', '[{"id":"a","texto":"Jovial","escala":null}, {"id":"b","texto":"Preciso(a)","escala":null}, {"id":"c","texto":"Directo(a)","escala":null}, {"id":"d","texto":"Ecuánime","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 27, 'forced_choice', 'Bloque 27', '[{"id":"a","texto":"Inquieto(a)","escala":null}, {"id":"b","texto":"Amable","escala":null}, {"id":"c","texto":"Elocuente","escala":null}, {"id":"d","texto":"Cuidadoso(a)","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, opciones) values
  (v_prueba, 28, 'forced_choice', 'Bloque 28', '[{"id":"a","texto":"Prudente","escala":null}, {"id":"b","texto":"Pionero(a)","escala":null}, {"id":"c","texto":"Espontáneo(a)","escala":null}, {"id":"d","texto":"Colaborador","escala":null}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 29, 'likert', 'Tengo Habilidades específicas en el campo de las matemáticas y las ciencias ciencias', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 30, 'likert', 'Pienso que la mejor forma de resolver un problema es siendo analítico', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 31, 'likert', 'Me inclino hacia la crítica en todos los asuntos.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 32, 'likert', 'Tengo habilidades para solucionar problemas complejos de manera lógica.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 33, 'likert', 'Antes de tomar algo como verdadero, lo compruebo, e indago otras fuentes.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 34, 'likert', 'Tengo capacidad de comprender, y manipular números y estadísticas de acuerdo con un fin.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 35, 'likert', 'Me gusta solucionar problemas inclinándome  a conocerlos y buscar mediciones exactas.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 36, 'likert', 'Tengo la capacidad frente a los problemas de razonar en forma deductiva, a partir de alguna teoría.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 37, 'likert', 'Ante un problema; al descomponer las ideas las relaciono con la totalidad.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 38, 'likert', 'Selecciono alternativas sobre la base de la razón-inteligencia; en oposición al instinto, a la emoción.', 'A',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 39, 'likert', 'La planificación y la organización son prioritarias en mis actividades', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 40, 'likert', 'Es importante para mí tener un lugar para cada cosa y cada cosa en su lugar', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 41, 'likert', 'Acostumbro escuchar las opiniones de los demás y hacer aclaraciones.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 42, 'likert', 'Prefiero las instrucciones específicas en lugar de aquellas generales que dejan muchos detalles opcionales.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 43, 'likert', 'Pongo mucha atención en los pequeños detalles o partes de un proyecto.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 44, 'likert', 'Tengo capacidad de control y dominio de mis emociones cuando elaboro un plan o proyecto.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 45, 'likert', 'Pienso que trabajar con un método paso a paso es la mejor manera de resolver mi problema.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 46, 'likert', 'Tengo habilidades específicas en el manejo de auditorio o hablar en público.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 47, 'likert', 'Formulo métodos o medios para alcanzar un fin deseado, antes de pasar a la acción.', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 48, 'likert', 'Tengo la capacidad de coordinar a las personas o de ordenar los elementos para lograr relaciones coherentes y armoniosas', 'B',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 49, 'likert', 'Prefiero trabajar en equipo que hacerlo solo.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 50, 'likert', 'Es importante para mí estar en muchas oportunidades acompañado.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 51, 'likert', 'Creo en la trascendencia humana, en algo superior o espiritual', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 52, 'likert', 'Soy emotivo frente a las situaciones difíciles.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 53, 'likert', 'A menudo actúo para solucionar problemas de tipo social.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 54, 'likert', 'En muchas ocasiones prima más en mis decisiones, lo emotivo que lo lógico y lo racional.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 55, 'likert', 'Disfruto, observo y me emociono frente a la belleza de la naturaleza.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 56, 'likert', 'Tengo habilidades para percibir, entender, manipular posiciones relativas de los objetos en el espacio.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 57, 'likert', 'Utilizo todos mis sentidos con frecuencia para resolver problemas (olfato, vista, gusto, tacto, oído)', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 58, 'likert', 'Tengo la capacidad de desarrollar y mantener buena comunicación con diferentes tipos de personas.', 'C',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 59, 'likert', 'Tengo interés muy fuerte o talento para pintar, dibujar, esquematizar, con la música, poesía, escultura, etc.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 60, 'likert', 'Tengo la capacidad de razonar en forma avanzada y creativa, siendo capaz de adquirir, modificar y retener conocimientos.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 61, 'likert', 'Produzco nuevas ideas e innovaciones en mi trabajo.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 62, 'likert', 'Tengo la capacidad de entender y hacer uso de imágenes visuales y verbales para representar semejanzas y diferencias.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 63, 'likert', 'Tengo la capacidad de percibir y entender una problemática global sin entrar en el detalle de los elementos que la componen.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 64, 'likert', 'A menudo mis mejores ideas se producen cuando no estoy haciendo nada en particular', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 65, 'likert', 'Prefiero ser conocido y recordado como una persona imaginativa y fantasiosa.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 66, 'likert', 'Puedo frecuentemente anticiparme a la solución de los problemas.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 67, 'likert', 'Tengo la capacidad de utilizar o comprender objetos, símbolos y señales complejas.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);
insert into public.assessment_items (assessment_id, posicion, tipo, enunciado, escala, opciones) values
  (v_prueba, 68, 'likert', 'Utilizo el juego y el sentido del humor en muchas de mis actividades.', 'D',
   '[{"id":"1","texto":"1"},{"id":"2","texto":"2"},{"id":"3","texto":"3"},{"id":"4","texto":"4"},{"id":"5","texto":"5"}]'::jsonb);

-- =============================================================================
-- Qué devuelve el instrumento
--
-- Son dos familias y por eso llevan sección: el informe las presenta separadas
-- porque son dos instrumentos aplicados en la misma sesión.
-- =============================================================================

-- Sección DISC: cuatro escalas, el código de segmentos y el patrón.
insert into public.assessment_parameters
  (assessment_id, clave, etiqueta, kind, posicion, seccion, computed, admite_nota)
values
  (v_prueba, 'D', 'Dominancia',  'numerico', 1, 'disc', true, true),
  (v_prueba, 'I', 'Influencia',  'numerico', 2, 'disc', true, true),
  (v_prueba, 'S', 'Serenidad',   'numerico', 3, 'disc', true, true),
  (v_prueba, 'C', 'Conciencia',  'numerico', 4, 'disc', true, true),
  (v_prueba, 'segmentos', 'Código de segmentos', 'categoria', 5, 'disc', true, false),
  (v_prueba, 'patron',    'Patrón clásico',      'categoria', 6, 'disc', true, false),
  (v_prueba, 'resumen',   'Resumen del perfil',  'texto',     7, 'disc', true, true);

-- Los nueve apartados que el informe redacta para el patrón obtenido. El motor
-- propone la redacción normalizada; el profesional la corrige y firma.
insert into public.assessment_parameters
  (assessment_id, clave, etiqueta, kind, posicion, seccion, computed, admite_nota)
values
  (v_prueba, 'emociones',       'Emociones',                          'texto',  8, 'disc', true, true),
  (v_prueba, 'meta',            'Meta',                               'texto',  9, 'disc', true, true),
  (v_prueba, 'juzga',           'Juzga a los otros según',            'texto', 10, 'disc', true, true),
  (v_prueba, 'influye',         'Influye en otras personas mediante', 'texto', 11, 'disc', true, true),
  (v_prueba, 'valor',           'Su valor para la organización',      'texto', 12, 'disc', true, true),
  (v_prueba, 'abusa',           'Abusa de',                           'texto', 13, 'disc', true, true),
  (v_prueba, 'bajo_presion',    'Bajo presión',                       'texto', 14, 'disc', true, true),
  (v_prueba, 'teme',            'Teme',                               'texto', 15, 'disc', true, true),
  (v_prueba, 'mas_efectivo',    'Sería más efectivo(a) si',           'texto', 16, 'disc', true, true);

-- Sección de dominancia cerebral: los cuatro cuadrantes y el perfil que
-- resulta de ordenarlos.
insert into public.assessment_parameters
  (assessment_id, clave, etiqueta, kind, posicion, seccion, computed, admite_nota)
values
  (v_prueba, 'cuadrante_a', 'Cuadrante A · Lógico y analítico',        'numerico', 17, 'dominancia', true, true),
  (v_prueba, 'cuadrante_b', 'Cuadrante B · Organizado y secuencial',   'numerico', 18, 'dominancia', true, true),
  (v_prueba, 'cuadrante_c', 'Cuadrante C · Interpersonal y emocional', 'numerico', 19, 'dominancia', true, true),
  (v_prueba, 'cuadrante_d', 'Cuadrante D · Creativo y conceptual',     'numerico', 20, 'dominancia', true, true),
  (v_prueba, 'neurolateral', 'Perfil neurolateral de preferencia',     'categoria', 21, 'dominancia', true, false);

-- Recomendación del profesional. No la calcula nadie: la escribe él.
insert into public.assessment_parameters
  (assessment_id, clave, etiqueta, kind, posicion, seccion, computed, admite_nota)
values
  (v_prueba, 'recomendacion', 'Recomendación profesional', 'texto', 22, null, false, true);

-- =============================================================================
-- Textos normalizados
--
-- Los que aparecen en el informe de muestra. Faltan los de los demás patrones
-- y los de los tramos que la muestra no cubría; se añaden como filas cuando el
-- profesional los aporte, sin tocar el código.
-- =============================================================================
insert into public.assessment_texts (assessment_id, parameter_key, nivel, cuerpo) values
  (v_prueba, 'D', null, 'Las personas con un estilo de comportamiento Dominante están orientadas a la acción y a los resultados. Son directas, firmes y decididas. Les gusta tener el control, asumir responsabilidades y enfrentar desafíos.'),
  (v_prueba, 'I', null, 'Las personas con un estilo de comportamiento de Influencia son sociables, entusiastas y optimistas. Les encanta interactuar con los demás y tienen una gran capacidad para persuadir y motivar.'),
  (v_prueba, 'S', null, 'Las personas con un estilo de comportamiento de Estabilidad son tranquilas, pacientes y leales. Valoran la seguridad, la cooperación y la armonía. Prefieren los ambientes predecibles y sin conflictos.'),
  (v_prueba, 'C', null, 'Las personas con un estilo de comportamiento de Conciencia son analíticas, precisas y lógicas. Se enfocan en los detalles, la calidad y el cumplimiento de las normas y procedimientos.'),
  (v_prueba, 'cuadrante_a', null, 'Perfil Lógico, Analítico y Cuantitativo. Valora la precisión, el análisis de datos y la resolución de problemas de forma crítica y racional.'),
  (v_prueba, 'cuadrante_b', null, 'Perfil Organizado, Secuencial y Detallista. Práctico, metódico, planificado y orientado a los procedimientos y el control.'),
  (v_prueba, 'cuadrante_c', null, 'Perfil Interpersonal, Emocional y Relacional. Sensible y empático; se enfoca en el trabajo en equipo, la comunicación y la cohesión grupal.'),
  (v_prueba, 'cuadrante_d', null, 'Perfil Global, Creativo y Conceptual. Visión holística, innovadora, intuitiva y visual; cómodo con la ambigüedad y con perspectiva de futuro.');

end $$;
