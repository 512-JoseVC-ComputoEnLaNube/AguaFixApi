import { generateReportTemplate } from './report.template';
import { Severity } from '../entities/report.entity';

describe('Plantilla de reportes', () => {
  it('escapa todos los valores dinámicos y conserva el HTML de la tarjeta', () => {
    const html = generateReportTemplate({
      address: '<script>alert("x")</script>',
      description: "A & B's fuga",
      severity: Severity.HIGH,
      reporterPhone: '4771234567',
    });
    expect(html).toContain('Nuevo reporte de fuga de agua');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('A &amp; B&#39;s fuga');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<table');
  });
});
