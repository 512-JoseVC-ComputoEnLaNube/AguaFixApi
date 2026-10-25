# Agua Fix II: configuración, pruebas y publicación

## Cambios

Los reportes nuevos reciben una imagen obligatoria en `POST /reports` mediante multipart. Se valida el DTO y el contenido de la imagen antes de subirla a S3, se guarda su URL en PostgreSQL y después se envía el correo. Se conservan registro, login, listado y la respuesta 503 con el reporte guardado cuando falla SMTP.

- `StorageModule` exporta `StorageService.uploadFile(file, folder): Promise<string>`.
- Las imágenes aceptadas son JPEG, PNG y WebP, con límite de 5 MiB (5 242 880 bytes). La firma del archivo determina el tipo de contenido; no se confía en la extensión ni en el MIME enviado por el cliente. No se admiten SVG.
- Cada objeto usa `reports/<UUID>.<extensión>`; no se conserva el nombre proporcionado por el cliente.
- `AddReportPhoto1792800000000` agrega `photoUrl` nullable a `WATER_REPORT`. Los reportes anteriores permanecen con `null`; el endpoint exige foto para los nuevos.
- `GET /reports` conserva los campos anteriores y agrega `photoUrl` y `repairPhotoUrl: null`. Este último representa la ausencia de foto de reparación. No existe un flujo para subirla.
- La tarjeta HTML conserva dirección, descripción, severidad y teléfono e incluye `<img>`. Los valores dinámicos se escapan.
- No se modifica la migración inicial y `synchronize` permanece en `false`.

Si falla S3, no se guarda el reporte. Se intenta borrar el objeto incluso ante un timeout de subida. Si falla PostgreSQL después de subir, se intenta borrar esa foto. Si falla la eliminación, el log incluye únicamente la clave del objeto que debe revisarse en S3. No hay una transacción distribuida entre S3 y PostgreSQL: una caída abrupta del proceso o una respuesta de commit perdida puede requerir reconciliar registros y objetos manualmente.

Si falla SMTP, la foto y el reporte permanecen guardados. La respuesta es 503 con `code: REPORT_SAVED_NOTIFICATION_FAILED` y `report`. Consulta el listado; no repitas el POST para reenviar el correo.

## Configurar S3

1. Elige un bucket de propósito general y su región real. Para este procedimiento se utiliza un endpoint regional comercial de AWS y cifrado SSE-S3. Mantén Object Ownership en **Bucket owner enforced**: no se usan ACL.
2. Agrega localmente `AWS_REGION` y `AWS_S3_BUCKET` a `.env`.
3. Configura `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en el mismo archivo, o utiliza el proveedor de credenciales del SDK (por ejemplo, un rol IAM en AWS). Para credenciales temporales agrega también `AWS_SESSION_TOKEN`. No pegues claves en chats ni las incluyas en comandos grabados. Compose pasa las variables de `.env` únicamente al contenedor en ejecución.
4. La identidad de la API necesita esta política IAM, sustituyendo `NOMBRE_REAL_DEL_BUCKET`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::NOMBRE_REAL_DEL_BUCKET/reports/*"
    }
  ]
}
```

