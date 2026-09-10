# AguaFixApi

API para que ciudadanos reporten fugas de agua en la vía pública. Valida el reporte, lo guarda en PostgreSQL y envía una tarjeta HTML a mantenimiento mediante Gmail SMTP.

## Tecnologías y arquitectura

NestJS 11, TypeScript, PostgreSQL 17, TypeORM 0.3, migraciones, `dotenv`, `env-var`, `bcryptjs`, Nodemailer, `class-validator` y `class-transformer`. Pruebas con Jest y Supertest; formato con Prettier y análisis con ESLint.

```text
Controller → Service → Repository → PostgreSQL
                  └→ plantilla HTML → EmailService → Gmail SMTP

src/
├── auth/       # controller, service, module y LoginDto
├── users/      # CreateUserDto, User, UsersRepository y UsersService
├── reports/    # DTO, Report, repository, service, controller y templates/
├── email/      # EmailService independiente
├── config/     # envs.ts y ValidationPipe compartido
├── database/   # opciones compartidas y data-source.ts
├── migrations/ # InitialSchema1789080000000
├── app.module.ts
└── main.ts
test/           # pruebas HTTP con PostgreSQL real y SMTP simulado
docs/           # guion de video y evidencia de validación
```

Los controladores no acceden a TypeORM. Se usa `synchronize: false` en NestJS y en el data source; las tablas se crean solamente mediante migraciones. Los endpoints son públicos por alcance de la práctica: el login verifica credenciales y no genera JWT ni sesiones.

## Requisitos e instalación

Node.js 20 o superior (validado con Node 24), npm, Git, Docker Desktop con motor activo o PostgreSQL 17 local, y una cuenta Gmail con contraseña de aplicación.

```bash
git clone https://github.com/512-userVC-ComputoEnLaNube/AguaFixApi.git
cd AguaFixApi
npm ci
```

Copia `.env.example` a `.env`: `cp .env.example .env` en Bash o `Copy-Item .env.example .env` en PowerShell. No sobrescribas un `.env` ya configurado. Edita los valores en un editor local.

## PostgreSQL

Define `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USERNAME=postgres`, `DB_NAME=aguafix` y una contraseña local en `DB_PASSWORD`. Compose usa los mismos valores y mantiene los datos en un volumen. El puerto se publica únicamente en la interfaz local.

```bash
docker compose up -d
docker compose ps
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

## Gmail SMTP

Configura en `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=userstudente06@gmail.com
SMTP_PASSWORD=
MAIL_FROM=userstudente06@gmail.com
MAINTENANCE_EMAIL=userstudente06@gmail.com
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

```json
{
  "address": "Blvd. Campestre 1203, León, Guanajuato",
  "description": "Se observa una fuga continua junto a la banqueta.",
  "severity": "high",
  "reporterPhone": "4771234567"
}
```

`severity` acepta únicamente `low`, `medium` o `high`. El cliente no proporciona `id`, `isResolved` ni `createdAt`. La API genera estos campos y establece `isResolved=false`. El correo escapa `&`, `<`, `>`, comillas simples y dobles para que la entrada ciudadana se muestre como texto.

Si falla el correo después del guardado, la respuesta 503 contiene `code: REPORT_SAVED_NOTIFICATION_FAILED`, un mensaje explícito y el objeto `report` persistido. **No repitas el POST automáticamente:** consulta `GET /reports` para evitar duplicados. No hay reintento automático del correo.

### Ejemplos curl (Bash)

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"user Alberto","email":"user@example.com","password":"Password123","isNotificationEnabled":true}'

curl -i -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"Password123"}'

curl -i -X POST http://localhost:3000/reports \
  -H 'Content-Type: application/json' \
  -d '{"address":"Blvd. Campestre 1203, León, Guanajuato","description":"Se observa una fuga continua junto a la banqueta.","severity":"high","reporterPhone":"4771234567"}'

curl -i http://localhost:3000/reports
```

En PowerShell usa `curl.exe` y bodies desde archivos o `Invoke-RestMethod`; no grabes las contraseñas en pantalla. El [guion de video](docs/guion-video.md) incluye solicitudes que mantienen la contraseña de demostración en memoria.

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

`npm test` verifica DTOs, campos prohibidos y escape HTML sin requerir PostgreSQL. `test:e2e` inicia NestJS dentro del proceso de pruebas contra la base configurada en `.env`; exige migraciones aplicadas y sustituye solo EmailService para no mandar correos por cada prueba. Crea datos con identificadores aleatorios y al terminar elimina únicamente sus propios usuarios y reportes. Usa una base de práctica. La prueba del SMTP real se realiza por separado con la API iniciada y un POST /reports.

Se fija `multer` 2.3.0 mediante `overrides` para resolver los avisos de seguridad de la versión transitiva incluida con NestJS 11. No se implementan endpoints de archivos.

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

## Video y evidencias

Consulta [guion de video](docs/guion-video.md) para una demostración de unos 5 minutos. Los resultados ejecutados se registran en [validación](docs/validacion.md). No se debe afirmar que el correo llegó ni que el remoto se actualizó sin la evidencia correspondiente.
