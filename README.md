# 🧪 Lab Orders & Stock Manager v1.0

Una plataforma moderna y eficiente diseñada para el control total del inventario, gestión de pedidos y análisis financiero de laboratorios.

## 🚀 Características Principales

*   **📦 Control de Stocks Dinámico:** Ajuste rápido de cantidades directamente desde la tabla, gestión de stock mínimo y alertas visuales automáticas.
*   **📊 Análisis Avanzado:** Panel de control con KPIs financieros, evolución mensual del gasto y desglose por proveedor/categoría.
*   **🤝 Gestión de Proveedores:** Directorio sincronizado con el catálogo, permitiendo la creación inteligente de proveedores sobre la marcha.
*   **🏭 Automatización de Identificación:** Generación automática de IDs de referencia únicos (`REF-XXXXX`) sincronizados con las referencias de los proveedores.
*   **📑 Inventario Manual Profesional:** Herramienta de reconciliación rápida con cálculo automático de diferencias visuales.

## 🛠️ Stack Tecnológico

*   **Frontend:** React.js con Vite.
*   **Backend:** Supabase (PostgreSQL + Auth).
*   **Estilos:** Vanilla CSS con un sistema de diseño premium (HSLAB Design System).
*   **Librerías:** Recharts (Gráficos), Lucide React (Iconos).

## ⚙️ Configuración y Despliegue

### Requisitos Previos

*   [Node.js](https://nodejs.org/es) (v18 o superior).
*   Una cuenta en [Supabase](https://supabase.com).

### Pasos Iniciales

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/juananmg77-sketch/lab-orders-app.git
    cd lab-orders-app
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Variables de Entorno:**
    Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url_de_supabase
    VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
    ```

4.  **Lanzar en desarrollo:**
    ```bash
    npm run dev
    ```

5.  **Compilar para Producción:**
    ```bash
    npm run build
    ```

## 🔒 Privacidad y Seguridad

Este sistema está diseñado para manejar datos críticos de laboratorio. Recomendamos encarecidamente **no subir el archivo .env** a repositorios públicos y utilizar las políticas de RLS en Supabase para proteger la información.

---
© 2026 - v1.0.0
