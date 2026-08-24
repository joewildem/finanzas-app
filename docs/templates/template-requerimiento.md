---
modulo: ""
status: borrador
---

# Requerimientos — {{modulo}}

<!--
Antes de empezar a llenar este documento:
1. Abre docs/prd/data-model-registry.md y revisa el "Índice de numeración" — continúa desde ahí
   (RN-XXX, VALIDATION_XXX, AUTH_XXX, BIZ_XXX, SYS_XXX, CU-XXX). No reinicies en 001.
2. Al terminar el módulo, actualiza el registro con las colecciones/campos nuevos y su procedencia.
-->

## Resumen del módulo

<!-- 2-5 oraciones, lenguaje de negocio: qué cubre este módulo y por qué existe. -->

## Casos de uso

### CU-XXX — [nombre del caso de uso]

**Actor:** Usuario autenticado (dueño de los datos) <!-- ajustar solo si el CU tiene otro actor -->

**Descripción del caso de uso**

<!-- Párrafo de negocio, no técnico: "Esta funcionalidad permitirá a... Para ello será necesario...
El sistema..." -->

**Flujo principal**

1.
2.

**Flujos alternativos / casos borde**

-

**Precondiciones**

-

**Postcondiciones**

-

**Definición detallada de campos**

| Campo | Tipo de control | Obligatorio | Longitud | Formato / validación | Dependencias | Valor por defecto | Regla de negocio |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

**Reglas de negocio**

- RN-XXX:

**Casos de uso derivados identificados**

<!-- ¿Este CU crea una configuración con impacto operativo? → evaluar patrón CRUD+Activar.
¿Este CU muestra una lista/tabla? → evaluar CU independiente de Búsqueda y Filtrado.
No crear el derivado como documento aparte si su contenido sería genérico/vacío — resolverlo
dentro de este mismo CU en ese caso. -->

-

**Validaciones**

| Campo | Tipo | Reglas | Mitigación OWASP |
|---|---|---|---|
| | | | |

**Mensajes de error**

*Validación*
- `VALIDATION_XXX`: ""

*Autenticación / autorización*
- `AUTH_XXX`: ""

*Lógica de negocio*
- `BIZ_XXX`: ""

*Sistema*
- `SYS_XXX`: "Ocurrió un error inesperado. Intenta de nuevo más tarde."

**Requerimientos técnicos backend**

*Definición del servicio*

| Método | Endpoint | Auth |
|---|---|---|
| | | |

*Request*
```json
{}
```

*Response (éxito)*
```json
{}
```

*Modelo de información*
```json
// Colección: 
{}
```
> Registrar en [[data-model-registry]] al cerrar el módulo.

*Decisiones de modelado*

| Relación | Patrón | Justificación |
|---|---|---|

*Índices*

| Colección | Campos | Tipo | Propósito |
|---|---|---|---|

**Matriz de pruebas**

<!-- Categorías obligatorias: Flujo exitoso, Validación de entrada, Autenticación/Autorización,
Lógica de negocio, Recurso no encontrado, Error del sistema. 5-10 escenarios para un módulo de
este tamaño — agrupar campos con la misma lógica de validación en un solo escenario. -->

| # | Categoría | Escenario | Input | Resultado esperado | HTTP |
|---|---|---|---|---|---|

**Referencia de diseño**

- Pantalla / flujo: [[wireframe-xxx]] · [[user-flow-xxx]]

---

<!-- Repetir la ficha ### CU-XXX por cada caso de uso del módulo -->

## Historial de cambios

| Fecha | Cambio | CU afectado | Impacto en otros documentos |
|---|---|---|---|
| | | | |

## Referencias

- [[estrategia]]
- [[brief-ux]]
- [[data-model-registry]]
