// Tiny, original PDF fixtures exercise real PDF.js parsing without checked-in books.
export function makePdf({ scanned = false } = {}) {
  const pages = scanned ? [''] : [
    'THE BLACKTHORN GATE',
    'An introduction before printed page one.',
    'You arrive at the gate. Turn to page 3.',
    'A hidden passage. Go to page 1.',
    'You found the ending. THE END.',
  ];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const imageStart = 4 + pages.length * 2;
  const colors = ['447744', '996633', 'dd2222', '22aa44', '2244dd'];
  for (const [index, text] of pages.entries()) {
    const stream = `0.15 0.25 0.2 rg 0 0 400 600 re f\n0.9 0.85 0.7 rg 25 25 350 550 re f\nq 160 0 0 120 120 260 cm /Illustration Do Q\nBT /F1 14 Tf 0.1 0.1 0.1 rg 40 500 Td (${text}) Tj ET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << /Font << /F1 3 0 R >> /XObject << /Illustration ${imageStart + index} 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
  }
  for (const index of pages.keys()) {
    const stream = `${colors[index].repeat(4)}>`;
    objects.push(`<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
