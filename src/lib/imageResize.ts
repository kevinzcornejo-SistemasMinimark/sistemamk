// Convierte un File de imagen en data URL WebP cuadrado (icono pequeño)
// Por defecto 128x128 → ~3-8 KB. Perfecto para guardar en una columna text
// sin saturar la base de datos.
export async function fileToThumbDataUrl(
  file: File,
  size = 128,
  quality = 0.78,
): Promise<string> {
  const extensionOk = /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
  if (file.type && !file.type.startsWith("image/") && !extensionOk) {
    throw new Error("El archivo no es una imagen");
  }
  const bitmap = await loadImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  // cover: recorta al cuadrado centrado
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const dx = (size - w) / 2;
  const dy = (size - h) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, dx, dy, w, h);
  bitmap.close?.();

  // Intenta WebP; si el navegador no lo soporta, usa JPEG
  let url = canvas.toDataURL("image/webp", quality);
  if (!url.startsWith("data:image/webp")) {
    url = canvas.toDataURL("image/jpeg", quality);
  }
  return url;
}

async function loadImageBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Algunos navegadores fallan con PNG/GIF específicos; usamos <img> como respaldo.
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}