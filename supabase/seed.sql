-- Datos iniciales (generado desde prisma/seed.ts). Idempotente.
INSERT INTO parametros (clave, valor, tipo, descripcion, vigente_desde, vigente_hasta) VALUES
('AFORE_DIAS_HABILES','5','entero','Días hábiles de resolución de la Afore','2026-01-01',NULL),
('ANIOS_CANDADO_RETIRO','5','entero','Años entre retiros por desempleo','2026-01-01',NULL),
('ARCO_DIAS_RESPUESTA','20','entero','Días para responder una solicitud ARCO','2026-01-01',NULL),
('BASE_COMISION_VENDEDOR','igual_honorario','texto','Decisión 14.3: base del 5% del vendedor','2026-01-01',NULL),
('BASE_HONORARIO','neto','texto','Decisión 14.3: el 30% se aplica sobre el depósito neto (neto | bruto)','2026-01-01',NULL),
('BASE_REPARTO_SOCIO','subtotal','texto','Decisión 14.3: reparto del socio sobre subtotal sin IVA (subtotal | total)','2026-01-01',NULL),
('DIAS_ESPERA_DESEMPLEO','46','entero','Fecha elegible = baja + N días naturales (art. 191-II)','2026-01-01',NULL),
('FALLEC_COMISION_INICIAL','3000','decimal','Comisión vendedor fallecimiento: pago inicial','2026-01-01',NULL),
('FALLEC_COMISION_MENSUALIDAD','3000','decimal','Comisión vendedor fallecimiento: primera mensualidad','2026-01-01',NULL),
('FALLEC_COMISION_PCT_RECUPERADO','0.05','decimal','Comisión vendedor fallecimiento: % de lo recuperado','2026-01-01',NULL),
('FOLIO_ANCHO','4','entero','Dígitos del folio','2026-01-01',NULL),
('FOLIO_PREFIJO','RP-','texto','Prefijo del folio (una sola serie por defecto)','2026-01-01',NULL),
('HONORARIO_RETIRO_PCT','0.30','decimal','Honorario del retiro, IVA incluido','2026-01-01',NULL),
('HORA_ALERTAS_CDMX','07:00','texto','Hora de CDMX de la tarea diaria de alertas','2026-01-01',NULL),
('HORA_CORREO_CDMX','07:15','texto','Hora de CDMX del correo de resumen','2026-01-01',NULL),
('IVA','0.16','decimal','Tasa de IVA','2026-01-01',NULL),
('L73_SEMANAS_CRITICAS','550','entero','Debajo de esto, alerta crítica Ley 73','2026-01-01',NULL),
('L73_SEMANAS_MINIMAS','500','entero','Mínimo de semanas Ley 73','2026-01-01',NULL),
('L97_INCREMENTO_ANUAL','25','entero','Incremento anual del mínimo Ley 97','2026-01-01',NULL),
('L97_SEMANAS_2021','750','entero','Mínimo de semanas Ley 97 en 2021','2026-01-01',NULL),
('L97_SEMANAS_TOPE','1000','entero','Mínimo final Ley 97','2026-01-01',NULL),
('LIGA_CONSULTA_CURP','https://www.gob.mx/curp/','texto','Consulta de CURP (RENAPO)','2026-01-01',NULL),
('LIGA_CONSULTA_NSS','https://serviciosdigitales.imss.gob.mx/gestionAsegurados-web-externo/asignacionNSS','texto','Asignación o localización del NSS (IMSS)','2026-01-01',NULL),
('LIGA_CONSULTA_SEMANAS','https://serviciosdigitales.imss.gob.mx/semanascotizadas-web/usuarios/IngresoAsegurado','texto','Constancia de semanas cotizadas (IMSS)','2026-01-01',NULL),
('MODALIDAD_A_ANIOS','3','entero','Antigüedad mínima de cuenta, modalidad A','2026-01-01',NULL),
('MODALIDAD_A_BIMESTRES','12','entero','Bimestres mínimos, modalidad A','2026-01-01',NULL),
('MODALIDAD_A_DIAS_SBC','30','entero','Días de SBC, modalidad A','2026-01-01',NULL),
('MODALIDAD_A_TOPE_UMAS','10','entero','Tope en UMAs mensuales, modalidad A','2026-01-01',NULL),
('MODALIDAD_B_ANIOS','5','entero','Antigüedad mínima de cuenta, modalidad B','2026-01-01',NULL),
('MODALIDAD_B_DIAS_SBC','90','entero','Días de SBC promedio 250 semanas, modalidad B','2026-01-01',NULL),
('MODALIDAD_B_PCT_RCV','0.115','decimal','Porcentaje del saldo RCV, modalidad B','2026-01-01',NULL),
('PRIVACIDAD_VERSION','2026-10','texto','Versión vigente del aviso de privacidad','2026-01-01',NULL),
('RETENCION_EXPEDIENTES_ANIOS','5','entero','Conservación de expedientes de casos cerrados','2026-01-01',NULL),
('SLA_DIAS_HABILES','15','entero','Días hábiles para ingresar desde expediente completo','2026-01-01',NULL),
('UMA_DIARIA','117.31','decimal','UMA diaria','2026-02-01','2027-01-31'),
('UMA_MENSUAL','3566.22','decimal','UMA mensual','2026-02-01','2027-01-31'),
('UMBRAL_DIFERENCIA_MODALIDAD','0.20','decimal','Diferencia de monto bajo la cual se resalta la modalidad que cuesta menos semanas','2026-01-01',NULL),
('VIGENCIA_CONTRATO_DIAS','90','entero','Vigencia del contrato en días naturales','2026-01-01',NULL),
('ZONA_HORARIA','America/Mexico_City','texto','Zona horaria del negocio','2026-01-01',NULL)
ON CONFLICT (clave, vigente_desde) DO NOTHING;
INSERT INTO tipos_servicio (clave, nombre, embudo, forma_cobro, honorario_pct, notas, orden) VALUES
('RETIRO_DESEMPLEO','Retiro parcial por desempleo (art. 191-II LSS)','retiro','30% de lo que paga la Afore, IVA incluido','0.3000','Preferente para Ley 97 o cuando no afecta la pensión. Sin monto mínimo de retiro',1),
('PENSION_L73','Asesoría de pensión Ley 73 (cesantía, vejez, invalidez)','pension','Honorario fijo capturado por caso',NULL,'Línea prioritaria del negocio',2),
('PENSION_L97','Asesoría de pensión Ley 97','pension','Honorario fijo',NULL,NULL,3),
('MODALIDAD_40','Continuación voluntaria (arts. 218-221)','pension','Honorario fijo',NULL,'Requiere seguimiento mensual de pagos',4),
('PTI_M10','Incorporación voluntaria / independiente','pension','Honorario fijo',NULL,'Ventana de 12 meses del art. 85 RACERF',5),
('FALLECIMIENTO','Pensión de viudez/orfandad y recuperación de saldos','pension','Honorario fijo + % de lo recuperado (configurable)',NULL,'Esquema de comisión especial (sección 9)',6),
('DEVOLUCION_INFONAVIT','Devolución de subcuenta de vivienda (DSSV)','pension','Honorario fijo o % (configurable)',NULL,'Trámite gratuito ante Infonavit: se vende la revisión y corrección',7),
('CORRECCION_NSS','Unificación de NSS / corrección de semanas','pension','Honorario fijo',NULL,NULL,8)
ON CONFLICT (clave) DO NOTHING;
INSERT INTO afores (clave, nombre) VALUES
('AZTECA','Afore Azteca'),
('BANAMEX','Afore Banamex'),
('COPPEL','Afore Coppel'),
('INBURSA','Afore Inbursa'),
('INVERCAP','Afore Invercap'),
('PENSIONISSSTE','PENSIONISSSTE'),
('PRINCIPAL','Principal Afore'),
('PROFUTURO','Profuturo Afore'),
('SURA','Afore SURA'),
('XXI_BANORTE','Afore XXI Banorte')
ON CONFLICT (clave) DO NOTHING;
INSERT INTO tipos_documento (nombre, obligatorio, vigencia_dias, requiere_original, instrucciones, orden) VALUES
('Certificación de baja del IMSS','t'::boolean,NULL::int,'t'::boolean,'Foto a color, mínimo 256 KB, sin tachaduras',0),
('Comprobante de registro en Afore','t'::boolean,NULL::int,'f'::boolean,'Foto a color, mínimo 256 KB, sin tachaduras',1),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','t'::boolean,NULL::int,'f'::boolean,'Foto a color, mínimo 256 KB, sin tachaduras',2),
('Comprobante de domicilio','t'::boolean,'90'::int,'f'::boolean,'No mayor a 3 meses. Foto a color, mínimo 256 KB, sin tachaduras',3),
('Estado de cuenta Afore','t'::boolean,NULL::int,'f'::boolean,'Foto a color, mínimo 256 KB, sin tachaduras',4),
('Constancia de semanas cotizadas','t'::boolean,NULL::int,'f'::boolean,'Foto a color, mínimo 256 KB, sin tachaduras',5),
('Estado de cuenta bancario nivel 4','t'::boolean,NULL::int,'f'::boolean,'A nombre del cliente; evita cuentas solo digitales. Foto a color, mínimo 256 KB, sin tachaduras',6),
('Estado de cuenta bancario (DSSV)','t'::boolean,'60'::int,'f'::boolean,'No mayor a 2 meses. Foto a color, mínimo 256 KB, sin tachaduras',7)
ON CONFLICT (nombre) DO NOTHING;
INSERT INTO tipos_documento_servicio (tipo_documento_id, tipo_servicio)
SELECT d.id, x.servicio FROM (VALUES
('Certificación de baja del IMSS','RETIRO_DESEMPLEO'),
('Comprobante de registro en Afore','RETIRO_DESEMPLEO'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','CORRECCION_NSS'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','DEVOLUCION_INFONAVIT'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','FALLECIMIENTO'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','MODALIDAD_40'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','PENSION_L73'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','PENSION_L97'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','PTI_M10'),
('Identificación oficial (INE, cédula, pasaporte o cartilla)','RETIRO_DESEMPLEO'),
('Comprobante de domicilio','CORRECCION_NSS'),
('Comprobante de domicilio','DEVOLUCION_INFONAVIT'),
('Comprobante de domicilio','FALLECIMIENTO'),
('Comprobante de domicilio','MODALIDAD_40'),
('Comprobante de domicilio','PENSION_L73'),
('Comprobante de domicilio','PENSION_L97'),
('Comprobante de domicilio','PTI_M10'),
('Comprobante de domicilio','RETIRO_DESEMPLEO'),
('Estado de cuenta Afore','FALLECIMIENTO'),
('Estado de cuenta Afore','PENSION_L73'),
('Estado de cuenta Afore','PENSION_L97'),
('Estado de cuenta Afore','RETIRO_DESEMPLEO'),
('Constancia de semanas cotizadas','CORRECCION_NSS'),
('Constancia de semanas cotizadas','MODALIDAD_40'),
('Constancia de semanas cotizadas','PENSION_L73'),
('Constancia de semanas cotizadas','PENSION_L97'),
('Constancia de semanas cotizadas','PTI_M10'),
('Constancia de semanas cotizadas','RETIRO_DESEMPLEO'),
('Estado de cuenta bancario nivel 4','RETIRO_DESEMPLEO'),
('Estado de cuenta bancario (DSSV)','DEVOLUCION_INFONAVIT')
) AS x (documento, servicio) JOIN tipos_documento d ON d.nombre = x.documento
ON CONFLICT DO NOTHING;
INSERT INTO dias_inhabiles (fecha, descripcion, origen) VALUES
('2026-01-01','Año Nuevo','oficial'),
('2026-02-02','Día de la Constitución','oficial'),
('2026-03-16','Natalicio de Benito Juárez','oficial'),
('2026-04-02','Jueves Santo','bancario'),
('2026-04-03','Viernes Santo','bancario'),
('2026-05-01','Día del Trabajo','oficial'),
('2026-09-16','Día de la Independencia','oficial'),
('2026-11-02','Día de Muertos','bancario'),
('2026-11-16','Día de la Revolución','oficial'),
('2026-12-25','Navidad','oficial'),
('2027-01-01','Año Nuevo','oficial'),
('2027-02-01','Día de la Constitución','oficial'),
('2027-03-15','Natalicio de Benito Juárez','oficial'),
('2027-03-25','Jueves Santo','bancario'),
('2027-03-26','Viernes Santo','bancario'),
('2027-09-16','Día de la Independencia','oficial'),
('2027-11-02','Día de Muertos','bancario'),
('2027-11-15','Día de la Revolución','oficial')
ON CONFLICT (fecha) DO NOTHING;
INSERT INTO esquemas_comision (nombre, tipo, tipo_servicio, version, reglas, vigente_desde)
SELECT * FROM (VALUES
('Referidor','referido'::"TipoComision",NULL,1,'{"tipo": "escalonado_mensual", "cuenta": "honorario_cobrado", "escalones": [{"desde": 1, "hasta": 2, "monto": 1000}, {"desde": 3, "hasta": 10, "monto": 2000}, {"desde": 11, "hasta": null, "monto": 3000}]}'::jsonb,'2026-01-01'::date),
('Socio licenciatario','socio'::"TipoComision",'RETIRO_DESEMPLEO',1,'{"tipo": "reparto", "pct_socio": 0.4, "base_param": "BASE_REPARTO_SOCIO", "costo_admin": 500}'::jsonb,'2026-01-01'::date),
('Vendedor estándar','vendedor'::"TipoComision",'FALLECIMIENTO',1,'{"tipo": "compuesto", "componentes": [{"clave": "pago_inicial", "fijo_param": "FALLEC_COMISION_INICIAL"}, {"clave": "recuperado", "pct_param": "FALLEC_COMISION_PCT_RECUPERADO"}, {"clave": "primera_mensualidad", "fijo_param": "FALLEC_COMISION_MENSUALIDAD"}]}'::jsonb,'2026-01-01'::date),
('Vendedor estándar','vendedor'::"TipoComision",'RETIRO_DESEMPLEO',1,'{"pct": 0.05, "base": "monto_afore", "tipo": "porcentaje", "devenga": "pago_afore_y_cobro"}'::jsonb,'2026-01-01'::date)
) AS x (nombre, tipo, tipo_servicio, version, reglas, vigente_desde)
WHERE NOT EXISTS (SELECT 1 FROM esquemas_comision e WHERE e.nombre = x.nombre AND e.tipo_servicio IS NOT DISTINCT FROM x.tipo_servicio AND e.version = x.version);
INSERT INTO plantillas_mensaje (clave, nombre, cuerpo) VALUES
('AFORE_APROBO','La Afore aprobó','Hola {nombre}, ¡buenas noticias! La Afore aprobó tu retiro. Te avisamos en cuanto veas el depósito. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('BIENVENIDA','Bienvenida y aviso de privacidad','Hola {nombre}, gracias por contactarnos. Antes de revisar tu caso, lee nuestro aviso de privacidad: {liga_privacidad}. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('DOCS_PENDIENTES','Documentos pendientes','Hola {nombre}, para avanzar con tu trámite {folio} nos falta: {documentos}. Puedes mandarnos foto clara por aquí. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('FALTAN_DIAS','Faltan N días para tu fecha','Hola {nombre}, faltan {dias} días para que puedas retirar ({fecha}). Te avisamos ese día. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('RECORDATORIO_HONORARIO','Recordatorio de pago de honorario','Hola {nombre}, te recordamos el pago de nuestro honorario por {monto} (IVA incluido) del trámite {folio}. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('RECORDATORIO_M40','Recordatorio de pago M40','Hola {nombre}, tu pago de Modalidad 40 de {mes} vence el {fecha}. Recuerda que dos meses sin pago causan baja. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('SOLICITUD_INGRESADA','Solicitud ingresada','Hola {nombre}, ingresamos tu solicitud {folio} a la Afore. La respuesta suele llegar en 5 días hábiles. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('SOLICITUD_REFERIDOS','Solicitud de referidos','Hola {nombre}, gracias por confiar en nosotros. Si conoces a alguien que se quedó sin empleo, compártele nuestro contacto. RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245'),
('YA_PUEDES_RETIRAR','Ya puedes retirar','Hola {nombre}, ya se cumplieron los 46 días desde tu baja. Ya podemos ingresar tu solicitud de retiro. ¿Agendamos? RetiroPorDesempleo.com · WhatsApp 56 6474 9567 · 800 611 1245')
ON CONFLICT (clave) DO NOTHING;
