# Control de Stock e Inventario (Android APK & PWA)

Aplicación nativa para Android y Web para la gestión de inventario en pequeños comercios, con soporte offline, escaneo por cámara de código de barras (unidades y bultos), reposición y multi-usuario.

---

## 📁 Estructura del Proyecto para GitHub

```text
├── .github/
│   └── workflows/
│       └── build-apk.yml           # CI/CD: Compila el archivo .APK automáticamente en GitHub Actions
├── android/                        # Proyecto Nativo de Android (Gradle / Android Studio)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml # Permisos de Cámara, vibración e Internet
│   │   │   ├── assets/public/      # Bundle web compilado dentro de la app Android
│   │   │   └── java/               # MainActivity nativa de Android
│   │   └── build.gradle            # Configuración de dependencias de Android
│   ├── build.gradle
│   ├── gradlew / gradlew.bat       # Wrapper de Gradle para compilar sin Android Studio
│   └── settings.gradle
├── capacitor.config.json           # Configuración de Capacitor para empaquetado Android
├── public/                         # Recursos estáticos (iconos, sonidos, manifest PWA)
├── src/                            # Código fuente React + TypeScript
│   ├── components/                 # Vistas y componentes (Inventario, Reposición, Usuarios, etc.)
│   ├── services/                   # Almacenamiento local, auth, sincronización P2P
│   ├── types.ts                    # Interfaces de datos y tipos TypeScript
│   ├── App.tsx                     # Contenedor principal de la aplicación móvil
│   ├── main.tsx                    # Punto de entrada de la aplicación
│   └── index.css                   # Estilos Tailwind CSS
├── index.html                      # Entry point HTML optimizado para vista móvil
├── package.json                    # Dependencias y scripts de construcción
├── tsconfig.json                   # Configuración de TypeScript
└── vite.config.ts                  # Configuración de Vite
```

---

## 🚀 Pasos para Exportar a GitHub desde Google AI Studio

1. En la barra superior derecha de **Google AI Studio**, haz clic en el menú desplegable de opciones o en el icono de ajustes/exportar.
2. Selecciona **"Export to GitHub"** (o descargar como **ZIP**).
3. Si seleccionas GitHub:
   - Conecta tu cuenta de GitHub si aún no lo has hecho.
   - Elige el nombre de tu nuevo repositorio (ejemplo: `control-stock-android`).
   - Haz clic en **Create Repository** / **Export**.

---

## 📦 Cómo Generar el archivo `.APK`

Tienes dos formas de obtener tu APK para instalar en tu celular Android:

### Opción 1: Automática con GitHub Actions (Recomendada)
Al subir este repositorio a tu GitHub:
1. Dirígete a la pestaña **Actions** en tu repositorio de GitHub.
2. Verás ejecutándose el flujo **"Construir APK de Android"**.
3. Una vez finalizado en verde, entra en la ejecución y en la sección **Artifacts** descarga el archivo:
   👉 **`ControlStock-Android-Debug-APK.zip`**
4. Descomprímelo y transfiere el archivo `app-debug.apk` a tu celular para instalarlo.

### Opción 2: Con Android Studio en tu Computadora
1. Clona el repositorio en tu PC:
   ```bash
   git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   cd TU_REPOSITORIO
   ```
2. Instala dependencias y compila:
   ```bash
   npm install
   npm run build:android
   ```
3. Abre el proyecto en Android Studio:
   ```bash
   npm run open:android
   ```
4. En Android Studio:
   - Menú **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - ¡Listo! Encontrarás el archivo generado en `android/app/build/outputs/apk/debug/app-debug.apk`.
