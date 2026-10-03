Language Option / 语言选项 / Opción de idioma：

[English](../../../README.md) | [简体中文](../zh-CN/README.md) | **Español**

---

# pathprobe

`pathprobe` extrae referencias con forma de ruta desde un texto y devuelve aquellas que corresponden a archivos o directorios existentes.

Puede resolver rutas relativas mediante uno o varios directorios de búsqueda, admite distintas sintaxis de ruta y conserva la posición de cada coincidencia dentro del texto original.

## Uso

```ts
import { findExistingPaths, MAX_LEVEL } from "pathprobe";

const matches = await findExistingPaths({
  text: "Abre src/index.ts y ./package.json.",
  directories: [process.cwd()],
  level: 2,
});

console.log(matches);
```

`findExistingPaths()` devuelve un `Promise<PathMatch[]>`.

## Opciones

```ts
findExistingPaths({
  text,
  directories,
  level,
  variables,
  respectIgnore,
  searchHidden,
});
```

`text` contiene el texto que se analizará.

`directories` es una lista no vacía de directorios utilizada para resolver rutas relativas.

`level` es un número entero comprendido entre `1` y `MAX_LEVEL`.

`variables` es un objeto opcional de valores de texto utilizado para expandir referencias a variables.

`respectIgnore` controla si se aplican los archivos y reglas de exclusión.

`searchHidden` controla si los archivos y directorios ocultos forman parte de la búsqueda.

## Niveles de búsqueda

El nivel `1` reconoce rutas explícitas y texto entre comillas que pueda resolverse como una ruta existente.

El nivel `2` reconoce además fragmentos con forma de ruta y rutas que contienen referencias a variables compatibles.

Los niveles `3` y superiores también examinan fragmentos de texto formados por varias palabras. Los niveles superiores permiten fragmentos progresivamente más largos.

`MAX_LEVEL` activa el alcance máximo de búsqueda de texto y la coincidencia con el inventario del sistema de archivos.

El nivel máximo disponible se exporta directamente:

```ts
import { MAX_LEVEL } from "pathprobe";
```

## Rutas relativas y absolutas

Las rutas relativas se resuelven con respecto a cada directorio indicado en `directories`.

```ts
const matches = await findExistingPaths({
  text: "src/index.ts",
  directories: ["/workspace/project-a", "/workspace/project-b"],
  level: 2,
});
```

Las rutas absolutas se resuelven directamente.

La entrada puede contener rutas normales de la plataforma, URL `file://`, rutas relativas al directorio personal como `~/file.txt` y rutas basadas en variables compatibles.

## Variables

Las referencias a variables pueden utilizar valores proporcionados mediante `variables` o variables de entorno disponibles para el proceso.

```ts
const matches = await findExistingPaths({
  text: "$PROJECT_ROOT/src/index.ts",
  directories: [process.cwd()],
  level: 2,
  variables: {
    PROJECT_ROOT: "/workspace/example",
  },
});
```

Las formas compatibles incluyen `$NAME`, `${NAME}`, `%NAME%`, `!NAME!`, `$env:NAME`, `{{NAME}}`, `${{ NAME }}`, `$(NAME)` y `@NAME@`.

Las rutas relativas al directorio personal utilizan `HOME` o `USERPROFILE` cuando están disponibles.

## Línea y columna

Una referencia de ruta puede incluir un sufijo que indique una posición dentro del archivo.

Por ejemplo:

```text
src/index.ts:12
src/index.ts:12:4
src/index.ts#L12
```

Cuando existe este sufijo, la ubicación se devuelve por separado de la ruta del sistema de archivos.

## Formato del resultado

Cada resultado tiene la siguiente estructura:

```ts
interface PathMatch {
  kind: "file" | "directory";
  path: string;
  position: {
    start: number;
    end: number;
  };
  location?: {
    line: number;
    column?: number;
  };
}
```

`path` contiene la ruta existente después de su resolución.

`kind` indica si la ruta corresponde a un archivo o a un directorio.

`position` contiene los desplazamientos inicial y final de la referencia en el texto original.

`location` contiene opcionalmente la línea y la columna extraídas de la referencia.

## Elementos ocultos y reglas de exclusión

El valor predeterminado de `searchHidden` procede de la configuración del paquete y determina si se incluyen rutas ocultas.

En sistemas de tipo Unix, los segmentos cuyo nombre comienza por un punto se consideran ocultos.

En Windows también se tiene en cuenta el atributo Hidden del sistema de archivos.

`respectIgnore` determina si las reglas de exclusión configuradas, incluidas las reglas de Git ignore, afectan a las coincidencias dentro de los directorios de búsqueda.

Ambos valores pueden establecerse explícitamente:

```ts
const matches = await findExistingPaths({
  text,
  directories: [process.cwd()],
  level: MAX_LEVEL,
  respectIgnore: true,
  searchHidden: false,
});
```

## Rutas de Windows

Las rutas con letra de unidad de Windows y las referencias UNC pueden utilizarse como candidatos.

Las rutas de red asignadas y los recursos administrativos locales pueden representarse mediante su ruta de unidad correspondiente cuando pueden resolverse localmente.

En Windows, la comparación de rutas sigue una semántica que no distingue entre mayúsculas y minúsculas.

## Exportaciones

El paquete exporta:

```ts
findExistingPaths
MAX_LEVEL

FindExistingPathsOptions
PathKind
PathLocation
PathMatch
PathPosition
SearchLevel
Variables
```

Los tipos de opción no válidos, los niveles fuera del intervalo permitido y los directorios de búsqueda no válidos producen un error.