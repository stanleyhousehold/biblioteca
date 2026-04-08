# Biblioteca 📚

Aplicación web familiar para gestionar el inventario del hogar y la biblioteca de libros.

## Características

- **Inventario**: Organiza objetos por habitaciones con fotos y descripciones
- **Biblioteca**: Gestiona tus libros con búsqueda por ISBN (escáner USB compatible)
- **Multi-usuario**: Registro e inicio de sesión con JWT
- **Responsive**: Funciona en móvil y escritorio

## Tecnologías

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Base de datos**: SQLite (better-sqlite3)
- **Auth**: JWT + bcrypt

## Instalación y ejecución local

### Requisitos previos

- Node.js 18 o superior
- npm 9 o superior

### Pasos

1. **Clona el repositorio:**
   ```bash
   git clone <url-del-repositorio>
   cd biblioteca
   ```

2. **Instala todas las dependencias:**
   ```bash
   npm run install:all
   ```

3. **Crea el archivo de variables de entorno del servidor:**
   ```bash
   cp server/.env.example server/.env
   ```
   Edita `server/.env` y establece un `JWT_SECRET` seguro.

4. **Inicia la aplicación en modo desarrollo:**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Despliegue en Railway

### Variables de entorno necesarias

En Railway, configura estas variables en tu proyecto:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Una cadena aleatoria larga y segura |
| `PORT` | Railway lo asigna automáticamente |

### Pasos para desplegar

1. Crea una cuenta en [Railway](https://railway.app)
2. Crea un nuevo proyecto desde tu repositorio de GitHub
3. Railway detectará automáticamente el `package.json` raíz
4. Configura las variables de entorno indicadas arriba
5. Railway ejecutará `npm run build` (construye el frontend) y luego `npm start` (sirve todo desde el servidor Express)

### Cómo funciona en producción

En producción, el servidor Express sirve tanto la API como el frontend estático compilado. No necesitas dos servicios separados.

## Estructura del proyecto

```
biblioteca/
├── client/               # Frontend React + Vite
│   ├── src/
│   │   ├── components/   # Componentes reutilizables
│   │   ├── pages/        # Páginas principales
│   │   ├── context/      # Estado global (Auth)
│   │   └── api/          # Cliente HTTP
│   └── package.json
├── server/               # Backend Express
│   ├── src/
│   │   ├── routes/       # Rutas de la API
│   │   ├── middleware/   # Auth middleware
│   │   └── db/           # Base de datos SQLite
│   └── package.json
├── package.json          # Scripts raíz con concurrently
└── README.md
```

## Uso del escáner de ISBN

El módulo de biblioteca es compatible con escáneres de código de barras USB que funcionan como teclado (HID). Al estar en el formulario de añadir libro:

1. Haz clic en el campo ISBN
2. Escanea el código de barras del libro
3. La app detecta automáticamente cuando se introduce un ISBN completo (10 o 13 dígitos) seguido de Enter
4. Busca los datos en Open Library y rellena el formulario automáticamente
