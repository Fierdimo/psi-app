-- =============================================================================
-- 0027 · Los apartados del informe, con su etiqueta CORRECTA
--
-- CORRIGE UN FALLO DE LA MIGRACIÓN 0021, que era mío y salía impreso en el
-- informe de una persona.
--
-- La fila de cabeceras de la hoja está CORRIDA UNA COLUMNA a partir de la
-- séptima: le falta «INFLUYE EN OTRAS PERSONAS MEDIANTE». Al importar me fié
-- de esas cabeceras, así que seis apartados quedaron con el título de otro:
--
--   se guardó como…      cuando en realidad era…
--   valor                influye
--   abusa                valor
--   bajo_presion         abusa
--   teme                 bajo_presion
--   mas_efectivo         teme
--   resumen              mas_efectivo
--
-- Y el resumen se quedaba con un solo párrafo de los tres, porque los otros
-- dos van rotulados «CONCEPTO 2» y «CONVEPTO 3».
--
-- El informe original de la consulta SÍ los lee bien: busca por POSICIÓN y no
-- por título, así que el error vivía solo en la cabecera y solo mordía a quien
-- se fiara de ella. Yo me fié.
--
-- Se vio leyendo el informe publicado en pantalla: «Resumen del perfil»
-- mostraba el texto de «Sería más efectivo si». Ninguna prueba podía cazarlo,
-- porque todas comprueban que el texto LLEGA, no que sea EL SUYO.
-- =============================================================================

do $$
declare
  v_p uuid;
begin

select id into v_p from public.assessments where clave = 'disc_dominancia';

delete from public.assessment_texts
where assessment_id = v_p
  and parameter_key in ('emociones','meta','juzga','influye','valor','abusa',
                        'bajo_presion','teme','mas_efectivo','resumen','concepto');

