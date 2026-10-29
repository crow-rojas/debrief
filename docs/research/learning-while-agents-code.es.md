# Aprender mientras el agente programa: investigación para una herramienta open-source y local-first

> Original en español. La traducción al inglés está en [learning-while-agents-code.md](learning-while-agents-code.md).

**Respuesta corta: la idea tiene espacio real y bastante respaldo.** El problema está documentado: en un ensayo controlado de Anthropic, quienes aprendieron una librería nueva con IA obtuvieron 17% menos en comprensión. Las técnicas que propones (recuperación activa, repaso espaciado, Parsons, autoexplicación) son de lo más sólido que tiene la ciencia del aprendizaje. Y nadie ofrece hoy la combinación concreta de _lecciones interactivas generadas desde tus diffs reales + repaso espaciado + uso desde el teléfono + 100% local + open-source_. Lo más cercano es Contral, que es un IDE comercial, o plugins de terminal para Claude Code que no cruzan agentes ni llegan al teléfono. Mi recomendación es construirlo, pero con un MVP mucho más pequeño que la visión completa. Primero: captura agnóstica de agentes, tarjetas de recuperación activa sobre tu propio código, programación FSRS y una PWA servida por LAN o Tailscale Serve. Dejaría fuera de la versión 1 los videos con motion graphics, el TTS y Remotion como dependencia (por su licencia).

## TL;DR

- **El problema es real y medible.** En el RCT de Anthropic (52 desarrolladores, mayoría junior) el grupo con IA obtuvo 50% en el quiz y el grupo sin IA 67%, sin ganar velocidad de forma significativa. Russinovich y Hanselman (CACM, abril 2026) piden explícitamente "sistemas de IA que capturen el razonamiento, hagan aflorar malentendidos y conviertan el trabajo diario en momentos enseñables", que es casi la descripción de tu producto.
- **El hueco está en la combinación.** Las piezas existen: hay modos "Learning/Explanatory" en Claude Code, un IDE comercial (Contral) y varios plugins open-source de quizzes con repaso espaciado para Claude Code. Ninguno mezcla agnosticismo de agente, ejercicios sobre tu diff real, FSRS, teléfono y privacidad local por defecto.
- **Arquitectura recomendada.** Hooks del agente (Claude Code/Cursor/Codex) + watcher de git como fallback → extracción de conceptos con LLM (local con Ollama por defecto, cloud opcional con tu propia key) → tarjetas interactivas con ts-fsrs → PWA en SQLite servida por LAN o `tailscale serve`. Licencia Apache-2.0 y animaciones con librerías MIT (Motion Canvas/framer-motion), no Remotion.

## Hallazgos clave

### 1. Panorama: qué existe y qué falta

**Productos comerciales**

