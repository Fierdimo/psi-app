-- =============================================================================
-- 0020 · Los textos del informe, tal como los redacta la consulta
--
-- Extraídos del informe de muestra que aporta el titular. Son CONTENIDO: viven
-- en la base para que se corrijan sin desplegar código.
--
-- Los puntos de corte que los seleccionan van en el motor, porque eso es
-- baremación. Quedan aquí anotados para que se vean juntos:
--
--   Escalas DISC (0 a 7)       bajo 0-2 · medio 3-5 · alto 6-7
--   Cuadrantes cerebrales      terciario 0-59 · secundario 60-79 · primario 80-100
--
-- `nivel` hace doble papel, y es deliberado: en un parámetro de escala guarda
-- el tramo («medio»); en uno narrativo guarda el PATRÓN al que pertenece el
-- texto («Especialista»). Es la misma pregunta —¿cuál de las variantes de este
-- parámetro toca?— y no merecía dos tablas.
-- =============================================================================

do $$
declare
  v_prueba uuid;
begin

select id into v_prueba from public.assessments where clave = 'disc_dominancia';

-- -----------------------------------------------------------------------------
-- Interpretación por tramo de cada escala DISC
-- -----------------------------------------------------------------------------
insert into public.assessment_texts (assessment_id, parameter_key, nivel, cuerpo) values
  (v_prueba, 'D', 'medio', 'Asertividad Situacional Baja. En este nivel, la persona puede ser asertiva en momentos puntuales, generalmente cuando se siente muy segura de su posición o cuando la situación lo requiere de manera evidente. Sin embargo, no es una característica dominante de su comportamiento. Puede dudar en expresar sus opiniones si percibe resistencia o si no se siente completamente respaldada.'),
  (v_prueba, 'I', 'bajo', 'Interacción Social Selectiva. Aquí, la persona disfruta de conexiones profundas con un círculo reducido de personas y prefiere comunicaciones directas y significativas. Evita las interacciones superficiales y no busca activamente ampliar su red social. Su expresividad emocional es moderada y reservada para personas de confianza.'),
  (v_prueba, 'S', 'alto', 'En este nivel, la persona prefiere la continuidad, la rutina y los métodos probados. Puede sentirse incómoda o ansiosa ante los cambios significativos y puede resistirse a las alteraciones de lo establecido.'),
  (v_prueba, 'C', 'medio', 'Este punto representa una persona que presta atención a la calidad, la exactitud y la organización en su trabajo, pero sin caer en el perfeccionismo paralizante. Busca un equilibrio entre la eficiencia y el cumplimiento de los estándares.');

-- -----------------------------------------------------------------------------
-- Interpretación por tramo de cada cuadrante cerebral
-- -----------------------------------------------------------------------------
insert into public.assessment_texts (assessment_id, parameter_key, nivel, cuerpo) values
  (v_prueba, 'cuadrante_a', 'secundario', 'El Analista Ocasional. Puede aplicar la lógica y el rigor cuando es necesario para validar información, pero no se sumerge en el detalle cuantitativo. Utiliza el pensamiento analítico como una herramienta funcional sin que sea su motor principal.'),
  (v_prueba, 'cuadrante_b', 'primario', 'El Guardián del Orden. La persona está orientada a la ejecución metódica. Demuestra una adhesión estricta a las reglas, planifica minuciosamente, y es implacable en el seguimiento de procedimientos. Es responsable, puntual y prefiere la estabilidad.'),
  (v_prueba, 'cuadrante_c', 'secundario', 'El Colaborador Comprometido. Disfruta del trabajo en equipo y tiene buenas habilidades sociales, pero equilibra las relaciones con otros intereses. Puede ser un buen mentor o comunicador, sin que el bienestar grupal consuma toda su energía.'),
  (v_prueba, 'cuadrante_d', 'secundario', 'El Generador de Ideas. Es capaz de hacer brainstorming y contribuir con creatividad, pero necesita un marco práctico (B) o lógico (A) para aterrizar esas ideas. Se interesa por los conceptos, pero no permanece indefinidamente en el mundo teórico.');

-- -----------------------------------------------------------------------------
-- El patrón clásico: los nueve apartados y el resumen
--
-- Solo se conoce el del Especialista, que es el que trae el informe de
-- muestra. Los demás patrones se añaden como filas, sin tocar código: por eso
-- estos textos son datos.
-- -----------------------------------------------------------------------------
insert into public.assessment_texts (assessment_id, parameter_key, nivel, cuerpo) values
  (v_prueba, 'resumen', 'Especialista',
   'El Especialista se «lleva bien» con los demás. Por su actitud moderada y controlada y por su comportamiento modesto, puede trabajar en armonía con diversos estilos de conducta. El Especialista es considerado paciente y siempre está dispuesto a ayudar a quienes considera sus amigos. De hecho, tiende a desarrollar en el trabajo una estrecha relación con un grupo relativamente reducido de compañeros.

Se esfuerza por conservar pautas de comportamiento conocidos y predecibles. El Especialista, al ser bastante eficiente en áreas especializadas, planea su trabajo, lo enfoca de manera clara y directa y consigue una notoria constancia en su desempeño. El reconocimiento que recibe de los demás le ayuda a conservar este nivel.

El Especialista es lento para adaptarse a los cambios. Una preparación previa le concede el tiempo que requiere para cambiar sus procedimientos y conservar su nivel de rendimiento. El Especialista puede necesitar ayuda al inicio de un nuevo proyecto y para desarrollar métodos prácticos y sencillos para cubrir plazos establecidos. Suele dejar a un lado los proyectos terminados para posteriormente concluirlos.'),
  (v_prueba, 'emociones',    'Especialista', 'Moderación calculada; afán de servir, de adaptarse a los demás.'),
  (v_prueba, 'meta',         'Especialista', 'Conservar el «status quo», controlar el ambiente.'),
  (v_prueba, 'juzga',        'Especialista', 'Las normas de amistad, después por su capacidad.'),
  (v_prueba, 'influye',      'Especialista', 'Su constancia en el desempeño; por su afán de servir, de adaptarse a las necesidades de los demás.'),
  (v_prueba, 'valor',        'Especialista', 'Planifica a corto plazo; es predecible, es congruente; mantiene un ritmo uniforme y seguro.'),
  (v_prueba, 'abusa',        'Especialista', 'La modestia; su miedo a correr riesgos; su resistencia pasiva hacia las innovaciones.'),
  (v_prueba, 'bajo_presion', 'Especialista', 'Se adapta a quienes tienen autoridad y a lo que opina el grupo.'),
  (v_prueba, 'teme',         'Especialista', 'Los cambios; la desorganización.'),
  (v_prueba, 'mas_efectivo', 'Especialista', 'Compartiera más sus ideas; aumentara su confianza en sí mismo basándose en la retroalimentación que recibe; utilizara métodos más sencillos y directos.');

end $$;
