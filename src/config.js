// Zonas en el mismo orden que scripts/build_zones.py (un byte por triángulo).
export const ZONES = [
  { id: 'cuerpo', label: 'Cuerpo' },
  { id: 'forro', label: 'Forro y lengüeta' },
  { id: 'cordones', label: 'Cordones' },
  { id: 'detalles', label: 'Logo y ojales' },
  { id: 'mediasuela', label: 'Mediasuela' },
  { id: 'suela', label: 'Suela' },
];

export const SWATCHES = [
  { name: 'Blanco', hex: '#f4f4f2' },
  { name: 'Hueso', hex: '#e8dfcf' },
  { name: 'Gris niebla', hex: '#9da3ab' },
  { name: 'Grafito', hex: '#4a4d52' },
  { name: 'Negro', hex: '#161618' },
  { name: 'Rojo', hex: '#d0262f' },
  { name: 'Naranja', hex: '#f36a21' },
  { name: 'Volt', hex: '#d6f23a' },
  { name: 'Menta', hex: '#7fe0c0' },
  { name: 'Azul real', hex: '#2450c8' },
  { name: 'Marino', hex: '#1c2742' },
  { name: 'Lila', hex: '#b39ae8' },
];

// roughness y metallic del material PBR de cada acabado.
export const FINISHES = [
  { id: 'mate', label: 'Mate', roughness: 0.92, metallic: 0 },
  { id: 'satinado', label: 'Satinado', roughness: 0.55, metallic: 0 },
  { id: 'brillante', label: 'Brillante', roughness: 0.22, metallic: 0 },
  { id: 'metalico', label: 'Metálico', roughness: 0.32, metallic: 1 },
];

const z = (color, finish = 'satinado') => ({ color, finish });

export const PRESETS = [
  {
    name: 'Original',
    zones: {
      cuerpo: z('#5f646b', 'mate'), forro: z('#1e1f22', 'mate'), cordones: z('#2a2b2e'),
      detalles: z('#3a3c40'), mediasuela: z('#f1f1ef'), suela: z('#c8643c', 'mate'),
    },
  },
  {
    name: 'Volt',
    zones: {
      cuerpo: z('#d6f23a', 'mate'), forro: z('#161618', 'mate'), cordones: z('#161618'),
      detalles: z('#161618', 'brillante'), mediasuela: z('#f4f4f2'), suela: z('#161618', 'mate'),
    },
  },
  {
    name: 'Triple negro',
    zones: {
      cuerpo: z('#18181a', 'mate'), forro: z('#101011', 'mate'), cordones: z('#18181a'),
      detalles: z('#2a2a2d', 'brillante'), mediasuela: z('#1c1c1e', 'satinado'), suela: z('#121213', 'mate'),
    },
  },
  {
    name: 'Arena',
    zones: {
      cuerpo: z('#e8dfcf', 'mate'), forro: z('#b9a58a', 'mate'), cordones: z('#f4f4f2'),
      detalles: z('#8b7355'), mediasuela: z('#f6f1e7'), suela: z('#a57b52', 'mate'),
    },
  },
  {
    name: 'Universidad',
    zones: {
      cuerpo: z('#f4f4f2', 'mate'), forro: z('#d0262f', 'mate'), cordones: z('#f4f4f2'),
      detalles: z('#d0262f', 'brillante'), mediasuela: z('#f4f4f2'), suela: z('#d0262f', 'mate'),
    },
  },
  {
    name: 'Cromo',
    zones: {
      cuerpo: z('#1c2742', 'mate'), forro: z('#1c2742', 'mate'), cordones: z('#c9ccd2', 'metalico'),
      detalles: z('#d9dce2', 'metalico'), mediasuela: z('#f4f4f2'), suela: z('#c9ccd2', 'metalico'),
    },
  },
];
