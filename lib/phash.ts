import sharp from "sharp";

function dct(input: number[], index: number, sourceSize: number, frequencySize: number) {
  let sum = 0;
  const u = Math.floor(index / frequencySize);
  const v = index % frequencySize;
  const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
  const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      sum +=
        input[y * sourceSize + x] *
        Math.cos(((2 * x + 1) * u * Math.PI) / (2 * sourceSize)) *
        Math.cos(((2 * y + 1) * v * Math.PI) / (2 * sourceSize));
    }
  }
  return sum * cu * cv;
}

export async function perceptualHash(imageUrl: string) {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Bild konnte nicht geladen werden: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const size = 8;
  const pixels = await sharp(bytes)
    .greyscale()
    .resize(size * 4, size * 4, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const grey = Array.from(pixels.data).filter((_, index) => index % pixels.info.channels === 0);
  const coefficients = Array.from({ length: size * size }, (_, index) =>
    dct(grey, index, size * 4, size)
  );
  const sorted = coefficients.slice(1).slice().sort((a, b) => a - b);
  const median = (sorted[31] + sorted[32]) / 2;
  return coefficients.reduce(
    (hash, value, index) => hash | (value > median ? 1n << BigInt(index) : 0n),
    0n
  );
}

export function hammingDistance(left: bigint, right: bigint) {
  let value = left ^ right;
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}
