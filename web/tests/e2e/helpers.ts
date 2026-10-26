import sharp from "sharp";

let counter = 0;

/** Image PNG unique (couleur différente à chaque appel, donc pas de doublon). */
export async function pngFile(name: string, width = 900, height = 1200) {
  counter += 1;
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: (counter * 71) % 256, g: (counter * 29 + 40) % 256, b: (counter * 113) % 256 },
    },
  })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
}
