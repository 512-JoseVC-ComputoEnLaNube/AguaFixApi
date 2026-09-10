# Evidencias de validación

Validación realizada el 10 de septiembre de 2026 en Windows con Node.js 24.16.0 y npm 11.13.0. El repositorio remoto estaba vacío y la clonación seleccionó `main` como rama inicial. No se crearon ramas adicionales.

## Resultados ejecutados

| Verificación                | Resultado real                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Instalación de dependencias | Completada; package-lock.json incluido                                                           |
| Prettier                    | Formato aplicado y comprobación correcta                                                         |
| ESLint                      | Sin errores                                                                                      |
| Jest unitario               | 6 suites, 23 pruebas aprobadas                                                                   |
| Build NestJS                | Completado                                                                                       |
| PostgreSQL                  | 17.11 local, autenticación SCRAM, escucha en 127.0.0.1:55432                                     |
| Migración inicial           | InitialSchema1789080000000 aplicada                                                              |
| Revertir y reaplicar        | Probado antes de insertar datos de demostración; ambas operaciones correctas                     |
| Comprobación de esquema     | migration:generate con --check: no existen diferencias entre entidades y base                    |
| E2E con PostgreSQL real     | 9 pruebas aprobadas; EmailService sustituido solo en esta suite                                  |
| Arranque NestJS             | Correcto; API disponible en puerto 3000 durante la validación                                    |
| npm audit                   | 0 vulnerabilidades después de fijar multer 2.3.0                                                 |
| Exclusión de secretos       | .env ignorado; contraseña SMTP contrastada en memoria contra cada diff preparado, sin imprimirla |

## Solicitudes contra la API iniciada

| Caso                                     | Estado observado                                 |
| ---------------------------------------- | ------------------------------------------------ |
| Registro válido con correo en mayúsculas | 201; correo normalizado y respuesta sin password |
| Registro duplicado                       | 409                                              |
| Login válido                             | 200; mensaje de éxito y usuario sin password     |
| Login incorrecto                         | 400; `Correo o contraseña incorrectos`           |
| Severidad inválida                       | 400                                              |
| Campo isResolved enviado por el cliente  | 400                                              |
| Reporte válido con SMTP real             | 201; reporte ID 3                                |
| Listado                                  | 200; el reporte guardado aparece una sola vez    |

Las pruebas E2E verificaron además el hash bcrypt en PostgreSQL, valor predeterminado de notificaciones, rechazo de campos administrados por el servidor, orden descendente y persistencia de un único reporte cuando se simula un fallo SMTP. El log de error de ese caso es esperado y no indica un fallo de la suite. Sus registros temporales fueron eliminados por la propia suite. El usuario y el reporte de demostración manual permanecieron disponibles para revisión.

## Correo real

- Servidor: smtp.gmail.com, puerto 465, TLS implícito.
- Remitente y destinatario: josestudente06@gmail.com.
- Autenticación SMTP verificada y mensaje aceptado por Gmail.
- Asunto: **Nuevo reporte de fuga de agua**.
- Marcador: **PRUEBA 1789078558485**.
- Fecha del mensaje: **10 septiembre 2026, 22:15:59 UTC** (16:15:59 en Ciudad de México).
- Recepción comprobada mediante consulta IMAP de solo lectura en **INBOX**, buscando únicamente el marcador de la prueba.
- Verificados título, dirección, descripción, severidad y teléfono dentro del contenido HTML.
- El usuario también confirmó haber recibido el correo HTML.
- La contraseña de aplicación se mantuvo exclusivamente en el `.env` local, normalizada y fuera de Git.

## Entorno y video

Docker Desktop estaba instalado, pero su motor no estaba disponible. Se descargaron los [binarios oficiales de PostgreSQL distribuidos por EDB](https://www.enterprisedb.com/download-postgresql-binaries) y se utilizó una instancia local para completar la validación real. No se usó una base en memoria ni synchronize. El archivo docker-compose.yml está incluido para reproducir la práctica; el arranque por Docker no se pudo validar en este entorno.

No se generó un MP4: las herramientas disponibles permiten inspección e interacción, pero no ofrecen una función de grabación de pantalla. Se entrega [guion detallado de 5–6 minutos](guion-video.md), con comandos, solicitudes, ocultación de credenciales y lista de evidencias.

La publicación Git y los hashes definitivos se informan en la entrega final, después de verificar el push.
