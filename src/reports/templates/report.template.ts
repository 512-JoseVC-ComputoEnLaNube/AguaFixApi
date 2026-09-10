import { CreateReportDto } from '../dto/create-report.dto';

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function generateReportTemplate(dto: CreateReportDto): string {
  const rows = [
    ['Dirección', dto.address],
    ['Descripción', dto.description],
    ['Severidad', dto.severity],
    ['Teléfono de contacto', dto.reporterPhone],
  ]
    .map(
      ([label, value]) =>
        `<tr><th scope="row" style="padding:12px;text-align:left;border-bottom:1px solid #dbeafe;vertical-align:top">${label}</th><td style="padding:12px;border-bottom:1px solid #dbeafe;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="UTF-8"><title>Nuevo reporte de fuga de agua</title></head>
<body style="margin:0;padding:24px;background:#eff6ff;color:#172554;font-family:Arial,sans-serif">
<div style="max-width:640px;margin:auto;padding:24px;background:#ffffff;border:1px solid #bfdbfe;border-radius:12px">
<h1 style="font-size:24px;color:#075985;margin-top:0">Nuevo reporte de fuga de agua</h1>
<p style="line-height:1.5">Se recibió un reporte ciudadano para atención de la cuadrilla de mantenimiento.</p>
<table style="width:100%;border-collapse:collapse">${rows}</table>
<p style="font-size:12px;color:#475569;margin-bottom:0">AguaFixApi · Reportes ciudadanos</p>
</div></body></html>`;
}