5. Para permitir abrir las fotos sin iniciar sesión, agrega esta **bucket policy**, limitada al prefijo de reportes:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadReportPhotos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::NOMBRE_REAL_DEL_BUCKET/reports/*"
    }
  ]
}
```

La política no concede listado, escritura pública ni lectura de otros prefijos. Revisa y conserva las demás declaraciones existentes del bucket; no reemplaces a ciegas su política.

6. En **Permissions → Block public access**, conserva `BlockPublicAcls` e `IgnorePublicAcls` activados. Una política pública requiere que `BlockPublicPolicy` y `RestrictPublicBuckets` no la bloqueen. Comprueba también las restricciones de cuenta u organización, que prevalecen sobre las del bucket. No cambies controles de toda la cuenta sin revisar su alcance. Si tu organización prohíbe lectura pública directa, esta configuración requiere otro mecanismo de distribución y no debe declararse terminada.
7. La API devuelve `https://s3.REGION.amazonaws.com/BUCKET/reports/UUID.ext`. Construir esa URL no otorga acceso: compruébala en una ventana privada. Una respuesta 403 requiere revisar permisos y cifrado. La API no modifica políticas ni usa `public-read`.

No se requieren CORS para la carga desde la API ni para mostrar una imagen con `<img>`. Las fotos de este prefijo serán accesibles a quien conozca el enlace. Usa fotografías de prueba apropiadas.

Referencias: [políticas por prefijo de S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html), [Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html), [validación de archivos de NestJS](https://docs.nestjs.com/techniques/file-upload).

## Guía de pruebas en Windows PowerShell

### 1. Dependencias y variables

```powershell
Set-Location 'C:\Users\alber\Documents\Codex\2026-09-10\files-pasted-by-the-user-desarrolla\AguaFixApi'
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Usa Node.js 22 o superior. Completa `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAINTENANCE_EMAIL` y las variables AWS anteriores. Para Gmail: puerto 465, `SMTP_SECURE=true` y contraseña de aplicación. `PORT` vale 3000 por defecto.

Resultado esperado: instalación sin errores y configuración guardada solamente en `.env`, que Git ignora. No muestres ese archivo durante el video.

### 2. PostgreSQL y migración

Si ya utilizas PostgreSQL local, inicia esa instancia, conserva sus credenciales y puerto y ejecuta solamente las migraciones. En esta computadora, la instancia del primer parcial usa el puerto `55432`. Si aparece `ECONNREFUSED`, comprueba e inicia esa instancia:

```powershell
$pgRoot = 'C:\Users\alber\Documents\Codex\2026-09-10\files-pasted-by-the-user-desarrolla\work\postgres'
& "$pgRoot\pgsql\bin\pg_ctl.exe" -D "$pgRoot\data" status
# Ejecuta start solamente si indica que no hay servidor activo.
& "$pgRoot\pgsql\bin\pg_ctl.exe" -D "$pgRoot\data" -l "$pgRoot\startup-20261024.log" -w start
& "$pgRoot\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 55432
npm run migration:run
```

Espera `accepting connections` antes de iniciar la API. Mantén el log fuera de `data` para evitar conflictos de acceso durante la recuperación en Windows. No inicies otro PostgreSQL de Docker en el mismo puerto mientras esta instancia esté activa.

Como alternativa, en un equipo con Docker Desktop funcionando (no aplica en esta computadora, que no tiene virtualización disponible):

```powershell
docker compose -f compose.yaml up -d postgres
docker compose -f compose.yaml ps
npm run migration:show
npm run migration:run
npm run migration:show
```

Para la API ejecutada en Windows, `DB_HOST=localhost` y `DB_PORT` debe coincidir con el puerto publicado. El servicio debe aparecer **healthy**. Las dos migraciones deben mostrar `[X]`. En una base existente solo se aplica la nueva. Si un servicio ya ocupa el puerto, usa el PostgreSQL existente o un puerto libre.

`compose.yaml` conserva el servicio `postgres` y el volumen lógico `postgres_data` del Compose anterior. Ejecuta siempre desde la misma carpeta y con el mismo nombre de proyecto Compose usado anteriormente para reutilizar el volumen. Si antes usabas `-p`, conserva ese valor. No ejecutes `down -v`.

`docker-compose.yml` se conserva como configuración anterior de PostgreSQL. Los comandos de esta guía indican explícitamente `-f compose.yaml` para evitar ambigüedad.

### 3. Arrancar la API

```powershell
npm run start:dev
```

Resultado esperado: Nest inicia y escucha en `http://localhost:3000` (o en el `PORT` elegido).

### 4. Crear un reporte con Postman

Usa `POST http://localhost:3000/reports`, **Body → form-data**:

| Key           | Tipo | Valor de prueba                                     |
| ------------- | ---- | --------------------------------------------------- |
| address       | Text | Calle de prueba 123                                 |
| description   | Text | Fuga junto a la banqueta                            |
| severity      | Text | high                                                |
| reporterPhone | Text | 4771234567                                          |
| photo         | File | Selecciona una foto JPEG, PNG o WebP menor de 5 MiB |

Son los cuatro campos reales de `CreateReportDto`; no hay campos numéricos. El teléfono permanece como texto. `severity` admite exclusivamente `low`, `medium` o `high`. No envíes `photoUrl`, `repairPhotoUrl`, `id`, `isResolved` ni `createdAt`. Elimina cualquier encabezado Content-Type escrito manualmente: Postman debe generar el boundary multipart.

Resultado esperado: **201**, datos del reporte, `id`, `createdAt`, `isResolved: false` y una `photoUrl` real. Guarda el ID para las siguientes comprobaciones. Una respuesta 503 con `REPORT_SAVED_NOTIFICATION_FAILED` indica que se guardó, pero debes corregir SMTP.

### 5. Confirmar persistencia

Consulta `GET http://localhost:3000/reports` y localiza el ID. Debe conservar exactamente la misma URL. Para comprobarlo directamente en el PostgreSQL local (pide la contraseña de `.env`; sustituye usuario y base por los tuyos):

```powershell
& "$pgRoot\pgsql\bin\psql.exe" -h 127.0.0.1 -p 55432 -U TU_USUARIO -d TU_BASE -c 'SELECT "id", "photoUrl" FROM "WATER_REPORT" ORDER BY "id" DESC LIMIT 5;'
```

Con PostgreSQL de Compose, en un equipo con Docker:

```powershell
'SELECT "id", "photoUrl" FROM "WATER_REPORT" ORDER BY "id" DESC LIMIT 5;' | docker compose -f compose.yaml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Resultado esperado: URL persistida en el reporte nuevo; los registros anteriores pueden tener `NULL`.

### 6. Verificar S3

Abre `photoUrl` en una ventana privada, sin iniciar sesión en AWS. Debe mostrarse la imagen. En la consola de S3 abre el bucket y `reports/`: debe existir el UUID de la URL, con el tipo de contenido de la imagen. La consola requiere permisos propios de administración/listado, distintos de los mínimos de la API.

### 7. Verificar correo

Revisa la cuenta configurada en `MAINTENANCE_EMAIL`, incluyendo spam. Deben aparecer dirección, descripción, severidad, teléfono y la foto. Algunos clientes requieren habilitar la visualización de imágenes remotas. La aceptación del servidor SMTP no sustituye esta comprobación visual.

### 8. Verificar GET /reports

Resultado esperado: **200**, arreglo ordenado del más reciente al más antiguo, todos los campos anteriores, `photoUrl` y `repairPhotoUrl: null`. No debe aparecer una URL de reparación inventada ni duplicada desde la fuga.

### 9. Reporte sin foto

Duplica la solicitud válida y desmarca `photo`. Resultado esperado: **400**, mensaje `El archivo photo es obligatorio`, sin un nuevo reporte ni objeto en S3.

### 10. Archivo inválido y límite

- Adjunta un archivo de texto renombrado como `.png`: **400**, sin subida ni reporte.
- Adjunta una imagen mayor de 5 MiB: **413**, sin subida ni reporte.
- Usa `file` en lugar de `photo`, o agrega dos archivos: **400**.
- Usa `severity=urgent`, teléfono corto o dirección vacía: **400**, sin efectos en S3, PostgreSQL o correo.

### 11. Regresión del primer parcial

- `POST /auth/register`, Body raw JSON: `name`, `email`, `password` (8–72 caracteres y máximo 72 bytes UTF-8), `isNotificationEnabled` opcional booleano. Usa una cuenta de prueba nueva. Espera **201**, sin contraseña en la respuesta.
- Repite el registro: **409**.
- `POST /auth/login`, JSON con `email` y `password`: **200** con credenciales válidas y **400** con contraseña incorrecta.
- Comprueba que los reportes históricos siguen en el listado y que el reporte con foto se guarda y notifica. Crear reportes ahora exige multipart y foto, conforme al segundo parcial.
- En una base de práctica con migraciones aplicadas:

```powershell
npm test
npm run test:e2e
npm run lint
npm run build
npm run format:check
npm audit
```

Las pruebas unitarias y HTTP usan servicios simulados. Las E2E usan PostgreSQL real, sustituyen S3 y SMTP y eliminan únicamente los registros creados por esas pruebas. No comprueban tus permisos AWS ni entregan correos reales. El flag experimental de módulos de Jest permite usar la detección de archivos ESM de NestJS.

### 12. Construir y probar la imagen en GitHub Actions

Esta computadora no puede ejecutar Docker (no hay virtualización disponible para WSL 2), por lo que la imagen no se construye localmente. El workflow `.github/workflows/docker-publish.yml` la construye y la prueba en un runner de GitHub antes de publicarla:

1. Construye la imagen con el `Dockerfile` (Node 22 Alpine) y la carga en el runner sin publicarla.
2. Comprueba que existan `dist/main.js` y `dist/database/data-source.js`, y que no se incluyan `.env` ni archivos Compose.
3. Inicia un PostgreSQL 17 temporal, ejecuta `npm run migration:run:prod` desde la imagen y arranca la API con valores desechables. Espera **200** en `GET /reports` y **400** en `POST /reports` sin foto. No usa credenciales reales de AWS, SMTP ni de tu base.
4. Solo en un push a `main` inicia sesión en Docker Hub y publica `josep210d/aguafix-api:latest`.

Si un paso falla, no se publica nada. Revisa el paso en rojo y el paso **Registros de la API**.

Hay dos formas de ejecutar la verificación sin publicar:

- **Rama de prueba** (antes del push grabado): un push a cualquier rama `prueba/**` ejecuta los pasos 1–3. Ver [Corrida de prueba](#corrida-de-prueba-antes-de-grabar).
- **Manual**: **Actions → Publicar imagen Docker → Run workflow**. Este botón aparece solo cuando el workflow ya está en `main`.

`compose.local.yaml` se conserva para equipos con Docker: cambia las imágenes de API y migración a `aguafix-api:local`, con `pull_policy: never`. `compose.yaml` mantiene como requisito final `josep210d/aguafix-api:latest`. No se incluyen archivos Compose dentro de ninguna etapa de construcción. Las copias del Dockerfile son explícitas.

## Reversión de la migración

Prueba una reversión únicamente en una copia de la base o en una base desechable. Comprueba antes que la última migración aplicada sea `AddReportPhoto1792800000000`:

```powershell
npm run migration:show
npm run migration:revert
npm run migration:run
```

La reversión quita únicamente `photoUrl`; no elimina tablas ni reportes, pero sí pierde los valores de esa columna. Reaplicarla devuelve `NULL`, no reconstruye enlaces. No reviertas una segunda vez: la migración inicial sí elimina ambas tablas. La reversión tampoco borra objetos en S3.

## GitHub Actions y Docker Hub

Repositorio: [AguaFixApi](https://github.com/512-JoseVC-ComputoEnLaNube/AguaFixApi).
Destino configurado: [josep210d/aguafix-api](https://hub.docker.com/r/josep210d/aguafix-api). Este enlace no constituye evidencia de publicación.

1. En Docker Hub, crea el repositorio público `aguafix-api` bajo `josep210d`.
2. Crea un token de acceso de Docker Hub con permiso de lectura y escritura para publicar.
3. En GitHub abre **Settings → Secrets and variables → Actions → New repository secret**.
4. Crea `DOCKER_USER` con `josep210d` y `DOCKER_PASSWORD` con el token. No pegues el token en documentación, archivos versionados ni chats.
5. El workflow `.github/workflows/docker-publish.yml` se ejecuta con cada push a `main`: construye, verifica y publica `latest`. En ramas `prueba/**` y en ejecuciones manuales solo construye y verifica. Únicamente usa esos dos Secrets para autenticarse, y solo en el paso de publicación. No recibe credenciales AWS, SMTP o PostgreSQL reales.

Las versiones de checkout y acciones Docker se basan en la [documentación oficial de Docker](https://docs.docker.com/guides/gha/).

Antes de publicar, revisa que únicamente estén seleccionados los cambios de esta actividad. `bruno/` contiene trabajo local previo y no debe agregarse por accidente. La inspección inicial encontró `main` local en `b3148cb`, tres commits detrás de `origin/main` (`a7c0126`). Esas revisiones remotas anonimizan los ejemplos del README, eliminan su sección de video y borran `docs/guion-video.md` y `docs/validacion.md` del primer parcial. El README local ya incorpora esos cambios (con la URL de clonación correcta). Integra la diferencia antes del push, sin forzarlo.

No se deben hacer commits ni push hasta completar las pruebas manuales y autorizar expresamente la publicación. Antes del commit, inicia la grabación.

## Guion breve del video

1. **Cambio, commit y push a main.** Muestra un cambio real, por ejemplo el interceptor `photo`, la subida a S3 y el guardado de `photoUrl`. Después de las pruebas y autorización, muestra el commit real con un título como `Agregar fotos a reportes` y el push a `main`. No uses commits vacíos ni cambios artificiales.
2. **GitHub Actions.** Abre la pestaña Actions del repositorio. Muestra la ejecución correspondiente al mismo commit, los pasos de construcción/publicación y el resultado verde. No muestres Secrets.
3. **Docker Hub.** Abre el repositorio de la imagen, muestra `latest`, su fecha de actualización y el digest. Compáralo con el resultado de la construcción publicada.
4. **Demostración funcional.** Envía el multipart desde Postman con una foto real de prueba. Muestra el 201 y `photoUrl`, el objeto bajo `reports/` en S3 y el correo recibido con la foto visible.

Para grabar en Windows puede usarse la herramienta de grabación disponible en el equipo. Mantén cerrados `.env`, la configuración de credenciales y los diálogos con tokens. Las evidencias se registran después de cada operación real.

## Corrida de prueba antes de grabar

Ejecuta estos bloques en PowerShell, desde la carpeta del proyecto, después de completar las pruebas manuales.

**1. Integrar los tres commits remotos.** El README local ya contiene sus cambios, así que se aparta, se avanza `main` y se restaura:

```powershell
git fetch origin
git stash push -m 'README segundo parcial' -- README.md
git merge --ff-only origin/main
git checkout 'stash@{0}' -- README.md
git stash drop
git log --oneline -1
```

Resultado esperado: `a7c0126 Remove video README`. `docs/guion-video.md` y `docs/validacion.md` desaparecen, como en el remoto. Si `merge --ff-only` falla, detente: hay commits locales que no se conocían.

**2. Seleccionar solo los archivos de la actividad** (sin `bruno/`):

```powershell
git add src test package.json package-lock.json .env.example .gitignore README.md docs Dockerfile .dockerignore compose.yaml compose.local.yaml .github
git status
```

Comprueba que `bruno/` siga sin seguimiento y que no aparezcan `.env` ni `dist/`.

**3. Probar exactamente esos archivos en una rama temporal**, sin crear commits en `main`:

```powershell
$arbol = git write-tree
$prueba = git commit-tree $arbol -p HEAD -m 'Prueba de imagen Docker'
git push origin "${prueba}:refs/heads/prueba/docker"
```

En **Actions** debe aparecer la ejecución de `prueba/docker` en verde, con los pasos de inicio de sesión y publicación omitidos. Después elimina la rama temporal:

```powershell
git push origin --delete prueba/docker
```

Los archivos siguen preparados. Con la grabación iniciada, el commit real contiene lo mismo que se probó:

```powershell
git commit -m 'Agregar fotos a reportes'
git push origin main
```

## Ejecutar la imagen publicada

Esta comprobación requiere Docker y no se puede realizar en esta computadora. La evidencia de publicación es la ejecución en verde de Actions y la etiqueta `latest` con su fecha y digest en Docker Hub. En un equipo con Docker, después de confirmar que Actions publicó correctamente:

```powershell
docker compose -f compose.yaml pull api migrate
docker compose -f compose.yaml up -d postgres
docker compose -f compose.yaml run --rm migrate
docker compose -f compose.yaml up -d --force-recreate migrate api
docker compose -f compose.yaml ps -a
```

El primer paso descarga `josep210d/aguafix-api:latest`. El servicio de migraciones espera PostgreSQL y ejecuta las pendientes; repetirlo no reaplica las ya registradas. La API depende de su finalización correcta. Repite POST, GET, acceso público de la imagen y comprobación del correo. No se eliminan volúmenes.
