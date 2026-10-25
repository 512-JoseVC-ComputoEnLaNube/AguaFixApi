# AguaFixApi

API para que ciudadanos reporten fugas de agua en la vía pública. Valida el reporte y su foto, sube la imagen a S3, guarda el reporte en PostgreSQL y envía una tarjeta HTML a mantenimiento mediante Gmail SMTP.

La [guía del segundo parcial](docs/parcial-ii.md) incluye configuración de S3, pruebas paso a paso en Windows/Postman, Docker, Secrets de GitHub, publicación y guion de video.

## Tecnologías y arquitectura

NestJS 11, TypeScript, PostgreSQL 17, TypeORM 0.3, migraciones, AWS SDK v3 para S3, `dotenv`, `env-var`, `bcryptjs`, Nodemailer, `class-validator` y `class-transformer`. Pruebas con Jest y Supertest; formato con Prettier y análisis con ESLint.

```text
Controller → Service → Repository → PostgreSQL
                  ├→ StorageService → S3
                  └→ plantilla HTML → EmailService → Gmail SMTP

src/
├── auth/       # controller, service, module y LoginDto
├── users/      # CreateUserDto, User, UsersRepository y UsersService
├── reports/    # DTO, Report, repository, service, controller y templates/
├── email/      # EmailService independiente
├── storage/    # S3 y validación de fotos
├── config/     # envs.ts y ValidationPipe compartido
├── database/   # opciones compartidas y data-source.ts
├── migrations/ # InitialSchema1789080000000
├── app.module.ts
└── main.ts
test/           # pruebas HTTP con PostgreSQL real y SMTP simulado
docs/           # guía, guion y validación del segundo parcial
```

Los controladores no acceden a TypeORM. Se usa `synchronize: false` en NestJS y en el data source; las tablas se crean solamente mediante migraciones. Los endpoints son públicos por alcance de la práctica: el login verifica credenciales y no genera JWT ni sesiones.

## Requisitos e instalación

Node.js 22 o superior, npm, Git, PostgreSQL 17 local (o Docker Desktop con motor activo), un bucket S3 configurado y una cuenta Gmail con contraseña de aplicación.

```bash
git clone https://github.com/512-JoseVC-ComputoEnLaNube/AguaFixApi.git
cd AguaFixApi
npm ci
```

Copia `.env.example` a `.env`: `cp .env.example .env` en Bash o `Copy-Item .env.example .env` en PowerShell. No sobrescribas un `.env` ya configurado. Edita los valores en un editor local.

## PostgreSQL

Define `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USERNAME=postgres`, `DB_NAME=aguafix` y una contraseña local en `DB_PASSWORD`. Compose usa los mismos valores y mantiene los datos en un volumen. El puerto se publica únicamente en la interfaz local.

```bash
docker compose -f compose.yaml up -d postgres
docker compose -f compose.yaml ps
npm run migration:run
npm run migration:show
```

Con PostgreSQL existente, crea únicamente la base de datos y el usuario si faltan. No crees manualmente las tablas de la aplicación. Ajusta `.env` y ejecuta las migraciones.

La migración `InitialSchema1789080000000` crea `SYSTEM_USER` y `WATER_REPORT`. La primera guarda usuarios con correo único y hash bcrypt; la segunda guarda los reportes con severidad limitada por una restricción CHECK. Los IDs son SERIAL. `createdAt` es timestamp generado en PostgreSQL.

```bash
# Tras cambiar entidades, genera una migración con nombre descriptivo:
npm run migration:generate -- src/migrations/NombreDelCambio
# Revisa el SQL generado antes de aplicarlo:
npm run migration:run
# Revierte la última migración; la inicial elimina ambas tablas y sus datos:
npm run migration:revert
```

Los scripts usan TypeScript y dependencias de desarrollo. Con un build y dependencias de producción instaladas, se puede ejecutar `node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js`.

