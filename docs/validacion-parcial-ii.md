# Validación del segundo parcial

Fecha: 24 de octubre de 2026. Proyecto existente en Windows, rama `main`.

## Resultados ejecutados

| Comprobación                  | Resultado                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Compilación NestJS            | Correcta en Node 24.16.0 y Node 22.23.4                                                    |
| Pruebas unitarias y HTTP      | 9 suites, 46 pruebas aprobadas con Node 22                                                 |
| E2E PostgreSQL                | 1 suite, 9 pruebas aprobadas con PostgreSQL 17.11 y Node 24; S3 y SMTP simulados           |
| Migración nueva               | Aplicar, revertir y reaplicar conserva todos los campos del reporte histórico de prueba    |
| Compatibilidad del esquema    | Sin diferencias entre las entidades y PostgreSQL después de reaplicar                      |
| CLI de migraciones compiladas | `migration:show:prod` reconoce ambas migraciones                                           |
| Arranque compilado            | `node dist/main` funciona con Node 22; GET devuelve 200 y POST sin foto devuelve 400       |
| ESLint                        | Sin errores                                                                                |
| Prettier                      | Formato correcto                                                                           |
| npm audit                     | Cero vulnerabilidades tras actualizaciones compatibles                                     |
| Compose                       | Configuración final y combinación con override local aceptadas por `config --quiet`        |
| Construcción Docker           | No disponible en este equipo (sin virtualización para WSL 2). Se traslada a GitHub Actions |

Durante la validación inicial se utilizó una instancia PostgreSQL separada en `127.0.0.1:55439`, con datos de prueba temporales. En esa etapa no se aplicaron migraciones a la base original ni se eliminaron sus datos o volúmenes. La prueba de reversión insertó un reporte histórico, comprobó su contenido después de cada operación y eliminó únicamente ese registro de prueba.

### Corrección del arranque local

El 24 de octubre se diagnosticó `ECONNREFUSED` en `localhost:55432`: la instancia original estaba detenida. Se inició PostgreSQL 17.11 con su directorio de datos existente y un log situado fuera de `data`. Tras recuperar el cierre anterior, aceptó conexiones.

Se aplicó `AddReportPhoto1792800000000` a esa base local. Los tres reportes existentes conservaron exactamente sus campos originales, comprobados antes y después de la migración. Ambas migraciones aparecen aplicadas. No se modificaron credenciales ni se borraron registros.

Las pruebas cubren multipart válido, normalización de campos, archivo obligatorio, detección de contenido aunque el MIME declarado sea incorrecto, texto disfrazado de PNG, rechazo de SVG, límites (incluidos exactamente 5 MiB), nombre de campo incorrecto, múltiples archivos, validaciones del DTO y campos extra. También verifican subida única, URL persistida, limpieza ante fallo de base de datos, error de S3, fallo de limpieza con log seguro, correo escapado con imagen y conservación del reporte si falla SMTP.

La regresión comprueba registro, correo único, hash bcrypt, login, privacidad de contraseña, orden del listado y `repairPhotoUrl: null`.

## Configuración y verificaciones pendientes

- Completar `AWS_REGION`, `AWS_S3_BUCKET` y credenciales/proveedor IAM de ejecución. No estaban definidos en el entorno inspeccionado.
- Configurar permisos para escritura/eliminación de la API y lectura pública limitada a `reports/*`.
- Ejecutar un POST con S3 y SMTP reales, abrir la URL sin sesión y comprobar visualmente el correo. Los resultados simulados no sustituyen estas evidencias.
- Ejecutar la [corrida de prueba](parcial-ii.md#corrida-de-prueba-antes-de-grabar) en la rama `prueba/docker` y confirmar en Actions la construcción, el contenido de la imagen, las migraciones y el arranque de la API.
- Crear/verificar `josep210d/aguafix-api` en Docker Hub y los Secrets `DOCKER_USER` y `DOCKER_PASSWORD` en GitHub.
- Completar pruebas manuales, autorizar commits y push, integrar la diferencia remota y verificar Actions y Docker Hub.
- La ejecución de la imagen publicada con Compose queda fuera de alcance en este equipo; requiere otro equipo con Docker.

## Docker sin motor local

Esta computadora no puede iniciar WSL 2 por falta de virtualización, así que Docker Desktop no funciona. La construcción y verificación de la imagen se realizan en GitHub Actions (`.github/workflows/docker-publish.yml`):

- Se construye la imagen y se comprueba que contenga la compilación y que no incluya `.env` ni archivos Compose.
- Con un PostgreSQL 17 temporal del runner se ejecutan las migraciones desde la imagen y se arranca la API con valores desechables: `GET /reports` debe responder 200 y `POST /reports` sin foto 400.
- Solo un push a `main` publica `josep210d/aguafix-api:latest`. La rama `prueba/**` y la ejecución manual verifican sin publicar.

El workflow se validó con actionlint y Prettier. Su ejecución real en GitHub sigue pendiente.

## Revisión de Git y configuración sensible

Se consultó y actualizó la referencia remota mediante fetch. `main` local permanece en `b3148cb`; `origin/main` está en `a7c0126`, tres commits de documentación por delante. No se cambiaron ramas, no se hicieron commits ni push. La carpeta `bruno/` ya existía sin seguimiento y se conservó.

`.env` no está versionado ni aparece en el historial conocido consultado. La contraseña SMTP local no aparece en los archivos revisados. Las coincidencias de la contraseña local de base de datos corresponden a un valor común de ejemplo; no se reprodujo su contenido ni se modificó `.env`.

`.dockerignore` excluye `.env` y variantes, archivos Compose, Git, dependencias locales, resultados de compilación y archivos comunes de credenciales. El Dockerfile copia explícitamente código y configuración de compilación; ninguna etapa copia `.env` o Compose. La inspección de las capas de una imagen real sigue pendiente de que Docker funcione.

## Archivos afectados

- `src/storage/`: módulo, servicio S3, validación de imágenes y pruebas.
- `src/reports/`: controlador multipart, entidad, repositorio, servicio, plantilla y pruebas.
- `src/migrations/1792800000000-AddReportPhoto.ts`: migración independiente.
- `src/config/envs.ts`, `.env.example`, `.gitignore`: configuración y exclusiones.
- `package.json`, `package-lock.json`: AWS SDK, tipos Multer, actualizaciones compatibles y comandos de pruebas/migraciones.
- `Dockerfile`, `.dockerignore`, `compose.yaml`, `compose.local.yaml`, `.github/workflows/docker-publish.yml`: contenedores y publicación.
- `test/app.e2e-spec.ts`, `README.md`, `docs/parcial-ii.md` y este documento: regresión, guía y resultados.

Se conserva `docker-compose.yml`. Los documentos del primer parcial (`docs/guion-video.md` y `docs/validacion.md`) se eliminan al integrar los commits remotos, que ya los habían borrado.
