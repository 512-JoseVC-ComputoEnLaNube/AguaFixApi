# Guion de demostración de AguaFixApi

Duración sugerida: 5–6 minutos. Este archivo es un guion para grabación manual; no es evidencia de un MP4 grabado.

## Preparación fuera de cámara

Configura `.env`, aplica migraciones y prepara la ventana de Gmail de la cuenta destinataria. Cierra pestañas con secretos, desactiva notificaciones y usa captura de una ventana o una región. No grabes historial del terminal, bodies que contengan passwords, tokens, el `.env` completo ni logs SMTP de depuración. Mantén ocultos los correos ajenos a esta demostración.

La contraseña de aplicación debe quedar únicamente en el `.env` local. Para mostrar su configuración, usa la vista redactada siguiente; nunca abras el archivo completo durante la grabación. El rótulo `SMTP_PASSWORD=[OCULTO]` no debe dejar visible ningún carácter ni la longitud real.

En PowerShell, desde la raíz del repositorio, prepara en memoria un usuario ficticio; ejecuta esto antes de grabar. No guardes ni imprimas `$demoPassword`:

```powershell
$demoEmail = 'demo-' + [guid]::NewGuid().ToString('N') + '@example.com'
$demoPassword = [guid]::NewGuid().ToString('N')
$demoHeaders = @{ 'Content-Type' = 'application/json; charset=utf-8' }
$demoBase = 'http://localhost:3000'
```

## Escenas y solicitudes HTTP

| Tiempo    | Qué mostrar                 | Acción / explicación                                                                                                  |
| --------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Repositorio y árbol `src/`  | Explicar Controller → Service → Repository, los módulos de auth, users, reports y email.                              |
| 0:30–0:50 | Vista redactada del entorno | Mostrar solo puerto, base, host SMTP, remitente/destinatario y marcador de contraseña.                                |
| 0:50–1:15 | PostgreSQL activo           | `docker compose ps`; si se usa PostgreSQL local, `pg_isready -h localhost -p 5432`.                                   |
| 1:15–1:35 | Migración aplicada          | `npm run migration:show`; mostrar `[X] InitialSchema1789080000000`.                                                   |
| 1:35–1:55 | Arranque NestJS             | `npm run start:prod` después de `npm run build`; mostrar rutas registradas.                                           |
| 1:55–2:25 | Registro y duplicado        | Ejecutar solicitudes de registro; mostrar usuario sin password y HTTP 409 en el duplicado.                            |
| 2:25–2:55 | Login válido e incorrecto   | Mostrar respuesta de éxito y `Correo o contraseña incorrectos` con HTTP 400.                                          |
| 2:55–3:35 | Creación de reporte         | Mostrar body sin secretos, POST /reports y respuesta con id, createdAt e isResolved=false.                            |
| 3:35–4:00 | Validación y listado        | Enviar severidad inválida y GET /reports; mostrar HTTP 400 y orden reciente primero.                                  |
| 4:00–4:30 | Gmail                       | Abrir únicamente el mensaje de prueba recibido; mostrar remitente, destinatario, título y tarjeta HTML.               |
| 4:30–5:00 | Calidad                     | Mostrar resultados reales de lint, Jest, E2E y build.                                                                 |
| 5:00–5:30 | Historial y remoto          | `git log --oneline -5`, `git status`, `git ls-remote origin refs/heads/main`; abrir GitHub y comprobar último commit. |

### Vista redactada del entorno

Ejecuta este bloque con la captura limitada al terminal. Lee únicamente valores permitidos y nunca imprime ninguna contraseña:

```powershell
$allowed = '^(PORT|DB_HOST|DB_PORT|DB_NAME|SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|MAIL_FROM|MAINTENANCE_EMAIL)='
Get-Content -LiteralPath .env | Where-Object { $_ -match $allowed }
'SMTP_PASSWORD=[OCULTO]'
'DB_PASSWORD=[OCULTO]'
```

### Registro válido (POST /auth/register)

```powershell
$registerBody = @{ name = 'Ciudadano de prueba'; email = $demoEmail; password = $demoPassword; isNotificationEnabled = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$demoBase/auth/register" -Headers $demoHeaders -Body ([Text.Encoding]::UTF8.GetBytes($registerBody))
```

Repite la solicitud para mostrar el 409. Si PowerShell presenta detalles del cuerpo de la solicitud en un error, usa PowerShell 7 con `Invoke-WebRequest -SkipHttpErrorCheck` y muestra solo `StatusCode` y `Content` de la respuesta. Nunca muestres `$registerBody`.

### Login válido e incorrecto (POST /auth/login)

```powershell
$loginBody = @{ email = $demoEmail; password = $demoPassword } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$demoBase/auth/login" -Headers $demoHeaders -Body $loginBody
$wrongBody = @{ email = $demoEmail; password = [guid]::NewGuid().ToString('N') } | ConvertTo-Json
$response = Invoke-WebRequest -Method Post -Uri "$demoBase/auth/login" -Headers $demoHeaders -Body $wrongBody -SkipHttpErrorCheck
$response.StatusCode
$response.Content
```

### Reporte (POST /reports) y listado (GET /reports)

```powershell
$reportBody = @{
  address = 'Blvd. Campestre 1203, León, Guanajuato'
  description = 'PRUEBA DE VIDEO: fuga simulada junto a la banqueta; no requiere movilización.'
  severity = 'high'
  reporterPhone = '4771234567'
} | ConvertTo-Json
$reportBody
Invoke-RestMethod -Method Post -Uri "$demoBase/reports" -Headers $demoHeaders -Body ([Text.Encoding]::UTF8.GetBytes($reportBody))
Invoke-RestMethod -Uri "$demoBase/reports" | ConvertTo-Json -Depth 5
$invalidBody = ($reportBody | ConvertFrom-Json)
$invalidBody.severity = 'urgent'
$response = Invoke-WebRequest -Method Post -Uri "$demoBase/reports" -Headers $demoHeaders -Body ([Text.Encoding]::UTF8.GetBytes(($invalidBody | ConvertTo-Json))) -SkipHttpErrorCheck
$response.StatusCode
$response.Content
```

El POST válido envía un correo real. Un 503 con `REPORT_SAVED_NOTIFICATION_FAILED` significa que ya se guardó; no repitas el POST para intentar arreglar el envío. Resuelve SMTP fuera de cámara y utiliza una nueva prueba explícita si es necesaria.

## Grabación y evidencias finales

Usa un grabador local de ventana o región y exporta MP4. Revisa el video completo antes de compartirlo. Si un secreto apareció siquiera un fotograma, descarta esa toma y repítela después de ocultarlo. No subas el MP4 pesado al repositorio.

- Repositorio y rama predeterminada.
- Entorno redactado con contraseña completamente oculta.
- PostgreSQL ejecutándose y migración aplicada.
- NestJS activo con las cuatro rutas.
- Registro correcto, duplicado, login correcto e incorrecto.
- Reporte guardado, severidad inválida y listado ordenado.
- Aceptación SMTP en logs sin credenciales.
- Mensaje HTML recibido en Gmail: evidencia independiente de aceptación SMTP.
- Resultados reales de formato, lint, pruebas y build.
- Entre 3 y 5 commits y hash remoto igual al local.
- MP4 revisado o, si no se pudo grabar, este guion con los pendientes identificados.