La migración nueva `AddReportPhoto1792800000000` agrega `photoUrl` nullable para conservar los reportes históricos. Su reversión elimina únicamente esa columna y sus enlaces. La foto es obligatoria para nuevos reportes en el endpoint. En Docker, el servicio `migrate` ejecuta `npm run migration:run:prod` antes de iniciar la API.

## Gmail SMTP

Configura en `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=
MAIL_FROM=your_email@gmail.com
MAINTENANCE_EMAIL=your_email@gmail.com
```

El campo de contraseña se muestra vacío intencionalmente. En tu cuenta Google, activa la verificación en dos pasos y abre [Contraseñas de aplicación](https://myaccount.google.com/apppasswords). Crea una para AguaFixApi y pega el valor únicamente en el `.env` local, en una sola línea, eliminando espacios normales, espacios no separables, tabulaciones y saltos de línea. No uses tu contraseña habitual. Algunas cuentas administradas o configuraciones de seguridad no ofrecen esta opción; consulta la [ayuda oficial de Google](https://support.google.com/accounts/answer/185833).

**No subas `.env` a Git ni muestres su contenido completo.** `.gitignore` excluye `.env` y `.env.*`, salvo `.env.example`, que contiene marcadores ficticios. No actives logs SMTP de depuración ni imprimas el transporter. La aceptación SMTP confirma que Gmail aceptó el envío; la recepción debe comprobarse aparte en la bandeja del destinatario, incluyendo spam.

## Iniciar la API

```bash
npm run start:dev
# O ejecutar el código compilado:
npm run build
npm run start:prod
```

Base URL: `http://localhost:3000`, configurable mediante `PORT`.

## Endpoints

| Método | Ruta             | Resultado                                                                 |
| ------ | ---------------- | ------------------------------------------------------------------------- |
| POST   | `/auth/register` | 201, usuario sin contraseña; 409 si el correo existe                      |
| POST   | `/auth/login`    | 200, mensaje y usuario; 400 si las credenciales son incorrectas           |
| POST   | `/reports`       | 201, reporte guardado y correo aceptado; 503 si se guardó pero falló SMTP |
| GET    | `/reports`       | 200, todos los reportes del más reciente al más antiguo                   |

Los bodies se validan mediante DTOs. Los campos extra se rechazan con 400. Se recortan los extremos de textos y se normalizan los correos a minúsculas. El teléfono admite de 10 a 15 dígitos, `+` inicial, espacios, guiones y paréntesis. Dirección: 1–500 caracteres; descripción: 1–5000; nombre: 1–120; contraseña de registro: 8–72 caracteres y como máximo 72 bytes UTF-8 para evitar truncamiento bcrypt.

### Registro

```json
{
  "name": "Juan",
  "email": "user@example.com",
  "password": "Password123",
  "isNotificationEnabled": true
}
```

La contraseña de este ejemplo es ficticia. `isNotificationEnabled` es opcional y vale `true` por defecto, para reflejar la preferencia inicial de recibir notificaciones. En esta práctica es un dato del usuario: el envío de reportes siempre se dirige a `MAINTENANCE_EMAIL`. Se hashea la contraseña con bcrypt, coste 12, y nunca se devuelve el hash. El índice único también protege registros concurrentes del mismo correo.

### Login

```json
{ "email": "user@example.com", "password": "Password123" }
```

Devuelve `{ "message": "Inicio de sesión exitoso", "user": { ... } }`. Un correo inexistente o contraseña equivocada produce `BadRequestException` con el mensaje exacto `Correo o contraseña incorrectos`.

### Crear reporte

Usa `multipart/form-data` con `address`, `description`, `severity` y `reporterPhone` como texto, y un archivo obligatorio llamado `photo`. Se aceptan JPEG, PNG y WebP hasta 5 MiB; se verifica el contenido y se genera una clave única bajo `reports/` en S3.

La respuesta incluye `photoUrl`. El listado agrega también `repairPhotoUrl: null`, porque no hay un flujo de fotos de reparación. Los reportes históricos conservan `photoUrl: null`. La [guía de S3](docs/parcial-ii.md#configurar-s3) explica los permisos requeridos para que el enlace sea accesible al destinatario.

`severity` acepta únicamente `low`, `medium` o `high`. El cliente no proporciona `id`, `isResolved` ni `createdAt`. La API genera estos campos y establece `isResolved=false`. El correo escapa `&`, `<`, `>`, comillas simples y dobles para que la entrada ciudadana se muestre como texto.

Si falla el correo después del guardado, la respuesta 503 contiene `code: REPORT_SAVED_NOTIFICATION_FAILED`, un mensaje explícito y el objeto `report` persistido. **No repitas el POST automáticamente:** consulta `GET /reports` para evitar duplicados. No hay reintento automático del correo.

### Ejemplos curl (Bash)

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Juan","email":"user@example.com","password":"Password123","isNotificationEnabled":true}'

curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"Password123"}'

curl -i -X POST http://localhost:3000/reports \
  -F 'address=Blvd. Campestre 1203, León, Guanajuato' \
  -F 'description=Se observa una fuga continua junto a la banqueta.' \
  -F 'severity=high' \
  -F 'reporterPhone=4771234567' \
  -F 'photo=@foto.jpg'

curl -i http://localhost:3000/reports
```

En PowerShell usa `curl.exe` y bodies desde archivos o `Invoke-RestMethod`; no grabes las contraseñas en pantalla. La [guía del segundo parcial](docs/parcial-ii.md) detalla las solicitudes en Postman y el orden del video.

## Pruebas, lint y build

```bash
npm run format
npm run format:check
npm run lint
npm test
npm run build
npm run migration:run
npm run test:e2e
npm audit
```

`npm test` verifica DTOs, cargas multipart, límites, compensación de errores, campos prohibidos y escape HTML sin requerir PostgreSQL. `test:e2e` inicia NestJS dentro del proceso de pruebas contra la base configurada en `.env`; exige migraciones aplicadas y sustituye EmailService y StorageService. Crea datos con identificadores aleatorios y al terminar elimina únicamente sus propios usuarios y reportes. Usa una base de práctica. Las pruebas de S3 y SMTP reales se realizan por separado con la API iniciada y un POST /reports.

Se fija `multer` 2.5.0 mediante `overrides` para corregir los avisos de seguridad de versiones anteriores. NestJS 11 se actualiza a una revisión compatible. Las dependencias de ejecución y desarrollo quedan registradas en el lockfile.

## Solución de problemas

| Problema                                  | Acción                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motor Docker no disponible                | Inicia Docker Desktop y espera a que el motor esté listo. En Windows revisa su configuración WSL 2. También puedes usar PostgreSQL local.                   |
| Puerto 5432 ocupado                       | Usa la instancia existente o cambia DB_PORT en `.env` antes de iniciar Compose.                                                                             |
| `ECONNREFUSED` o autenticación PostgreSQL | Revisa servicio, host, puerto, usuario y contraseña. Cambiar `.env` no cambia la contraseña de un volumen ya inicializado.                                  |
| La tabla no existe                        | Ejecuta `npm run migration:run` y comprueba `migration:show`.                                                                                               |
| SMTP falla                                | Revisa contraseña de aplicación, verificación en dos pasos, conexión al puerto 465 y configuración del remitente. El reporte guardado permanece disponible. |
| Correo no visible                         | Revisa spam y la cuenta destinataria. Aceptación SMTP y recepción son evidencias distintas.                                                                 |
| Respuesta 400                             | Revisa formatos, severidad y campos extra. Las contraseñas no se normalizan ni recortan.                                                                    |
| Correo ya registrado                      | Usa otro correo o inicia sesión. No borres usuarios para resolver un registro duplicado.                                                                    |
| Generar migración no detecta cambios      | Es normal si las entidades ya coinciden con el esquema.                                                                                                     |

## Segundo parcial

Consulta la [guía y guion del segundo parcial](docs/parcial-ii.md) y sus [resultados de validación](docs/validacion-parcial-ii.md). La imagen Docker se construye, se prueba y se publica en GitHub Actions; no requiere Docker en el equipo de desarrollo.
