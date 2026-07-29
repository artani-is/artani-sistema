# Despliegue de Artani en un droplet de DigitalOcean

Guía para levantar el sistema completo con Docker Compose detrás de Caddy, con
HTTPS automático de Let's Encrypt.

## Qué se despliega

| Servicio | Imagen | Puerto público | Función |
|---|---|---|---|
| `caddy` | `caddy:2-alpine` | **80, 443** | Reverse proxy, TLS automático y servidor de los archivos del cliente |
| `backend` | build de `backend/` | — (solo red interna) | API Express + Prisma |
| `frontend` | build de `frontend/` | — (contenedor efímero) | Compila el cliente y publica el resultado en un volumen |
| `db` | `postgres:18` | — (solo red interna) | PostgreSQL |

Solo Caddy escucha desde internet. **La base de datos no publica ningún puerto**:
es accesible únicamente desde la red interna de Compose, por nombre de servicio
(`db:5432`). El backend tampoco se expone directamente.

---

## 1. Requisitos previos en el droplet

```sh
# Docker Engine y el plugin de Compose
curl -fsSL https://get.docker.com | sh

docker --version && docker compose version
```

### DNS

Antes de arrancar, crea un registro **A** que apunte tu dominio a la IP pública
del droplet. Sin esto, el reto HTTP-01 de Let's Encrypt falla y Caddy no podrá
emitir el certificado.

```sh
dig +short tu-dominio.mx      # debe devolver la IP del droplet
```

### Cortafuegos

```sh
ufw allow 22/tcp        # SSH: permítelo antes de habilitar ufw
ufw allow 80/tcp        # reto ACME y redirección a HTTPS
ufw allow 443/tcp
ufw allow 443/udp       # HTTP/3
ufw enable
```

No abras el 5432. La base de datos no debe ser alcanzable desde fuera.

---

## 2. Obtener el código

```sh
git clone git@github.com:artani-is/artani-sistema.git
cd artani-sistema
```

---

## 3. Variables de entorno que debes definir tú

Copia la plantilla y **rellena todos los valores vacíos**:

```sh
cp .env.prod.example .env
nano .env
```

