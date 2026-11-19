# Configurador 3D de zapatillas

Configurador de producto en tiempo real: eliges el color y el acabado (mate, satinado, brillante o metálico) de cada pieza de la zapatilla y lo ves al instante en 3D. Con **Foto HD** se genera una imagen con path tracing desde el ángulo actual, lista para descargar.

Hecho con [Crucible](https://github.com/codepawl/crucible) (`@codepawlhq/crucible`), un motor 3D WebGL2 para la web, y Vite.

## Qué hace

- Seis piezas editables: cuerpo, forro y lengüeta, cordones, logo y ojales, mediasuela y suela.
- Toca o haz clic sobre la zapatilla para elegir la pieza; al pasar el mouse se ilumina.
- Paleta de colores, selector de color libre y seis combinaciones listas.
- La combinación queda en la URL, así se puede compartir el enlace.
- Rotación con arrastre e inercia, zoom con rueda o pellizco, y giro automático en reposo.
- Foto HD con el path tracer de Crucible (en la GPU, con la CPU como respaldo).

## Cómo funciona

El modelo original es una sola malla con una sola textura, así que no tenía piezas separadas. `scripts/build_zones.py` agrupa los triángulos por isla UV y asigna cada isla a una zona según su lugar en el atlas de texturas y su color. Guarda el resultado en `zones.bin` (un byte por triángulo) y genera una textura neutra en gris con el brillo de cada zona igualado, para que el color elegido se vea limpio sin perder el tejido ni las costuras.

En el navegador, `src/viewer.js` carga `configurador.gltf`, divide la malla en una pieza de Crucible por zona y cambia color, rugosidad y metalizado en vivo con `renderer.updateParts()`.

## Desarrollo

```bash
npm install
npm run dev
```

- `/` es el configurador.
- `/visor.html` es el visor original con three.js (Pegasus, Jordan y hoodie).

Para regenerar las zonas y las texturas (requiere Python con numpy y Pillow):

```bash
python3 scripts/build_zones.py
```

## Créditos

- “Nike Air Zoom Pegasus 36” de [quaz30](https://sketchfab.com/quaz30), licencia [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/), recoloreado y dividido en zonas.
- Proyecto de demostración de portafolio, sin relación con Nike.