insert into public.assessment_texts (assessment_id, parameter_key, nivel, cuerpo) values
  (v_p, 'emociones', 'PATRON DEL ALENTADOR', 'Acepta la agresión, tiende a aparentar dar poca importancia a la necesidad que tiene de afecto.'),
  (v_p, 'meta', 'PATRON DEL ALENTADOR', 'Controlar su ambiente o a su público.'),
  (v_p, 'juzga', 'PATRON DEL ALENTADOR', 'La forma en que proyecta su fuerza personal, carácter y posición social.'),
  (v_p, 'influye', 'PATRON DEL ALENTADOR', 'Su encanto, dirección, intimidación , uso de recompensas.'),
  (v_p, 'valor', 'PATRON DEL ALENTADOR', 'Mueve a la gente, inicia, ordena, felicita disciplina.'),
  (v_p, 'abusa', 'PATRON DEL ALENTADOR', 'Su enfoque de que “el fin justifica los medios”.'),
  (v_p, 'bajo_presion', 'PATRON DEL ALENTADOR', 'Se vuelve manipulador, pendenciero, beligerante.'),
  (v_p, 'teme', 'PATRON DEL ALENTADOR', 'Ser demasiado blando, perder su posición social.'),
  (v_p, 'mas_efectivo', 'PATRON DEL ALENTADOR', 'Fuera más genuina su sensibilidad; estuviera más dispuesto a ayudar a otros a tener éxito en su propio desarrollo personal.'),
  (v_p, 'resumen', 'PATRON DEL ALENTADOR', 'Las personas con patrón alentador saben con exactitud los resultados que quieren, pero no siempre los verbalizan de inmediato. Manifiestan cuáles son los resultados que quieren sólo después de que se haya creado un ambiente apropiado y la otra persona está dispuesta a aceptarlos. Por ejemplo, estas personas ofrecen amistad a quienes desean ser aceptados, más autoridad a quienes buscan poder y seguridad a quienes buscan un ambiente predecible.

El alentador pude ser encantador en su trato con los demás. Es persuasivo para obtener ayuda cuando se le presentan detalles repetitivos y que consumen mucho tiempo. Sin embargo, las personas a menudo experimentan ante ellos una sensación de conflicto, al sentirse por un lado atraídos, y curiosamente al mismo tiempo distanciados. Otras pueden sentirse “utilizadas”. Aunque algunas veces el alentador inspira temor en los demás y rechaza sus decisiones, el Alentador suele ser apreciado por sus colaboradores. Esto lo consigue al usar siempre que le es posible su enorme capacidad de palabra para persuadir. El Alentador prefiere alcanzar sus objetivos no dominando a las personas sino haciendo de agente para realizar el trabajo.'),
  (v_p, 'emociones', 'PATRON DEL REALIZADOR', 'Activo, diligente, muestra frustración..'),
  (v_p, 'meta', 'PATRON DEL REALIZADOR', 'Logros personales, en ocasiones a expensas de la meta de grupo.'),
  (v_p, 'juzga', 'PATRON DEL REALIZADOR', 'El logro de resultados concretos.'),
  (v_p, 'influye', 'PATRON DEL REALIZADOR', 'La aceptación de responsabilidad por su propio trabajo.'),
  (v_p, 'valor', 'PATRON DEL REALIZADOR', 'Se propone y consigue resultados en áreas clave.'),
  (v_p, 'abusa', 'PATRON DEL REALIZADOR', 'Confianza en si mismo, absorción en el trabajo.'),
  (v_p, 'bajo_presion', 'PATRON DEL REALIZADOR', 'Se frustra e impacienta con los demás, se convierte en una persona que “lo hace todo” en vez de ser alguien que delega.'),
  (v_p, 'teme', 'PATRON DEL REALIZADOR', 'A quienes tienen niveles inferiores o competitivos de trabajo, que afectan los resultados.'),
  (v_p, 'mas_efectivo', 'PATRON DEL REALIZADOR', 'Dejara de pensar en “esto o lo otro”, estableciera su prioridades con mayor claridad y aceptara enfoques alternativos, estuviera dispuesto a sacrificar los beneficios a corto plazo por otros a largo plazo.'),
  (v_p, 'resumen', 'PATRON DEL REALIZADOR', 'La motivación del Patrón Realizador surge en gran parte de su interior y de metas personales muy profundas. Este compromiso previo con sus propias metas impide que acepte automáticamente las metas del grupo. El Realizador necesita combinar sus metas personales con las metas de la organización. Como el Realizador siempre ha ejercido control sobre los aspectos más importantes de su vida, desarrolla a menudo un fuerte sentido de la responsabilidad.

El Realizador demuestra un profundo interés por su trabajo y un continuo e intenso afán por conseguir lo que se propone. Tiene una alta opinión de su trabajo y suele realizar las cosas por él mismo para asegurarse de que todo esté bien hecho. Valora el trabajo arduo y bajo presión “prefiere hacer” que delegar en otro. Cuando delega algo, suele volver ha realizarlo si no satisface sus expectativas. Su premisa dice: “si tengo éxito, el mérito me corresponde, pero si fracaso, asumo la responsabilidad”.

Si el Realizador se comunica más con los demás dejaría de pensar en “esto o lo otro”, del “yo mismo lo tengo que hacer” o “quiero todo el crédito para mí”. Tal vez necesite ayuda para considerar otras propuestas y conseguir los resultados que desea. El Realizador sabe que funciona al máximo de su capacidad y espera un reconocimiento similar a su contribución, en ciertas organizaciones mediante ganancias elevadas y en otras con posiciones de mando.'),
  (v_p, 'emociones', 'PATRON DEL PERFECCIONISTA', 'Competente para hacer bien las cosas, reservado, cauteloso.'),
  (v_p, 'meta', 'PATRON DEL PERFECCIONISTA', 'Logros estables, predecible.'),
  (v_p, 'juzga', 'PATRON DEL PERFECCIONISTA', 'Normas precisas.'),
  (v_p, 'influye', 'PATRON DEL PERFECCIONISTA', 'La atención al detalle y precisión.'),
  (v_p, 'valor', 'PATRON DEL PERFECCIONISTA', 'Concienzudo, conserva las normas, control de calidad.'),
  (v_p, 'abusa', 'PATRON DEL PERFECCIONISTA', 'Los procedimientos y controles excesivos para evitar las fallas, depende demasiado de la gente, productos y procesos que le funcionaron en el pasado.'),
  (v_p, 'bajo_presion', 'PATRON DEL PERFECCIONISTA', 'Es discreto, diplomático.'),
  (v_p, 'teme', 'PATRON DEL PERFECCIONISTA', 'El antagonismo.'),
  (v_p, 'mas_efectivo', 'PATRON DEL PERFECCIONISTA', 'Fuera más flexible en su papel, fuera más independiente e interdependiente, tuviera más fe en sí mismo y si se viera a sí mismo como una persona valiosa.'),
  (v_p, 'resumen', 'PATRON DEL PERFECCIONISTA', 'El Perfeccionista es metódico y preciso en su forma de pensar y trabajar, por lo que suele seguir procedimientos ordenados tanto en su vida personal como laboral. Es extremadamente concienzudo y se esmera en el trabajo detallado y preciso. El Perfeccionista desea condiciones estables y actividades fáciles de predecir, por lo que se siente cómodo en un ambiente laboral claramente definido. Desea claridad respecto a lo que se espera de él en el trabajo, de cuánto tiempo dispone y cómo se va a evaluar su trabajo.

El perfeccionista se puede empantanar en los detalles cuando tiene que tomar decisiones. Sabe tomar decisiones importantes, pero se le puede criticar por el tiempo que le toma reunir y analizar la información antes de decidir. Aunque le agrada conocer la opinión de sus superiores, el Perfeccionista es capaz de arriesgarse cuando cuenta con datos que puede interpretar y usar para sacar conclusiones propias.

El Perfeccionista se evalúa y evalúa a los demás bajo normas precisas que aseguren resultados concretos y se adhiere a procedimientos operativos normales. Para la organización es valiosa esta atención concienzuda a las normas y calidad, sin embargo, el Perfeccionista tiende a definir su valor más por lo que hace que por lo que es como persona. Por lo tanto, suele reaccionar a los cumplidos personales con la idea de que: “¿Qué querrá esta persona?” , si aceptará un cumplido sincero por quien es, podría aumentar su confianza en sí mismo.'),
  (v_p, 'emociones', 'PATRON DEL CREATIVO', 'Acepta la agresión, puede contenerse al expresarse.'),
  (v_p, 'meta', 'PATRON DEL CREATIVO', 'Dominar, logros únicos.'),
  (v_p, 'juzga', 'PATRON DEL CREATIVO', 'Sus propias normas, las ideas progresivas al llevar a cabo el trabajo.'),
  (v_p, 'influye', 'PATRON DEL CREATIVO', 'El establecimiento de un ritmo a seguir para desarrollar sistemas y enfoques innovadores.'),
  (v_p, 'valor', 'PATRON DEL CREATIVO', 'El iniciar o diseñar cambios.'),
  (v_p, 'abusa', 'PATRON DEL CREATIVO', 'La brusquedad, la actitud crítica o condescendiente.'),
  (v_p, 'bajo_presion', 'PATRON DEL CREATIVO', 'Se aburre fácilmente con el trabajo rutinario, cuando se le restringe se torna malhumorado, es independiente.'),
  (v_p, 'teme', 'PATRON DEL CREATIVO', 'No poder influir, no alcanzar el nivel establecido.'),
  (v_p, 'mas_efectivo', 'PATRON DEL CREATIVO', 'Fuera más amable, usara más tacto al comunicarse, cooperara más con el equipo, reconociera que existen sanciones.'),
  (v_p, 'resumen', 'PATRON DEL CREATIVO', 'Las personas con un Patrón Creativo muestran dos fuerzas opuestas en su comportamiento. El deseo de resultados tangibles se contrapone a un impulso de igual magnitud por la perfección. Su agresividad se templa con su sensibilidad. La rapidez de pensamiento y tiempo de reacción se ven frenados por el deseo de explorar todas las soluciones posibles antes de tomar una decisión.

Las personas creativas preveen de manera extraordinaria el enfoque que hay que dar a un proyecto y efectúan los cambios oportunos. En vista de que las personas con un Patrón Creativo son perfeccionistas y cuentan con una gran habilidad para planear, los cambios que efectúan suelen ser apropiados, aunque les pueda faltar atención a las relaciones interpersonales.

La persona creativa desea libertad para explorar y la autoridad para examinar y verificar los resultados. Puede tomar las decisiones diarias con rapidez, pero puede ser extremadamente cauteloso al tomar decisiones de verdadera importancia. “¿Debería aceptar este ascenso?”, “¿debería mudarme a otro sitio?”. Por su necesidad de obtener resultados y perfección, la persona creativa no se preocupa mucho por las formas sociales. Puede parecer fría, ajena y brusca.'),
  (v_p, 'emociones', 'PATRON DEL OBJETIVO', 'Puede rechazar la agresión interpersonal.'),
  (v_p, 'meta', 'PATRON DEL OBJETIVO', 'La exactitud.'),
  (v_p, 'juzga', 'PATRON DEL OBJETIVO', 'Su capacidad de pensamiento analítico.'),
  (v_p, 'influye', 'PATRON DEL OBJETIVO', 'La información objetiva, los argumentos lógicos.'),
  (v_p, 'valor', 'PATRON DEL OBJETIVO', 'Define, esclarece, obtiene información, evalúa, comprueba.'),
  (v_p, 'abusa', 'PATRON DEL OBJETIVO', 'El análisis.'),
  (v_p, 'bajo_presion', 'PATRON DEL OBJETIVO', 'Se vuelve aprensivo.'),
  (v_p, 'teme', 'PATRON DEL OBJETIVO', 'Actos irracionales, el ridículo.'),
  (v_p, 'mas_efectivo', 'PATRON DEL OBJETIVO', 'Fuera más abierto, compartiera en público su perspicacia y opiniones.'),
  (v_p, 'resumen', 'PATRON DEL OBJETIVO', 'La capacidad de pensamiento crítico suele estar muy desarrollada en el Objetivo. Recalca la importancia de sacar conclusiones y basar las acciones en hechos. Busca la precisión y exactitud en todo lo que hace. Sin embargo, para llevar a cabo con eficiencia su trabajo, el Objetivo suele combinar la información intuitiva con los datos que posee. Cuando duda sobre el curso a tomar, evita hacer el ridículo preparándose meticulosamente. Por ejemplo, el Objetivo perfeccionará una nueva habilidad en privado antes de usarla en alguna actividad de grupo.

El Objetivo prefiere trabajar con personas que , como él, prefieren mantener un ambiente laboral tranquilo. Como puede mostrarse reticente en expresar sus sentimiento, hay quienes lo consideran tímido. Se siente particularmente incómodo ante personas agresivas. A pesar de esta apariencia templada, el Objetivo tiene un fuerte necesidad de controlar el ambiente. Suele ejercer este control en forma indirecta solicitando el apego a reglas y normas.

El Objetivo se preocupa por llegar a respuestas “correctas” y le puede resultar difícil tomar decisiones en situaciones ambiguas. Su tendencia a preocuparse le puede llevar a una “parálisis por análisis”. Con demasiada frecuencia, cuando comete un error, titubea en reconocerlo y se empreña en buscar información que le permita apoyar su postura.'),
  (v_p, 'emociones', 'PATRON DEL PERSUASIVO', 'Confía en los demás es entusiasta.'),
  (v_p, 'meta', 'PATRON DEL PERSUASIVO', 'Autoridad y prestigio; diversos símbolos de prestigio.'),
  (v_p, 'juzga', 'PATRON DEL PERSUASIVO', 'Su capacidad de expresión verbal; su flexibilidad.'),
  (v_p, 'influye', 'PATRON DEL PERSUASIVO', 'Un comportamiento amistoso; franqueza; habilidad en su expresión verbal.'),
  (v_p, 'valor', 'PATRON DEL PERSUASIVO', 'Sabe vender y cerrar tratos; delega responsabilidades; sereno, seguridad en sí mismo.'),
  (v_p, 'abusa', 'PATRON DEL PERSUASIVO', 'Su entusiasmo; su habilidad para vender; su optimismo.'),
  (v_p, 'bajo_presion', 'PATRON DEL PERSUASIVO', 'Es discreto, diplomático.'),
  (v_p, 'teme', 'PATRON DEL PERSUASIVO', 'Un ambiente inalterable; relaciones complejas.'),
  (v_p, 'mas_efectivo', 'PATRON DEL PERSUASIVO', 'Se le asignaran tareas que le impliquen un reto; prestara más atención al servicio y detalles elementales clave para el trabajo; hiciera un análisis objetivo de la información.'),
  (v_p, 'resumen', 'PATRON DEL PERSUASIVO', 'El persuasivo trabaja con y a través de otros. Esto es, se esfuerza por hacer negocios en forma amistosa al mismo tiempo que pugna por alcanzar sus propios objetivos. El Persuasivo, al ser franco por naturaleza y mostrar interés por las personas, se gana el respeto y confianza de diversos tipos de personas. El Persuasivo tiene la capacidad de convencer a los demás de su punto de vista, no sólo los conquista, también los retiene como clientes o amigos. Esta habilidad les es particularmente útil para obtener puestos de autoridad al venderse a sí mismos y sus ideas.

El trabajo con gente, las tareas que le suponen un reto y la variedad de trabajos y actividades que impliquen movilidad , proporcionan un ambiente favorable para el Persuasivo. Además, suele buscar tareas laborales que le proporcionen oportunidades de quedar bien. Como resultado de su entusiasmo natural, el persuasivo tiende a ser demasiado optimista respecto a los resultados de los proyectos y el potencial de otras personas. El Persuasivo también suele sobreestimar su capacidad de cambiar el comportamiento de los demás.

Al mismo tiempo que rechaza las rutinas y reglamentos, el Persuasivo necesita que se le proporcione información analítica de manera sistemática y periódica. Cuando se le hace ver la importancia de los “pequeños detalles”, la información adecuada les ayuda a equilibrar su entusiasmo con una evaluación realista de la situación.'),
  (v_p, 'emociones', 'PATRON DEL PROMOTOR', 'Dispuesto a aceptar a los demás.'),
  (v_p, 'meta', 'PATRON DEL PROMOTOR', 'Aprobación, popularidad.'),
  (v_p, 'juzga', 'PATRON DEL PROMOTOR', 'Su forma de expresarse.'),
  (v_p, 'influye', 'PATRON DEL PROMOTOR', 'Alabanzas, oportunidades, haciendo favores.'),
  (v_p, 'valor', 'PATRON DEL PROMOTOR', 'Alivia tensiones; promueve proyectos y personas, incluso a sí mismo.'),
  (v_p, 'abusa', 'PATRON DEL PROMOTOR', 'Los elogios, optimismo.'),
  (v_p, 'bajo_presion', 'PATRON DEL PROMOTOR', 'Descuidado y sentimental; actúa en forma desorganizada; no sabe cómo llevar a cabo las cosas.'),
  (v_p, 'teme', 'PATRON DEL PROMOTOR', 'Perder aceptación social y su autoestima.'),
  (v_p, 'mas_efectivo', 'PATRON DEL PROMOTOR', 'Tuviera más control del tiempo; fuera más objetivo; fuera más sensible a lo que significa “urgente”, controlara sus emociones; cumpliera hasta el final sus promesas, tareas.'),
  (v_p, 'resumen', 'PATRON DEL PROMOTOR', 'El promotor cuenta con una extensa red de contactos que le proporciona una base activa para realizar sus negocios. Gregario y sociable, le es fácil hacer amigos. Rara vez se opone intencionalmente a alguien. El promotor busca ambientes socialmente favorables donde pueda continuar desarrollando y conservando sus contactos. Con su excelente capacidad de palabra, promueve muy bien sus propias ideas y genera entusiasmo hacia proyectos ajenos. Gracias a su amplia esfera de contactos, el Promotor tiene acceso a las personas apropiadas cuando necesita ayuda.

En vista de que el promotor prefiere por naturaleza la interacción con otros y participa en actividades que implican contacto con gente, se interesa menos en la realización del trabajo. Aunque su trabajo imponga actividades solitarias, seguirá buscando situaciones que impliquen reuniones y vida social activa. Le agrada participar en reuniones, comités y conferencias.

Por su optimismo natural, el Promotor tiende a sobreestimar la capacidad de los demás. Suele llegar a conclusiones favorables sin haber considerado todos los hechos. Con entrenamiento y dirección adecuados se puede ayudar al Promotor a desarrollar objetividad y a dar la importancia debida a los resultados. Planear y controlar el tiempo le puede significar un reto. Le conviene limitar el tiempo dedicado a conversar y de esta manera recordarse a sí mismo la urgencia de “concluir” y llevar a término una tarea.'),
  (v_p, 'emociones', 'PATRON DEL CONSEJERO', 'Es fácil de abordar, afectuoso y comprensivo.'),
  (v_p, 'meta', 'PATRON DEL CONSEJERO', 'La amistad; la felicidad.'),
  (v_p, 'juzga', 'PATRON DEL CONSEJERO', 'Su aceptación positiva; generalmente busca el lado bueno de las personas.'),
  (v_p, 'influye', 'PATRON DEL CONSEJERO', 'Las relaciones personales, al practicar la política de “puertas abiertas”.'),
  (v_p, 'valor', 'PATRON DEL CONSEJERO', 'Estable, predecible; una amplia esfera de amistades; sabe escuchar.'),
  (v_p, 'abusa', 'PATRON DEL CONSEJERO', 'Acercamiento indirecto, tolerancia.'),
  (v_p, 'bajo_presion', 'PATRON DEL CONSEJERO', 'Se torna demasiado flexible e íntimo; confía demasiado en todos sin distinción. .'),
  (v_p, 'teme', 'PATRON DEL CONSEJERO', 'Presionar a los demás; que se le acuse de hacer daño.'),
  (v_p, 'mas_efectivo', 'PATRON DEL CONSEJERO', 'Presenta más atención a las fechas límite; tuviera más iniciativa para realizar el trabajo.'),
  (v_p, 'resumen', 'PATRON DEL CONSEJERO', 'El Consejero tiene el don particular de resolver los problemas de los demás. Impresiona con su afecto, empatía y comprensión. Al Consejero le es fácil encontrar lo bueno en las personas y asume una actitud optimista. El consejero prefiere tratar con la gente sobre la base de una relación íntima. Al saber escuchar, en especial a los problemas, es discreto en sus sugerencias y no trata de imponer sus ideas a los demás.

El Consejero suele ser en extremo tolerante y paciente con las personas que no rinden en el trabajo. Bajo presión, se le dificulta confrontar los problemas de desempeño en forma directa. Suele ser demasiado indirecto para ordenar, exigir o disciplinar a otros. Con su actitud de que la “gente es importante”, el Consejero suele dar menos importancia al rendimiento. En ocasiones requiere ayuda para fijar y cumplir fechas límites realistas.

A menudo, el Consejero toma la crítica como una afrenta personal, pero responde en forma positiva si recibe atención y cumplidos por un trabajo bien hecho. Cuando tiene un puesto de responsabilidad, suele prestar atención a la calidad de las condiciones de trabajo y proporcionar reconocimiento adecuado a los miembros de su equipo.'),
  (v_p, 'emociones', 'PATRON DEL AGENTE', 'Acepta el afecto; rechaza la agresión.'),
  (v_p, 'meta', 'PATRON DEL AGENTE', 'Ser aceptado por los demás.'),
  (v_p, 'juzga', 'PATRON DEL AGENTE', 'La tolerancia y participación.'),
  (v_p, 'influye', 'PATRON DEL AGENTE', 'La Comprensión; amistad.'),
  (v_p, 'valor', 'PATRON DEL AGENTE', 'Apoya; armoniza; proyecta empatía; está orientado al servicio.'),
  (v_p, 'abusa', 'PATRON DEL AGENTE', 'La amabilidad.'),
  (v_p, 'bajo_presion', 'PATRON DEL AGENTE', 'Se vuelve persuasivo haciendo, si fuese necesario, uso de información que posee o de amistades clave.'),
  (v_p, 'teme', 'PATRON DEL AGENTE', 'El desacuerdo, el conflicto.'),
  (v_p, 'mas_efectivo', 'PATRON DEL AGENTE', 'Tuviera más conciencia de quién es y de lo que puede hacer; mostrara más firmeza y agresividad; dijera “no” en los momentos adecuados.'),
  (v_p, 'resumen', 'PATRON DEL AGENTE', 'Al Agente le interesa tanto las relaciones humanas como los variados aspectos del trabajo. Gracias a su empatía y tolerancia sabe escuchar y se le conoce por su buena disposición. El Agente hace que los demás sientan que se les quiere y necesita. No hay quien tema ser rechazado por un Agente. Es más, el agente ofrece amistad y está dispuesto a ayudar.

En cuanto al trabajo, el Agente cuenta con un excelente potencial para la organización y eficiente ejecución. Es excelente en hacer para otros lo que ellos encuentran difícil de realizar. El Agente busca por naturaleza la armonía y cooperación en el grupo.

Sin embargo, el Agente teme el conflicto y desacuerdo. Su tendencia a ayudar puede instar a otros a tolerar una situación en lugar de buscar una solución del problema. Además, la tendencia del Agente a adoptar un perfil “bajo” en lugar de aceptar una confrontación franca con personas agresivas, lo que puede ser visto como una falta de “dureza”. A pesar de todo, el Agente cuenta con un buen nivel de independencia aunque le preocupa su integración en el grupo.'),
  (v_p, 'emociones', 'PATRON DEL EVALUADOR', 'Un fuerte impulso por causar buena impresión.'),
  (v_p, 'meta', 'PATRON DEL EVALUADOR', '“Ganar” con estilo.'),
  (v_p, 'juzga', 'PATRON DEL EVALUADOR', 'Su capacidad de tomar iniciativa.'),
  (v_p, 'influye', 'PATRON DEL EVALUADOR', 'Influye en los demás al: Hacerles competir por su reconocimiento.'),
  (v_p, 'valor', 'PATRON DEL EVALUADOR', 'Obtiene sus metas a través de los demás.'),
  (v_p, 'abusa', 'PATRON DEL EVALUADOR', 'Su autoridad e ingenio.'),
  (v_p, 'bajo_presion', 'PATRON DEL EVALUADOR', 'Se torna intranquilo; crítico; impaciente.'),
  (v_p, 'teme', 'PATRON DEL EVALUADOR', '“Perder”; quedar mal ante los demás.'),
  (v_p, 'mas_efectivo', 'PATRON DEL EVALUADOR', 'Llevara a cabo el seguimiento hasta el final; mostrara empatía al estar en desacuerdo; se marcara un ritmo más realista para sus actividades.'),
  (v_p, 'resumen', 'PATRON DEL EVALUADOR', 'El Evaluador toma las ideas creativas y las utiliza para fines prácticos. Es competitivo y usa métodos directos para conseguir resultados. Sin embargo, hay quienes consideran al Evaluador menos agresivo ya que suele mostrar consideración hacia los demás. En lugar de ordenar o mandar, el Evaluador involucra a las personas en el trabajo usando métodos persuasivos. Obtiene la cooperación de quienes le rodean al explicar la lógica de las actividades propuestas.

El Evaluador suele ser capaz de ayudar a los demás a visualizar los pasos necesarios para lograr resultados. Por lo general, habla de un plan de acción detallado que él mismo desarrollará para asegurar una progresión ordenada hacia los resultados. Sin embargo, en su afán de ganar, el Evaluador se puede impacientar cuando no se mantiene a los niveles establecidos o cuando se requiere mucho seguimiento.

El Evaluador tiene un pensamiento bastante analítico y es hábil para expresar en palabras sus críticas. Sus palabras pueden ser bastante hirientes. El Evaluador controla mejor la situación si se relaja y disminuye su ritmo de trabajo. Un axioma que le sería útil para lograrlo es: “algunas veces se gana y otras se pierde”.'),
  (v_p, 'emociones', 'PATRON DEL RESOLUTIVO', 'Individualista en lo que se refiere a sus necesidades personales.'),
  (v_p, 'meta', 'PATRON DEL RESOLUTIVO', 'Una nueva oportunidad; un nuevo reto.'),
  (v_p, 'juzga', 'PATRON DEL RESOLUTIVO', 'Su capacidad para alcanzar las normas establecidas por él mismo.'),
  (v_p, 'influye', 'PATRON DEL RESOLUTIVO', 'Las soluciones a los problemas; al proyectar una imagen de poder.'),
  (v_p, 'valor', 'PATRON DEL RESOLUTIVO', 'Acepta la responsabilidad, no dice “no es mi culpa”; ofrece formas nuevas e innovadoras de resolver problemas.'),
  (v_p, 'abusa', 'PATRON DEL RESOLUTIVO', 'Del control que ejerce sobre los demás en su afán de alcanzar sus propios resultados.'),
  (v_p, 'bajo_presion', 'PATRON DEL RESOLUTIVO', 'Se aparta cuando se tienen que hacer las cosas; se torna beligerante cuando ve su individualidad amenazada o se le cierran las puertas al reto.'),
  (v_p, 'teme', 'PATRON DEL RESOLUTIVO', 'Al aburrimiento; a la pérdida del control.'),
  (v_p, 'mas_efectivo', 'PATRON DEL RESOLUTIVO', 'Mostrara más paciencia, empatía; participara y colaborara con los demás; diera más seguimiento y atención a la importancia del control de calidad.'),
  (v_p, 'resumen', 'PATRON DEL RESOLUTIVO', 'El Resolutivo suele ser una persona fuertemente individualista que busca continuamente nuevos horizontes. Como es extremadamente autosuficiente e independiente de pensamiento y acción, prefiere encontrar sus propias soluciones. Relativamente libre de la influencia restrictiva del grupo, el Resolutivo es capaz de eludir los convencionalismos y suele aportar soluciones innovadoras.

Aunque con bastante frecuencia tiende a ser directo y enérgico, el Resolutivo es asimismo astuto para manipular personas y situaciones. Sin embargo, cuando se requiere que el Resolutivo coopere con otros en situaciones que limitan su individualidad, el Resolutivo pude tornarse beligerante. Es sumamente persistente para conseguir los resultados que desea, y hace todo lo que está en sus manos para vencer los obstáculos que se le presentan. Además, sus expectativas respecto a los demás son altas y puede ser muy crítico cuando no se cumplen sus normas.

Al Resolutivo le interesa mucho alcanzar sus propias metas, así como tener oportunidades de progreso y retos. Como su empeño se enfoca tanto en el resultado final, suele carecer de empatía y parecer indiferente a las personas. Podría decir algo como: “tómate una aspirina, yo estoy igual” o “no seas niño, ya se te pasará”.'),
  (v_p, 'emociones', 'PATRON DEL PROFESIONAL', 'Quiere mantenerse a la altura de los demás en cuanto a esfuerzo y desempeño técnico.'),
  (v_p, 'meta', 'PATRON DEL PROFESIONAL', 'Profundo afán por el desarrollo personal.'),
  (v_p, 'juzga', 'PATRON DEL PROFESIONAL', 'Su autodisciplina; sus posiciones y ascensos.'),
  (v_p, 'influye', 'PATRON DEL PROFESIONAL', 'La confianza en su habilidad para perfeccionar nuevos conocimientos; al desarrollar y seguir procedimientos y acciones “correctos”.'),
  (v_p, 'valor', 'PATRON DEL PROFESIONAL', 'Hábil para resolver problemas técnicos y humanos; profesionalismo en su especialidad.'),
  (v_p, 'abusa', 'PATRON DEL PROFESIONAL', 'Una atención excesiva a objetivos personales; expectativas poco realistas sobre los demás.'),
  (v_p, 'bajo_presion', 'PATRON DEL PROFESIONAL', 'Se cohibe; sensible a la crítica.'),
  (v_p, 'teme', 'PATRON DEL PROFESIONAL', 'Ser demasiado predecible; que no se le reconozca como “experto”.'),
  (v_p, 'mas_efectivo', 'PATRON DEL PROFESIONAL', 'Colaborara en forma genuina para beneficio general; delegara tareas importantes a las personas apropiadas.'),
  (v_p, 'resumen', 'PATRON DEL PROFESIONAL', 'El profesional valora la destreza en áreas especializadas. Su enorme deseo de “destacar en algo”, lo lleva a un esmerado control de su propio desempeño en el trabajo. Aunque su meta es ser “el” experto en un área determinada, el Profesional da la impresión de saber un poco de todo. Esta imagen es más marcada cuando pone en palabras el conocimiento que posee sobre diversos temas.

En su relación con otros, el Profesional suele proyectar un estilo relajado, diplomático y afable. Esta actitud puede cambiar de súbito en su área de especialización cuando se concentra demasiado en alcanzar altos niveles de rendimiento. Al valorar la autodisciplina, el Profesional evalúa a los demás sobre la base de su autodisciplina, la que mide por su rendimiento diario. Sus expectativas en relación consigo mismo y con los demás son elevadas. Suele exteriorizar su desilusión.

Al mismo tiempo que su naturaleza le pide concentrarse en desarrollar una propuesta organizada del trabajo y en aumentar sus propias capacidades, El Profesional necesita asimismo ayudar a otros a perfeccionar sus talentos. Además, necesita saber apreciar mejor a quienes contribuyen en el esfuerzo del trabajo, aunque no usen lo que el Profesional considera el “método correcto”.'),
  (v_p, 'emociones', 'PATRON DEL INVESTIGADOR', 'Desapasionado; autodisciplinado.'),
  (v_p, 'meta', 'PATRON DEL INVESTIGADOR', 'El poder que generan la autoridad, la posición y los roles formales.'),
  (v_p, 'juzga', 'PATRON DEL INVESTIGADOR', 'El uso de la información objetiva.'),
  (v_p, 'influye', 'PATRON DEL INVESTIGADOR', 'Su determinación; su tenacidad.'),
  (v_p, 'valor', 'PATRON DEL INVESTIGADOR', 'Seguimiento concienzudo para realizar su trabajo en forma constante y persistente sea individual o en grupos pequeños.'),
  (v_p, 'abusa', 'PATRON DEL INVESTIGADOR', 'La franqueza; su desconfianza hacia los demás.'),
  (v_p, 'bajo_presion', 'PATRON DEL INVESTIGADOR', 'Tiende a interiorizar los conflictos; recuerda el mal que se le ha hecho.'),
  (v_p, 'teme', 'PATRON DEL INVESTIGADOR', 'Involucrarse con las masas; vender ideas abstractas.'),
  (v_p, 'mas_efectivo', 'PATRON DEL INVESTIGADOR', 'Fuera más flexible; aceptara a los demás; si participara más con los demás.'),
  (v_p, 'resumen', 'PATRON DEL INVESTIGADOR', 'Objetivo y analítico, el investigador, está “enclavado en la realidad”. Por lo general reservado, sigue con calma y firmeza un camino independiente hacia la meta establecida. El Investigador tiene éxito en muchas cosas, no por su versatilidad sino por la tenaz determinación de llegar hasta el final. Busca un claro propósito o meta sobre el que puede desarrollar un plan ordenado y organizar sus acciones. Una vez embarcado en un proyecto, el Investigador lucha con tenacidad por alcanzar sus objetivos. En ocasiones es necesario intervenir para que cambie de parecer. Puede ser visto por otros como terco y obstinado.

El investigador se desempeña de maravilla en tareas de naturaleza técnica que le impliquen un reto, donde pueda usar e interpretar información real y sacar conclusiones. Responde a la lógica más que a la emoción. Al vender o comercializar una idea, puede lograr gran éxito si su producto es concreto.

El Investigador prefiere trabajar solo y no se interesa en agradar a los demás. Se le puede considerar sumamente directo, brusco y sin tacto. Al valorar su propia capacidad de pensamiento, el Investigador evalúa a los demás por su objetividad y lógica. Para mejorar la efectividad de sus relaciones con las personas necesita desarrollar una mayor comprensión de los demás, incluso de sus emociones.'),
  (v_p, 'emociones', 'PATRON DEL ORIENTADO A RESULTADOS', 'Una gran expresión verbal de la fuerza del ego; muestra un fuerte individualismo. .'),
  (v_p, 'meta', 'PATRON DEL ORIENTADO A RESULTADOS', 'Dominio e independencia. .'),
  (v_p, 'juzga', 'PATRON DEL ORIENTADO A RESULTADOS', 'Su capacidad para realizar las tareas con rapidez.'),
  (v_p, 'influye', 'PATRON DEL ORIENTADO A RESULTADOS', 'Su fuerza de carácter; su persistencia.'),
  (v_p, 'valor', 'PATRON DEL ORIENTADO A RESULTADOS', 'Sus acciones y actitud de “yo les muestro cómo”.'),
  (v_p, 'abusa', 'PATRON DEL ORIENTADO A RESULTADOS', 'La impaciencia; sentido competitivo de “ganar o perder”.'),
  (v_p, 'bajo_presion', 'PATRON DEL ORIENTADO A RESULTADOS', 'Se vuelve criticón y se dedica a encontrar errores; se niega a trabajar en equipo; se excede en sus prerrogativas.'),
  (v_p, 'teme', 'PATRON DEL ORIENTADO A RESULTADOS', 'Que otros se aprovechen de él; la lentitud, en especial en las actividades del trabajo; ser demasiado “blando” o “íntimo” con los demás.'),
  (v_p, 'mas_efectivo', 'PATRON DEL ORIENTADO A RESULTADOS', 'Verbalizara su proceso de razonamiento; buscara otros puntos de vista e ideas sobre sus objetivos al resolver problemas; su preocupación por los demás fuera más genuina; fuera más paciente y humilde.'),
  (v_p, 'resumen', 'PATRON DEL ORIENTADO A RESULTADOS', 'El Orientado a Resultados muestra tal confianza en sí mismo que algunos lo interpretan como arrogancia. Busca sin descanso oportunidades que prueben y desarrollen sus capacidades para alcanzar resultados. A estas personas les gustan las tareas difíciles, situaciones competitivas, cometidos únicos y puestos “importantes”. Aceptan la responsabilidad con un aire de “yo lo hago” y, cuando terminan, de “dije que yo lo podía hacer”.

El Orientado a Resultados tiende a evitar factores que lo restrinjan, como controles directos, detalles que le consuman tiempo y trabajos rutinarios. Enérgico y directo, este individuo puede tener dificultades con los demás. Por ser tan independiente, el Orientado a Resultados puede impacientarse cuando se ve involucrado en actividades de grupo. Aunque por lo general prefiere trabajar solo, logra persuadir a otros para que apoyen sus esfuerzos, en especial para completar actividades de rutina.

El Orientado a Resultados es rápido de pensamiento y acción. Se impacienta con quienes son diferentes a él y los critica. Valora a aquellos que muestran destreza para obtener resultados. Son determinados y persistentes, incluso frente al antagonismo. Estas personas, si creen que es necesario, toman el mando de la situación, les corresponda o no. En su impulso tenaz en busca de resultados, pueden parecer ásperos y desatentos.'),
  (v_p, 'emociones', 'PATRON DEL ESPECIALISTA', 'Moderación calculada; afán de servir, de adaptarse a los demás.'),
  (v_p, 'meta', 'PATRON DEL ESPECIALISTA', 'Conservar el “status quo”, controlar el ambiente.'),
  (v_p, 'juzga', 'PATRON DEL ESPECIALISTA', 'Las normas de amistad, después por su capacidad.'),
  (v_p, 'influye', 'PATRON DEL ESPECIALISTA', 'Su constancia en el desempeño; por su afán de servir, de adaptarse a las necesidades de los demás.'),
  (v_p, 'valor', 'PATRON DEL ESPECIALISTA', 'Planifica a corto plazo; es predecible, es congruente; mantiene un ritmo uniforme y seguro.'),
  (v_p, 'abusa', 'PATRON DEL ESPECIALISTA', 'La modestia; su miedo a correr riesgos; su resistencia pasiva hacia las innovaciones.'),
  (v_p, 'bajo_presion', 'PATRON DEL ESPECIALISTA', 'Se adapta a quienes tienen autoridad y a lo que opina el grupo.'),
  (v_p, 'teme', 'PATRON DEL ESPECIALISTA', 'Los cambios; la desorganización.'),
  (v_p, 'mas_efectivo', 'PATRON DEL ESPECIALISTA', 'Compartiera más sus ideas; aumentara su confianza en sí mismo basándose en la retroalimentación que recibe; utilizara métodos más sencillos y directos.'),
  (v_p, 'resumen', 'PATRON DEL ESPECIALISTA', 'El Especialista se “lleva bien” con los demás. Por su actitud moderada y controlada y por su comportamiento modesto, puede trabajar en armonía con diversos estilos de conducta. El Especialista es considerado paciente y siempre está dispuesto a ayudar a quienes considera sus amigos. De hecho, tiende a desarrollar en el trabajo una estrecha relación con un grupo relativamente reducido de compañeros.

Se esfuerza por conservar pautas de comportamiento conocidos y predecibles. El Especialista, al ser bastante eficiente en áreas especializadas, planea su trabajo, lo enfoca de manera clara y directa y consigue una notoria constancia en su desempeño. El reconocimiento que recibe de los demás le ayuda a conservar este nivel.

El Especialista es lento para adaptarse a los cambios. Una preparación previa le concede el tiempo que requiere para cambiar sus procedimientos y conservar su nivel de rendimiento. El Especialista puede necesitar ayuda al inicio de un nuevo proyecto y para desarrollar métodos prácticos y sencillos para cubrir plazos establecidos. Suele dejar a un lado los proyectos terminados para posteriormente concluirlos. Un pequeño consejo: ¡tire algunas de esas carpetas viejas de su archivo!.');

end $$;