- **Contral** (https://contral.ai): se presenta como "la capa de enseñanza para cualquier agente de IA". Es un IDE propio con extensiones para Cursor, Copilot, Claude Code, Codex, Windsurf y Antigravity. Tiene tres modos: _Build_ (explica cada función que escribe el agente con "learning cards"), _Learn_ (currículo estructurado, empezando por Java) y _Defense_ (te pide explicar lo construido antes de publicarlo). Según su ficha en AppSumo, se lanzó el 21 de marzo de 2026 y ya superó los 1.500 usuarios beta; el IDE público apareció hacia el 10 de mayo de 2026, según el tracker de NG Tech. El plan gratis, según directorios de terceros, trae 25 mensajes de IA al día. Es tu competidor conceptual más directo, pero es un producto cerrado y freemium, centrado en explicar _en vivo_ dentro del IDE, y no en repaso espaciado ni en uso móvil durante los tiempos muertos.
- **Output styles de Claude Code** (https://code.claude.com/docs/en/output-styles): _Explanatory_ agrega bloques de "Insights" y _Learning_ además deja marcadores `TODO(human)` para que escribas partes del código. La documentación advierte que ambos producen respuestas más largas y gastan más tokens de salida. Interrumpen el flujo a propósito, que es justo lo que quieres evitar. Tampoco hay repaso posterior.
- ChatGPT tiene "Study Mode" (mencionado por InfoQ). Es genérico y no está ligado a tu código.

**Open-source (GitHub)**

- **cufelix/learn-claude-code**: tutor dentro de Claude Code con quizzes calificados por un hook `PostToolUse` y repaso en cajas de Leitner (1, 3, 7 y 21 días). Es la prueba de que los hooks sirven para esto.
- **kirilxd/claude-tutor** (MIT): planes de aprendizaje, quizzes adaptativos, SM-2 y dashboard web. El ámbito es "cualquier tema", no tu diff.
- **hluaguo/learn-faster-kit**: coach con syllabus y `/review` de repaso espaciado para Claude Code.
- **nagisanzenin/engram**: plugin de Claude Code con FSRS y verificación por recuerdo libre.
- **ChenChenyaqi/learn-anything**: profundización socrática y ejercicios estilo TDD para Claude Code y Codex.
- **olmps/memo**: SRS orientado a programación (Flutter), sin integración con agentes.
- Las páginas de topics de GitHub `quiz-generator` (287 repos) y `spaced-repetition` (2.372 repos) muestran que generar quizzes con LLM y repasar con SRS ya es algo común.

**Qué falta (tu diferenciación):**

1. **Ejercicios sobre tu diff real del día**, no sobre "temas". Por ejemplo, "encuentra el bug" inyectado en el código que el agente acaba de escribir, Parsons con tus propias líneas, o "¿por qué X y no Y?" sobre una decisión real del transcript.
2. **Fuera de banda y asíncrono:** no interrumpe al agente ni a la terminal; consumes en el teléfono durante la espera.
3. **Agnóstico de agente** (Claude Code, Cursor, Codex, Aider, o cualquier cosa que haga commits).
4. **Local y privado por defecto**, apto para código de empresa.
5. **Open-source de verdad**. Todos los plugins anteriores viven _dentro_ de una sesión de Claude Code.

### 2. Evidencia del problema

| Estudio                                                                                    | Qué midió                                                                | Resultado                                                                                                                                                                                                     | Lectura honesta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic, Shen y Tamkin (ene/feb 2026), arXiv 2601.20245                                  | RCT con 52 desarrolladores (mayoría junior) aprendiendo la librería Trio | Quiz: 50% con IA vs 67% sin IA. Diferencia de velocidad no significativa                                                                                                                                      | Mide la _formación_ de habilidades nuevas, no la atrofia en seniors. Usaron un asistente de chat, no un agente; los autores esperan efectos "más pronunciados" con agentes. Quienes usaron la IA para preguntas conceptuales aprendieron bien.                                                                                                                                                                                                                                                          |
| Russinovich y Hanselman, _Communications of the ACM_ 69(4), pp. 41-44, DOI 10.1145/3779312 | Ensayo de opinión, no un experimento                                     | "AI boost" para seniors, "AI drag" para juniors; proponen "preceptorship at scale"                                                                                                                            | Es un texto de opinión, aunque muy influyente. Citan un estudio de Harvard (Hosseini Maasoum y Lichtinger, "Generative AI as Seniority-Biased Technological Change", SSRN 5425555, con datos de currículums de unos 62 millones de trabajadores) que encontró que, tras adoptar IA, el empleo junior cae en esas empresas frente a las que no la adoptan, mientras el senior se mantiene, sobre todo porque contratan menos.                                                                            |
| METR (jul 2025), arXiv 2507.09089                                                          | RCT con 16 desarrolladores open-source experimentados y 246 tareas       | Con IA tardaron 19% más (IC +2% a +39%), aunque creían ir 20% más rápido                                                                                                                                      | Habla de productividad y de _autopercepción_, no de aprendizaje. Muestra que los desarrolladores no se autoevalúan bien, lo que respalda los ratings de confianza calibrados. En febrero de 2026, METR informó en su propio blog que entre los desarrolladores originales que repitieron estima ahora un efecto de −18% (IC −38% a +9%), y de −4% entre los recién reclutados. Advierte que esos datos dan una "señal poco fiable" por sesgos de selección, así que la cifra solo describe ese momento. |
| Stack Overflow Developer Survey 2025 (49.009 respuestas)                                   | Confianza en la IA                                                       | 84% usa o planea usar IA; 46% desconfía de su exactitud vs 33% que confía; solo 3% "confía mucho"                                                                                                             | Evidencia indirecta: los desarrolladores necesitan verificar, y eso requiere entender el código.                                                                                                                                                                                                                                                                                                                                                                                                        |
| GitClear 2025 (211 M líneas) y 2026                                                        | Calidad del código                                                       | Líneas "movidas" (refactor) bajaron de 24,1% (2020) a 9,5% (2024); copy/paste subió de 8,3% a 12,3%. En el informe 2026, refactor en 3,8% en lo que va de 2026 y bloques duplicados de 40,3 a 73,0 por millón | Correlacional. No prueba que la IA lo cause línea por línea, y GitClear vende herramientas de calidad.                                                                                                                                                                                                                                                                                                                                                                                                  |

**Interpretación:** la evidencia más fuerte (Anthropic) es sobre _aprender cosas nuevas con IA_, que es justo el caso de un desarrollador que deja al agente usar una librería que no conoce. La "atrofia" en seniors está menos demostrada. Recomiendo posicionar el producto como **"no pierdas la comprensión de lo que se envía con tu nombre"** y no como "tu cerebro se está pudriendo". Es más honesto y más defendible.

### 3. Ciencia del aprendizaje: qué está respaldado y qué no

**Muy respaldado (meta-análisis):**

- **Práctica de recuperación / testing effect:** Rowland (2014, _Psychological Bulletin_) g = 0,50 (IC 0,42-0,58; 159 tamaños de efecto) y g = 0,73 cuando hay feedback vs 0,39 sin él. Adesope, Trevisan y Sundararajan (2017, _Review of Educational Research_) g = 0,61 (272 efectos, unos 15.400 participantes) contra todas las condiciones de comparación; contra relectura se reporta alrededor de 0,51. **Implicación:** el núcleo del producto deben ser las preguntas, no las explicaciones.
- **Efecto de generación:** Bertsch et al. (2007, _Memory & Cognition_) d = 0,40 (445 efectos) y mayor con intervalos largos. Sustenta "predice el output" y las respuestas libres.
- **Autoexplicación:** Bisra et al. (2018, _Educational Psychology Review_) g = 0,55 (IC 0,45-0,65) y g = 0,67 frente a no explicar. Sustenta el ejercicio tipo Feynman.
- **Intercalado:** Brunmair y Richter (2019, _Psychological Bulletin_) g = 0,42 en total. Es mayor cuando las categorías se parecen entre sí (matemáticas 0,34) y **negativo para listas de palabras** (−0,39). **Implicación:** intercala conceptos parecidos que se confunden (p. ej. `Promise.all` vs `allSettled`), no cualquier cosa.
- **Repaso espaciado, FSRS vs SM-2:** en el benchmark abierto srs-benchmark, FSRS-6 tiene menor log-loss que SM-2 en el 99,6% de las colecciones (log-loss de SM-2 ≈ 0,72 vs ≈ 0,34 de FSRS-6). Hay dos salvedades que el propio benchmark reconoce: SM-2 no se diseñó para predecir probabilidades, y el benchmark es del mismo equipo que hizo FSRS. Además mide _predicción_, no aprendizaje. Aun así FSRS es el estándar de facto (Anki lo integra desde la 23.10). **Usa FSRS.**

**Respaldado en educación en computación:**

- **Problemas de Parsons:** Ericson, Margulieux y Rick (Koli Calling 2017) encontraron que resolver Parsons 2D con distractores toma significativamente menos tiempo que corregir o escribir el código equivalente, sin diferencia significativa en aprendizaje ni en retención a una semana. En sesiones de 2-3 minutos en el teléfono, esta eficiencia importa mucho. Matiz: Harms et al. (2016) vieron que los distractores _bajan_ la eficiencia en novatos jóvenes, así que conviene que sean adaptativos.
- **"Encuentra el bug" y "predice el output":** tienen sustento como variantes de corrección de código y de generación, pero no encontré meta-análisis específicos en esta investigación. Trátalo como hipótesis razonable.

**Carga cognitiva: por qué un video pasivo de fondo sería mala idea**

- Los principios de Mayer (Mayer y Fiorella 2014; Mayer 2017) tienen medianas de efecto grandes: **redundancia** d ≈ 0,86-0,87 (no pongas narración y el mismo texto en pantalla), **contigüidad espacial** d ≈ 0,79-1,10 (la explicación pegada al código, no en otra pantalla), **segmentación** d ≈ 0,70 (clips cortos controlados por el usuario) y **modalidad** d ≈ 0,72-0,76 (narración + gráfico es mejor que texto + gráfico).
- **Multitarea:** Sana, Weston y Cepeda (2013, _Computers & Education_) encontraron que quienes hacían multitarea en la computadora portátil durante una clase rindieron peor en comprensión, y también quienes solo veían la pantalla del vecino. **Implicación:** nada de "video de fondo mientras programas". Las sesiones tienen que ser _foreground_ breves en la espera, con animaciones cortas y segmentadas que se adelantan con un tap y van pegadas al código.

**Calificación de texto libre con LLM: útil, pero con cuidado**

- GPT-4o en quizzes universitarios (arXiv 2511.10819) logró correlación de hasta 0,98 con humanos, pero solo **55% de acuerdo exacto**: calificó por debajo en 38,8% de los casos y por encima en 6,2% (κ = 0,515).
- En física (_Physical Review PER_, 2025), con rúbricas que explican cada ítem y modo de autoconsistencia, el LLM llegó a acuerdo de nivel humano, y las explicaciones de rúbrica dirigidas a las debilidades del LLM fueron clave.
- Otros estudios muestran lo contrario: indulgencia en educación médica y acuerdo bajo con humanos en un estudio de CEUR. Un estudio con modelo _local_ (MDPI _Computers_, 2026) encontró indulgencia sistemática, pero corregible calibrando.
- **Implicación de diseño:** usa rúbricas explícitas por ítem, muestra la retroalimentación como "pistas" y no como nota final, deja que el usuario dispute ("no estoy de acuerdo") y usa la autoevaluación de confianza como señal principal para FSRS.

**Calidad de preguntas generadas por LLM**

- Doughty et al. (ACE 2024) compararon 651 MCQ de GPT-4 con 449 humanas en Python. La calidad fue "comparable" y la alineación con objetivos mejor, pero hubo **más preguntas con varias respuestas correctas (4,9% vs 1,1%)** y más distractores que delatan la respuesta (4,0% vs 0,9%).
- Sarsa et al. (ICER 2022, Codex): solo alrededor del 30% de los ejercicios generados tenía una solución que pasaba sus propios tests, y 67,2% de las explicaciones línea por línea eran correctas. Los modelos actuales son mejores, pero la lección sigue en pie: **hay que validar automáticamente**. Para "predice el output", ejecuta el código y no le preguntes al LLM. Para "encuentra el bug", verifica que el bug inyectado rompa un test.

**Doomscrolling y hábitos (evidencia débil, es opinión)**
No encontré en esta investigación estudios sólidos sobre "reemplazar doomscrolling con microlearning" en desarrolladores. Mi recomendación de diseño es opinión basada en principios: el disparador ya existe (el agente empieza a trabajar o se queda esperando) y la notificación debe llegar _solo_ en ese momento. Sesiones de 1-3 tarjetas que se puedan cerrar sin culpa, un tope diario bajo, sin rachas punitivas y con un botón "ahora no" que posponga. Lo que hay que medir es retención a 7 y 30 días, no minutos de uso.

### 4. Arquitectura técnica recomendada

**4.1 Captura de actividad (agnóstica)**

| Fuente                         | Mecanismo                                                                                                                                                                                                                                                                                             | Qué entrega                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Claude Code                    | Hooks `PostToolUse` (Edit/Write), `Stop` (incluye `last_assistant_message`) y `SessionEnd`. Todos reciben `transcript_path` (JSONL)                                                                                                                                                                   | Diffs, razonamiento del agente y el momento exacto de "el agente terminó o está esperando" |
| Cursor (≥1.7)                  | `.cursor/hooks.json` o `~/.cursor/hooks.json`: `afterFileEdit` (con `edits` old/new), `stop`, `sessionStart/End`, `afterAgentResponse`, `afterAgentThought`                                                                                                                                           | Ediciones y "pensamientos" del agente                                                      |
| Codex CLI                      | Hooks experimentales desde v0.114.0 (mar 2026), que según el issue #14754 de openai/codex traía solo `SessionStart` y `Stop`. Según un changelog de la comunidad (shanraisshan/codex-cli-hooks), `PreToolUse` y `PostToolUse` se agregaron en v0.117.0 (26 mar 2026). **Verificar la versión actual** | Al menos el fin de turno                                                                   |
| Cualquier agente (Aider, etc.) | Hook git `post-commit` + watcher de filesystem sobre el working tree                                                                                                                                                                                                                                  | Diffs puros, sin razonamiento                                                              |

Diseño: un **daemon local** (`learnd`) con un endpoint HTTP en localhost. Cada adaptador es un script mínimo que envía un evento normalizado (`{agent, repo, diff, rationale?, transcript_ref, ts}`). Con eso, agregar un agente nuevo se reduce a un archivo de 20 líneas. MCP es opcional: sirve para que el agente _consulte_ ("¿qué conceptos ya domina el usuario?") y ajuste sus explicaciones, pero no lo necesitas para capturar.

**4.2 Extracción de conceptos y generación**

- Agrupa por evento `Stop` o por commit, no por cada edit, para ahorrar costos.
- Pipeline: diff → filtrado (ignorar lockfiles, código generado y secretos) → LLM que extrae de 1 a 3 "conceptos enseñables" con evidencia (líneas) → generador por tipo de ejercicio → **validadores deterministas** (ejecutar el código para "predice el output", tests para "encuentra el bug", parser para Parsons) → cola FSRS.
- **Local vs cloud:** por defecto local con Ollama, llama.cpp o LM Studio (todos exponen API compatible con OpenAI, así que un solo cliente sirve). Cloud solo si el usuario trae su propia key. No hice benchmarks propios de modelos pequeños para generar preguntas; el estudio MDPI sugiere que un modelo local _puede_ calificar de forma razonable si se calibra la indulgencia. Recomendación (opinión): deja que la generación sea asíncrona, porque no importa si tarda 40 segundos, y usa validadores para compensar la menor calidad de los modelos pequeños.

**4.3 Lecciones interactivas y animación**

- **Remotion: no lo uses como dependencia del core.** Según sus Términos v5 (https://www.remotion.dev/docs/terms), Remotion "no es open-source según la definición OSI". Es gratis para individuos, organizaciones de hasta 3 personas y sin fines de lucro. Una organización de **4 o más personas** necesita Company License (la cuenta incluye a "todo el personal, use o no Remotion"). **Incrustar el `<Player>` cuenta como "automatización"**, que para usuarios Company exige "Remotion for Automators", con un **gasto mínimo de US$100/mes**. Además, el "uso comercial" incluye herramientas internas de empresas con fines de lucro. En la práctica: si un desarrollador lo usa en su computadora portátil del trabajo en una empresa de 4+ personas, la empresa probablemente necesita licencia. Eso descarta la adopción en empresas.
- **Alternativas MIT** (según la propia comparativa del ecosistema): **Motion Canvas**, **Revideo** y **Manim**, más **framer-motion/Motion** para animaciones de UI en React. Mi recomendación: en el MVP, animaciones de UI simples (resaltar líneas, flechas de flujo de datos, _stepping_ de ejecución) con framer-motion. Motion Canvas solo para "explicadores" más ricos en una fase posterior.
- **TTS (opcional, fase 3):** **Kokoro-82M** (Apache-2.0, 82 M parámetros, corre en CPU, aunque depende de espeak-ng, que es GPL) o **Piper**, cuyo repo original rhasspy/piper (MIT) quedó archivado y que hoy sigue como OHF-Voice/piper1-gpl (**GPL-3.0**, cada voz con su propia licencia). Para un proyecto Apache conviene Kokoro como proceso aparte. Recuerda el principio de redundancia: si hay voz, no repitas el mismo texto en pantalla.

**4.4 Repaso espaciado y almacenamiento**

- `ts-fsrs` (TypeScript) o `py-fsrs` (Python) según el stack, ambas de open-spaced-repetition.
- **SQLite** como fuente de verdad: un solo archivo, fácil de respaldar y el mismo formato que usa Anki.
- Exportación a **Markdown compatible con Obsidian** (una nota por concepto con el snippet y la explicación) y a **Anki** (.apkg) para preguntas simples.

**4.5 Servir al teléfono gratis**

| Opción                                    | Gratis                                                                                                                            | Privacidad                                      | Comentario                                                                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LAN-only** (bind a la IP local + token) | Sí                                                                                                                                | Máxima                                          | Funciona en casa y en la oficina en la misma red. Opción segura por defecto.                                                                                                   |
| **Tailscale Serve**                       | Plan Personal: $0, hasta 6 usuarios, dispositivos ilimitados                                                                      | Solo tu tailnet, HTTPS automático en `*.ts.net` | **Atención:** el plan Personal es "solo para uso no comercial". Usarlo para trabajo en la empresa queda en zona gris; lo correcto ahí es el tailnet de la empresa o Headscale. |
| **Tailscale Funnel**                      | Sí                                                                                                                                | **Público en internet**                         | No usar. Expone el servidor; solo puertos 443/8443/10000 y sin autenticación incluida.                                                                                         |
| **Headscale**                             | Sí (self-hosted)                                                                                                                  | Alta                                            | Servidor de control open-source compatible con los clientes Tailscale. Para usuarios avanzados o empresas.                                                                     |
| ZeroTier / NetBird                        | Planes gratis más pequeños (según la página oficial de precios de ZeroTier, su plan Personal gratuito da 10 dispositivos y 1 red) | Alta                                            | Alternativas válidas.                                                                                                                                                          |
| Cloudflare Tunnel / ngrok                 | Gratis con límites                                                                                                                | **Baja para código propietario**                | El tráfico pasa por terceros y queda público si no agregas auth. Desaconsejado como opción por defecto.                                                                        |

- **PWA mejor que app nativa** para el MVP: un solo código, sin tiendas y "instalable". Las notificaciones push web en iOS requieren agregar la PWA a la pantalla de inicio (iOS 16.4+, conocimiento general que no verifiqué en esta investigación). La alternativa más simple es **ntfy** (self-hosteable) para el aviso "tu agente está trabajando, ¿2 minutos?".
- **Seguridad mínima:** bind a `127.0.0.1` por defecto, emparejamiento del teléfono por QR con token de larga duración, CSRF/CORS estrictos, nunca servir el repo crudo (solo snippets ya extraídos) y log de accesos.

**4.6 Privacidad y código de empresa**

- Modo "empresa" sin salida de red: Ollama local, sin telemetría y con lista de repos permitidos (_allowlist_).
- Escaneo de secretos antes de cualquier LLM (gitleaks o similar), y respetar `.gitignore` más un `.learnignore`.
- Argumento honesto para equipos: si la empresa _ya_ autorizó que Claude Code o Cursor envíen ese código a su proveedor, reusar **el mismo proveedor bajo el mismo acuerdo** no amplía la exposición. Aun así, lo predeterminado debe ser local. Es opinión, no asesoría legal.

### 5. Estrategia open-source

- **Licencia: Apache-2.0** (opinión fundamentada). Es permisiva como MIT y además da concesión explícita de patentes, algo que los equipos legales corporativos valoran. AGPL protege contra forks SaaS, pero muchas empresas la tienen vetada, y tu caso de uso clave es _el desarrollador en su trabajo_. Si temes un fork comercial, mantén el core en Apache y reserva la marca.
- **Dependencias:** evita en el core cualquier cosa source-available (Remotion) o GPL (Piper, espeak-ng); aíslalas como plugins opcionales en procesos separados.
- **Plugins:** tres ejes de extensión con contratos simples: (1) adaptadores de agente, (2) generadores de ejercicios (tipo + validador), y (3) packs de lenguaje (reglas de inyección de bugs y Parsons por lenguaje).
- **Crecimiento (opinión):** los plugins de Claude Code que viste arriba crecen gracias a listas "awesome" (p. ej. awesome-claude-code ya cataloga learn-faster-kit). Un demo GIF de 20 segundos ("el agente escribe, tu teléfono te pregunta por qué usó `useMemo`") vale más que cualquier README. Que la instalación sea `npx <nombre> init` y detecte qué agentes tienes.
- **Monetización opcional:** packs curados por equipos ("onboarding del codebase") o versión para equipos con métricas agregadas _opt-in_. Russinovich y Hanselman plantean justamente que las organizaciones deben medir el crecimiento de los juniors, así que hay un ángulo B2B de "preceptorship" con datos.
- **Naming/posicionamiento (opinión):** algo que evoque "mientras esperas". Ideas: _Meanwhile_, _Idle_, _Recall_, _Sobremesa_. Tagline: "Entiende lo que tu agente envía con tu nombre".

## Recomendaciones: MVP y roadmap

**MVP (4-6 semanas, 1 persona)**

1. Daemon + adaptadores para Claude Code (hooks) y Cursor (hooks), más un fallback con git `post-commit`.
2. Generación en el evento Stop o commit: máximo 3 tarjetas por sesión, de 4 tipos: **MCQ conceptual**, **predice el output** (validado ejecutando), **Parsons** con tus líneas y **"¿por qué X y no Y?"** sacado del razonamiento del transcript.
3. FSRS (ts-fsrs) + SQLite + rating de confianza antes de revelar la respuesta.
4. PWA móvil servida por LAN o `tailscale serve`, con emparejamiento por QR y notificación por ntfy cuando el agente inicia una tarea larga.
5. Ollama por defecto y key de API opcional.

**v0.2:** "encuentra el bug" inyectado y validado con tests, explicación tipo Feynman calificada con rúbrica (como sugerencia, no como nota), export a Obsidian y Anki, adaptador para Codex.
**v0.3:** micro-animaciones (framer-motion o Motion Canvas) para flujos de ejecución, "revisa el PR del agente", intercalado de conceptos que se confunden.
**v1.0:** TTS opcional (Kokoro), plugins de terceros, modo equipos.

**Métricas de éxito:** precisión en el primer repaso a 7 días, porcentaje de tarjetas marcadas como "mala pregunta" (meta: menos de 10%), sesiones iniciadas desde una notificación vs ignoradas y desinstalaciones.

## Riesgos principales

| Riesgo                                                                                                      | Severidad | Mitigación                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Molestia o fricción                                                                                         | Alta      | Notificar solo en tiempos muertos reales, tope diario, "ahora no", cero rachas punitivas                       |
| Preguntas malas o ambiguas (en Doughty 2024, 4,9% de las MCQ de GPT-4 tenían más de una respuesta correcta) | Alta      | Validadores deterministas, botón "mala pregunta" que entrena filtros, preferir tipos de ejercicio verificables |
| Calificación de LLM indulgente o inconsistente                                                              | Media     | Rúbricas explícitas, autoconsistencia y feedback no punitivo                                                   |
| Costo de LLM                                                                                                | Media     | Lotes por sesión, modelo local por defecto, caché por concepto (no regenerar `async/await` cada día)           |
| Políticas de privacidad en empresas                                                                         | Alta      | Local por defecto, allowlist, escaneo de secretos y documentación lista para enviar al equipo de seguridad     |
| Licencias de terceros (Remotion, Tailscale Personal "no comercial", Piper GPL)                              | Media     | Core Apache sin esas dependencias; LAN y Headscale como alternativas                                           |
| Cambios en las APIs de hooks (Codex experimental)                                                           | Media     | Capa de adaptadores más el fallback por git                                                                    |

## Caveats

- La evidencia de deskilling más fuerte (Anthropic) mide _formación_ de habilidades en un solo experimento, con un quiz inmediato y un asistente de chat. No prueba atrofia a largo plazo en seniors, y los propios autores lo advierten.
- Los efectos de los meta-análisis (g ≈ 0,4-0,6) vienen en su mayoría de laboratorios y aulas, no de desarrolladores profesionales en micro-sesiones móviles. Es una extrapolación razonable, no una garantía.
- El benchmark FSRS vs SM-2 mide predicción de recuerdo, lo hizo el equipo de FSRS y compara contra un SM-2 adaptado.
- No verifiqué directamente en esta investigación: la calidad actual de modelos locales pequeños para generar y calificar preguntas, los detalles de web push en iOS, ni estudios sobre sustituir el doomscrolling. Las recomendaciones sobre esos puntos son opinión.
- Los Términos v5 de Remotion están marcados como "próximos" (aplicarán desde Remotion 5.0). La versión 4 vigente tiene términos similares en lo esencial (umbral de 4 personas), pero revísalos antes de decidir.
- Hay fuentes contradictorias sobre el plan gratis de Tailscale (algunas aún dicen 3 usuarios y 100 dispositivos). La página oficial de precios dice 6 usuarios, dispositivos ilimitados y uso no comercial.
