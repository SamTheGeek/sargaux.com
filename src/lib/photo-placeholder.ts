/**
 * A flat tile of a photo's exact aspect ratio. Served by the /api/photos
 * endpoints only when the site is built with PHOTOS_TEST_FIXTURE, so tests
 * never touch iCloud.
 */
export function placeholderSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#8a9a7b"/></svg>`;
}