| Variable | Quién la define | Cómo obtenerla |
|---|---|---|
| `DOMINIO` | Tú | Tu dominio, sin `https://` ni barra final. Ej.: `artani.ejemplo.mx` |
| `ACME_EMAIL` | Tú | Correo real; Let's Encrypt avisa ahí si un certificado va a expirar |
| `POSTGRES_USER` | Tú | Nombre de usuario de la base de datos (`artani` sirve) |
| `POSTGRES_DB` | Tú | Nombre de la base de datos (`artani` sirve) |
| `POSTGRES_PASSWORD` | **Tú — genérala** | `openssl rand -base64 32` |
| `JWT_SECRET` | **Tú — genérala** | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | Opcional | Vigencia del token. Por omisión `8h` |
| `RESEND_API_KEY` | **Sí** | API key de Resend (https://resend.com/api-keys). Sin ella, la recuperación de contraseña no puede enviar correo |
| `CORREO_REMITENTE` | Opcional | Por omisión `Artani <no-reply@artani.app>`. El dominio debe estar **verificado** en tu cuenta de Resend |
| `TZ` | Opcional | Por omisión `America/Mexico_City` |

`DATABASE_URL`, `PUBLIC_BASE_URL` y `CORS_ORIGIN` **no se definen a mano**: el
compose las arma a partir de las anteriores, para que no puedan quedar
desincronizadas.

> **Contraseñas con caracteres reservados.** `DATABASE_URL` es una URL. Si tu
> `POSTGRES_PASSWORD` contiene `@ : / ? # &`, codifícalos en porcentaje
> (`@` → `%40`, `/` → `%2F`, `#` → `%23`, `&` → `%26`). Para evitarlo por
> completo, genera una sin ellos:
> ```sh
> openssl rand -base64 32 | tr -d '/+=@:?#&'
> ```

Asegura el archivo y comprueba que git lo ignora:

```sh
chmod 600 .env
git check-ignore .env && echo "OK: .env no se versiona"
```

---

## 4. Construir y arrancar

```sh
docker compose -f docker-compose.prod.yml --profile tools build
docker compose -f docker-compose.prod.yml up -d
```

> **El `--profile tools` del `build` no es opcional.** Sin él, Compose construye
> solo los servicios del perfil por omisión y deja intacta la imagen del
> servicio `migrate`. En un redespliegue eso significa seguir usando la imagen
> anterior, con las migraciones viejas incrustadas: `migrate status` informaría
> menos migraciones de las que hay en el repositorio.

El servicio `frontend` compila el cliente, copia el resultado al volumen
`frontend_dist` y **termina con código 0**: eso es lo esperado, no un fallo.
Caddy espera a que haya terminado antes de arrancar.

Comprueba el estado:

```sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy
```

La emisión del certificado tarda unos segundos. En los logs de Caddy debe
aparecer `certificate obtained successfully`.

---

## 5. Aplicar las migraciones de la base de datos

El proyecto usa **Prisma** con migraciones versionadas en
`backend/prisma/migrations/`. Estas **no se aplican solas** al arrancar: hay que
ejecutarlas de forma explícita.

Con la base de datos ya en marcha, y **tras haber reconstruido la imagen del
servicio `migrate`** (ver el aviso de la sección anterior):

```sh
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

Ese es el comando exacto. Internamente ejecuta `prisma migrate deploy`, que
aplica únicamente las migraciones pendientes del repositorio, sin comparar ni
regenerar el esquema y sin destruir datos.

Para revisar qué se aplicaría antes de hacerlo:

```sh
docker compose -f docker-compose.prod.yml --profile tools run --rm \
  migrate pnpm exec prisma migrate status
```

Comprueba que el número de migraciones encontradas coincide con el del
repositorio:

```sh
ls backend/prisma/migrations | grep -v migration_lock | wc -l
```

Si `migrate status` informa menos, la imagen del servicio está desactualizada:
reconstrúyela con `--profile tools build` antes de continuar.

> **Nunca uses `prisma migrate reset` ni `prisma db push` en producción.** El
> primero borra la base de datos completa; el segundo altera el esquema sin
> dejar registro de migración.

### Usuario inicial

El sistema no tiene registro público: la cuenta del artesano se da de alta como
tarea administrativa, mediante el script `seed:artesano`. No insertes el
artesano directamente con `psql`: el script es el único camino que garantiza
que la contraseña se guarde hasheada con bcrypt.

**Forma interactiva** (recomendada: la contraseña no queda en el historial de
la terminal):

```sh
docker compose -f docker-compose.prod.yml exec backend pnpm seed:artesano
```

Pide los datos uno a uno y captura la contraseña oculta.

**Forma no interactiva** (para automatizar). Define las variables y ejecuta:

| Variable | Obligatoria | Contenido |
|---|---|---|
| `ARTESANO_CURP` | Sí | CURP de 18 caracteres |
| `ARTESANO_NOMBRES` | Sí | Nombre o nombres |
| `ARTESANO_APELLIDO_PATERNO` | Sí | Apellido paterno |
| `ARTESANO_APELLIDO_MATERNO` | No | Apellido materno |
| `ARTESANO_CORREO` | Sí | Correo con el que iniciará sesión |
| `ARTESANO_TELEFONO` | No | Teléfono de contacto |
| `ARTESANO_TALLER` | No | Nombre del taller |
| `ARTESANO_CONTRASENA` | Sí | Mínimo 12 caracteres, con letras y números |

```sh
docker compose -f docker-compose.prod.yml exec \
  -e ARTESANO_CURP=XXXX000000HXXXXX00 \
  -e ARTESANO_NOMBRES='Nombre' \
  -e ARTESANO_APELLIDO_PATERNO='Apellido' \
  -e ARTESANO_CORREO='artesano@ejemplo.mx' \
  -e ARTESANO_CONTRASENA='...' \
  backend pnpm seed:artesano
```

El script valida los datos antes de tocar la base de datos, rechaza contraseñas
débiles o cuentas duplicadas, y no imprime la contraseña en ningún momento. Si
la pasaste por entorno, bórrala después del historial de tu terminal:

```sh
history -d $(history 1)   # bash
```

> El repositorio incluye además `pnpm seed`, una semilla de **desarrollo** con
> credenciales conocidas y publicadas. No la ejecutes en el droplet.

> **Solo para desarrollo:** con `CORREO_TRANSPORTE=consola` los correos se
> escriben en la salida del servidor en lugar de enviarse, lo que permite
> recorrer la recuperación de contraseña sin cuenta de Resend.
> `docker-compose.prod.yml` no define esa variable; no la agregues en el droplet
> o el artesano nunca recibirá el enlace.

---

## 6. Verificar el despliegue

```sh
curl -fsS https://tu-dominio.mx/api/health          # {"status":"ok","db":"ok"}
curl -fsS -o /dev/null -w '%{http_code}\n' https://tu-dominio.mx/   # 200
curl -sI http://tu-dominio.mx | head -1             # 308: redirige a HTTPS
```

Comprueba también que la base de datos **no** es alcanzable desde fuera. Desde
tu máquina local, no desde el droplet:

```sh
nc -zv TU_IP_DEL_DROPLET 5432    # debe fallar: connection refused / timeout
```

---

## 7. Operación cotidiana

### Actualizar a la última versión

```sh
git pull
docker compose -f docker-compose.prod.yml up -d --build
# si la actualización trae migraciones nuevas:
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
```

### Logs

```sh
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f caddy
```

### Consola de PostgreSQL

```sh
docker compose -f docker-compose.prod.yml exec db \
  psql -U "$(grep ^POSTGRES_USER .env | cut -d= -f2)" \
       -d "$(grep ^POSTGRES_DB .env | cut -d= -f2)"
```

### Respaldo y restauración

```sh
# Respaldo de la base de datos
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U artani -d artani | gzip > respaldo-$(date +%F).sql.gz

# Respaldo de los archivos subidos (fotografías, certificados PDF y QR)
docker run --rm -v artani-prod_uploads:/datos -v "$PWD":/respaldo alpine \
  tar czf /respaldo/uploads-$(date +%F).tar.gz -C /datos .

# Restauración de la base de datos
gunzip -c respaldo-2026-07-27.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U artani -d artani
```

### Detener

```sh
docker compose -f docker-compose.prod.yml down          # conserva los volúmenes
docker compose -f docker-compose.prod.yml down -v       # BORRA datos y archivos
```

---

## 8. Datos persistentes

| Volumen | Contenido | Consecuencia de perderlo |
|---|---|---|
| `pgdata` | Base de datos completa | Pérdida total de la información |
| `uploads` | Fotografías, certificados PDF y códigos QR | Los certificados emitidos dejan de descargarse |
| `caddy_data` | Certificados TLS y cuenta ACME | Se reemiten; con reintentos frecuentes se alcanza el límite de Let's Encrypt |
| `frontend_dist` | Build del cliente | Se regenera al reconstruir |

`pgdata` y `uploads` son los que deben respaldarse.

---

## 9. Problemas frecuentes

**Caddy no obtiene el certificado.** Confirma que el DNS ya propagó
(`dig +short tu-dominio.mx`) y que los puertos 80 y 443 están abiertos. Let's
Encrypt necesita alcanzar el droplet por el 80. Mientras pruebas, usa el
entorno de staging para no agotar el límite de emisiones añadiendo
`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` dentro del
bloque global del `Caddyfile`.

**El backend no arranca y el log dice `Falta la variable de entorno JWT_SECRET`.**
`JWT_SECRET` quedó vacío en `.env`. El compose exige que las variables existan,
pero no puede saber si una cadena vacía es válida.

**Error `required variable X is missing a value` al hacer `up`.** Falta una
variable obligatoria en `.env`. El mensaje indica cuál; es una salvaguarda
deliberada para que ningún secreto tome un valor por omisión.

**El artesano no recibe el correo de recuperación.** Revisa los logs de la API
(`docker compose -f docker-compose.prod.yml logs backend`): un fallo de envío se
registra como `[recuperacion] no se pudo enviar el correo`. Las causas
habituales son una `RESEND_API_KEY` inválida o el dominio del remitente sin
verificar en Resend. La respuesta al usuario es siempre la misma, exista o no la
cuenta, para no revelar qué correos están registrados; por eso el diagnóstico
solo aparece en los logs.

**El QR del certificado apunta a `localhost`.** `PUBLIC_BASE_URL` se deriva de
`DOMINIO`. Si emitiste certificados antes de configurar el dominio, esos QR
quedaron con la URL vieja: hay que reemitirlos.

**Cambié `JWT_SECRET` y nadie puede entrar.** Es lo esperado: invalida todas las
sesiones. Los usuarios deben iniciar sesión otra vez.

---

## Nota sobre `docker-compose.yml`

El `docker-compose.yml` de la raíz es el de **desarrollo local**: levanta solo
PostgreSQL y publica el puerto 5432 en `127.0.0.1`. No lo uses en el droplet.
Para producción, indica siempre `-f docker-compose.prod.yml`.
