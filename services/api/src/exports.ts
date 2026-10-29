import { unzipSync, strFromU8 } from "fflate";
export function decodeExport(bytes: Uint8Array): unknown {
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    try {
      return JSON.parse(Buffer.from(bytes).toString());
    } catch {
      throw Object.assign(Error("Invalid OCR JSON or ZIP."), {
        statusCode: 400,
      });
    }
  }
  let expanded = 0;
  const archive = unzipSync(bytes, {
    filter: (file) => {
      expanded += file.originalSize;
      if (expanded > 80 * 1024 * 1024 || file.originalSize > 30 * 1024 * 1024)
        throw Object.assign(Error("Expanded ZIP exceeds the debug limit."), {
          statusCode: 413,
        });
      return (
        !file.name.startsWith("/") &&
        !file.name.replace(/\\/g, "/").split("/").includes("..")
      );
    },
  });
  const paths = Object.keys(archive)
    .filter((path) => /(?:^|\/)pages\/page-\d+\/markdown\.md$/.test(path))
    .sort(
      (a, b) =>
        Number(a.match(/page-(\d+)/)![1]) - Number(b.match(/page-(\d+)/)![1]),
    );
  if (!paths.length)
    throw Object.assign(
      Error("ZIP needs pages/page-N/markdown.md and its images."),
      { statusCode: 400 },
    );
  return {
    pages: paths.map((path) => {
      const prefix = path.slice(0, path.lastIndexOf("/") + 1),
        metadata = archive[prefix + "page-metadata.json"];
      return {
        ...(metadata ? JSON.parse(strFromU8(metadata)) : {}),
        index: Number(path.match(/page-(\d+)/)![1]) - 1,
        markdown: strFromU8(archive[path]),
        images: Object.keys(archive)
          .filter(
            (key) => key.startsWith(prefix) && /\.(png|jpe?g)$/i.test(key),
          )
          .map((key) => ({
            id: key.slice(prefix.length),
            imageBase64: `data:image/${/png$/i.test(key) ? "png" : "jpeg"};base64,${Buffer.from(archive[key]).toString("base64")}`,
          })),
      };
    }),
  };
}
