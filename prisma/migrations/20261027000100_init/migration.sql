-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auditoria";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('director', 'asesor', 'vendedor', 'socio');

-- CreateEnum
CREATE TYPE "Origen" AS ENUM ('web', 'whatsapp', 'llamada', 'referido', 'vendedor', 'facebook', 'google', 'otro');

-- CreateEnum
CREATE TYPE "EstadoCivil" AS ENUM ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo');

-- CreateEnum
CREATE TYPE "SiNoNoSabe" AS ENUM ('si', 'no', 'no_sabe');

-- CreateEnum
CREATE TYPE "Embudo" AS ENUM ('retiro', 'pension');

-- CreateEnum
CREATE TYPE "Etapa" AS ENUM ('PROSPECTO', 'CONTRATO', 'CERRADO', 'BLOQUEADO', 'PERDIDO', 'PRECALIFICADO', 'EN_ESPERA', 'EXPEDIENTE', 'INGRESADA', 'RESOLUCION', 'PAGADO', 'DIAGNOSTICO', 'PLAN_ENTREGADO', 'ESTRATEGIA_EN_EJECUCION', 'SOLICITUD_PENSION', 'RESOLUCION_IMSS', 'PENSION_OTORGADA', 'SEGUIMIENTO');

-- CreateEnum
CREATE TYPE "ResultadoPrecalificacion" AS ENUM ('NO_ELEGIBLE_DEFINITIVO', 'NO_ELEGIBLE_DESVIO', 'NO_TODAVIA', 'APTO_BLOQUEADO', 'CALIFICA_NO_CONVIENE', 'APTO');

-- CreateEnum
CREATE TYPE "DictamenManual" AS ENUM ('APTO', 'NO_APTO');

-- CreateEnum
CREATE TYPE "EstadoUltimoRetiro" AS ENUM ('por_verificar', 'nunca_retiro', 'con_retiro');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('alta', 'normal', 'baja');

-- CreateEnum
CREATE TYPE "ResultadoAfore" AS ENUM ('aprobado', 'rechazado', 'requiere_cita');

-- CreateEnum
CREATE TYPE "MotivoPerdida" AS ENUM ('no_elegible', 'no_conviene', 'precio', 'no_contesta', 'lo_hizo_solo', 'otro');

-- CreateEnum
CREATE TYPE "Regimen" AS ENUM ('L73', 'L97', 'por_definir');

-- CreateEnum
CREATE TYPE "TipoCuentaAfore" AS ENUM ('registrada', 'asignada');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('A', 'B', 'AB', 'ninguna');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('pendiente', 'recibido', 'validado', 'rechazado', 'vencido');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('nota', 'llamada', 'whatsapp', 'correo', 'cambio_etapa', 'documento', 'pago', 'sistema');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('info', 'aviso', 'critica');

-- CreateEnum
CREATE TYPE "EstadoAlerta" AS ENUM ('activa', 'pospuesta', 'atendida', 'descartada');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('transferencia', 'efectivo', 'tarjeta');

-- CreateEnum
CREATE TYPE "EstadoCobro" AS ENUM ('por_cobrar', 'cobrado', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoComision" AS ENUM ('vendedor', 'referido', 'socio');

-- CreateEnum
CREATE TYPE "BeneficiarioTipo" AS ENUM ('usuario', 'referidor', 'socio');

-- CreateEnum
CREATE TYPE "EstadoComision" AS ENUM ('estimada', 'devengada', 'pagada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoArco" AS ENUM ('acceso', 'rectificacion', 'cancelacion', 'oposicion');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "Rol" NOT NULL,
    "socio_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referidores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "banco" TEXT,
    "clabe_cifrada" BYTEA,
    "clabe_ultimos4" CHAR(4),
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "referidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "razon_social" TEXT,
    "rfc" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "banco" TEXT,
    "clabe_cifrada" BYTEA,
    "clabe_ultimos4" CHAR(4),
    "porcentaje_socio" DECIMAL(5,4) NOT NULL DEFAULT 0.40,
    "costo_administrativo" DECIMAL(14,2) NOT NULL DEFAULT 500,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "socios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_servicio" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "embudo" "Embudo" NOT NULL,
    "forma_cobro" TEXT NOT NULL,
    "honorario_pct" DECIMAL(5,4),
    "honorario_fijo_sugerido" DECIMAL(14,2),
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tipos_servicio_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "afores" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "afores_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "tipos_documento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_dias" INTEGER,
    "requiere_original" BOOLEAN NOT NULL DEFAULT false,
    "instrucciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_documento_servicio" (
    "tipo_documento_id" UUID NOT NULL,
    "tipo_servicio" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_documento_servicio_pkey" PRIMARY KEY ("tipo_documento_id","tipo_servicio")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "apellido_paterno" TEXT,
    "apellido_materno" TEXT,
    "curp_cifrada" BYTEA,
    "curp_hash" TEXT,
    "curp_parcial" TEXT,
    "nss_cifrado" BYTEA,
    "nss_hash" TEXT,
    "nss_ultimos4" CHAR(4),
    "rfc" TEXT,
    "fecha_nacimiento" DATE,
    "sexo" CHAR(1),
    "telefono" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "municipio" TEXT,
    "estado" TEXT,
    "estado_civil" "EstadoCivil",
    "origen" "Origen" NOT NULL,
    "referidor_id" UUID,
    "owner_id" UUID NOT NULL,
    "privacidad_aceptada_at" TIMESTAMPTZ(6),
    "privacidad_version" TEXT,
    "privacidad_ip" TEXT,
    "beneficiarios_designados" "SiNoNoSabe" NOT NULL DEFAULT 'no_sabe',
    "anonimizada_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),
    "motivo_archivo" TEXT,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio" TEXT NOT NULL DEFAULT public.siguiente_folio(),
    "persona_id" UUID NOT NULL,
    "tipo_servicio" TEXT NOT NULL,
    "etapa" "Etapa" NOT NULL DEFAULT 'PROSPECTO',
    "etapa_desde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado_precalificacion" "ResultadoPrecalificacion",
    "dictamen_manual" "DictamenManual",
    "dictamen_manual_motivo" TEXT,
    "dictamen_manual_por" UUID,
    "dictamen_manual_at" TIMESTAMPTZ(6),
    "fecha_elegibilidad" DATE,
    "asignado_a" UUID,
    "owner_id" UUID NOT NULL,
    "vendedor_id" UUID,
    "socio_id" UUID,
    "referidor_id" UUID,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'normal',
    "fecha_primer_contacto" DATE,
    "fecha_contrato" DATE,
    "dias_suspendidos" INTEGER NOT NULL DEFAULT 0,
    "fecha_vencimiento_contrato" DATE,
    "fecha_expediente_completo" DATE,
    "fecha_limite_ingreso" DATE,
    "fecha_ingreso_solicitud" DATE,
    "acuse_afore" TEXT,
    "fecha_limite_resolucion" DATE,
    "fecha_resolucion" DATE,
    "resultado_afore" "ResultadoAfore",
    "honorario_fijo" DECIMAL(14,2),
    "motivo_perdida" "MotivoPerdida",
    "motivo_perdida_texto" TEXT,
    "motivo_bloqueo" TEXT,
    "analisis_impacto_ok" BOOLEAN NOT NULL DEFAULT false,
    "analisis_impacto_texto" TEXT,
    "cliente_entendio_costo" BOOLEAN NOT NULL DEFAULT false,
    "caso_origen_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),
    "motivo_archivo" TEXT,

    CONSTRAINT "casos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_etapas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "etapa_antes" "Etapa",
    "etapa_nueva" "Etapa" NOT NULL,
    "motivo" TEXT,
    "usuario_id" UUID,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspensiones_contrato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "inicio" DATE NOT NULL,
    "fin" DATE,
    "motivo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "suspensiones_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datos_imss" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "regimen" "Regimen" NOT NULL DEFAULT 'por_definir',
    "regimen_justificacion" TEXT,
    "fecha_primera_alta" DATE,
    "fecha_constancia" DATE,
    "semanas_cotizadas" DECIMAL(8,1),
    "semanas_descontadas" DECIMAL(8,1),
    "semanas_reintegradas" DECIMAL(8,1),
    "semanas_totales" DECIMAL(8,1),
    "bimestres_cotizados" INTEGER,
    "fecha_baja" DATE,
    "sbc_ultimo" DECIMAL(12,2),
    "sbc_promedio_250" DECIMAL(12,2),
    "ultimo_patron" TEXT,
    "cotiza_actualmente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "datos_imss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datos_afore" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "afore" TEXT,
    "tipo_cuenta" "TipoCuentaAfore",
    "fecha_apertura_cuenta" DATE,
    "fecha_estado_cuenta" DATE,
    "saldo_rcv" DECIMAL(14,2),
    "saldo_sar92" DECIMAL(14,2),
    "saldo_vivienda" DECIMAL(14,2),
    "saldo_voluntarias" DECIMAL(14,2),
    "estado_ultimo_retiro" "EstadoUltimoRetiro" NOT NULL DEFAULT 'por_verificar',
    "fecha_ultimo_retiro" DATE,
    "ultimo_retiro_verificado_at" TIMESTAMPTZ(6),
    "ultimo_retiro_verificado_por" UUID,
    "ide_vigente" BOOLEAN NOT NULL DEFAULT false,
    "ide_verificado_at" TIMESTAMPTZ(6),
    "banco" TEXT,
    "clabe_cifrada" BYTEA,
    "clabe_ultimos4" CHAR(4),
    "cuenta_nivel4" BOOLEAN NOT NULL DEFAULT false,
    "cuenta_solo_digital" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "datos_afore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "version_reglas" TEXT NOT NULL,
    "fecha_calculo" DATE NOT NULL,
    "entradas" JSONB NOT NULL,
    "uma_diaria" DECIMAL(10,2) NOT NULL,
    "uma_mensual" DECIMAL(12,2) NOT NULL,
    "modalidad_a_monto" DECIMAL(14,2),
    "modalidad_a_semanas" DECIMAL(8,1),
    "modalidad_b_90dias" DECIMAL(14,2),
    "modalidad_b_115pct" DECIMAL(14,2),
    "modalidad_b_monto" DECIMAL(14,2),
    "modalidad_b_semanas" DECIMAL(8,1),
    "modalidad_elegible" "Modalidad" NOT NULL,
    "modalidad_elegida" "Modalidad",
    "monto_estimado" DECIMAL(14,2),
    "semanas_perdidas" DECIMAL(8,1),
    "pct_saldo_retirado" DECIMAL(7,4),
    "semanas_despues" DECIMAL(8,1),
    "impacto_pension" JSONB,
    "severidad_impacto" "Severidad",
    "honorario_estimado" DECIMAL(14,2),
    "neto_cliente_estimado" DECIMAL(14,2),
    "resultado_automatico" "ResultadoPrecalificacion" NOT NULL,
    "resultado" "ResultadoPrecalificacion" NOT NULL,
    "dictamen_manual" "DictamenManual",
    "fecha_elegibilidad" DATE,
    "servicio_sugerido" TEXT,
    "explicacion" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "calculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "tipo_id" UUID NOT NULL,
    "estado" "EstadoDocumento" NOT NULL DEFAULT 'pendiente',
    "archivo_path" TEXT,
    "archivo_bytes" INTEGER,
    "archivo_mime" TEXT,
    "fecha_emision" DATE,
    "fecha_vencimiento" DATE,
    "motivo_rechazo" TEXT,
    "validado_por" UUID,
    "validado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "texto" TEXT NOT NULL,
    "datos" JSONB,
    "usuario_id" UUID,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "regla" TEXT NOT NULL,
    "caso_id" UUID,
    "severidad" "Severidad" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fecha_disparo" DATE NOT NULL,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'activa',
    "pospuesta_hasta" DATE,
    "motivo_descarte" TEXT,
    "asignado_a" UUID NOT NULL,
    "clave_dedup" TEXT NOT NULL,
    "atendida_por" UUID,
    "atendida_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_m40" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "mes" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fecha_limite" DATE NOT NULL,
    "fecha_pago" DATE,
    "comprobante_path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "pagos_m40_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_afore" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha_deposito" DATE NOT NULL,
    "monto_bruto" DECIMAL(14,2) NOT NULL,
    "isr_retenido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monto_neto" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "pagos_afore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "pago_afore_id" UUID,
    "base_calculo" DECIMAL(14,2),
    "honorario_total" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL,
    "fecha_cobro" DATE,
    "metodo" "MetodoPago",
    "referencia" TEXT,
    "factura_folio" TEXT,
    "estado" "EstadoCobro" NOT NULL DEFAULT 'por_cobrar',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esquemas_comision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "tipo" "TipoComision" NOT NULL,
    "tipo_servicio" TEXT,
    "version" INTEGER NOT NULL,
    "reglas" JSONB NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "esquemas_comision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caso_id" UUID NOT NULL,
    "esquema_id" UUID NOT NULL,
    "pago_afore_id" UUID,
    "cobro_id" UUID,
    "tipo" "TipoComision" NOT NULL,
    "componente" TEXT,
    "beneficiario_tipo" "BeneficiarioTipo" NOT NULL,
    "beneficiario_id" UUID NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "regla_aplicada" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoComision" NOT NULL DEFAULT 'estimada',
    "periodo" DATE,
    "fecha_devengo" DATE,
    "fecha_pago" DATE,
    "metodo_pago" "MetodoPago",
    "referencia_pago" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "archivado_at" TIMESTAMPTZ(6),

    CONSTRAINT "comisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'decimal',
    "descripcion" TEXT,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecuciones_tarea" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tarea" TEXT NOT NULL,
    "fecha_cdmx" DATE NOT NULL,
    "iniciada_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminada_at" TIMESTAMPTZ(6),
    "resultado" JSONB,

    CONSTRAINT "ejecuciones_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dias_inhabiles" (
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'oficial',

    CONSTRAINT "dias_inhabiles_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "plantillas_mensaje" (
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'whatsapp',
    "cuerpo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_mensaje_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "plantillas_contrato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo_servicio" TEXT,
    "version" INTEGER NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantillas_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_arco" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID NOT NULL,
    "tipo" "TipoArco" NOT NULL,
    "fecha_recepcion" DATE NOT NULL,
    "fecha_limite" DATE NOT NULL,
    "fecha_respuesta" DATE,
    "descripcion" TEXT NOT NULL,
    "respuesta" TEXT,
    "evidencia_path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "solicitudes_arco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria"."auditoria" (
    "id" BIGSERIAL NOT NULL,
    "tabla" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "campo" TEXT,
    "campos_cambiados" TEXT[],
    "resaltado" BOOLEAN NOT NULL DEFAULT false,
    "antes" JSONB,
    "despues" JSONB,
    "usuario_id" UUID,
    "ip" TEXT,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_documento_nombre_key" ON "tipos_documento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "personas_curp_hash_key" ON "personas"("curp_hash");

-- CreateIndex
CREATE UNIQUE INDEX "personas_nss_hash_key" ON "personas"("nss_hash");

-- CreateIndex
CREATE INDEX "personas_telefono_idx" ON "personas"("telefono");

-- CreateIndex
CREATE INDEX "personas_whatsapp_idx" ON "personas"("whatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "casos_folio_key" ON "casos"("folio");

-- CreateIndex
CREATE INDEX "casos_etapa_idx" ON "casos"("etapa");

-- CreateIndex
CREATE INDEX "casos_asignado_a_idx" ON "casos"("asignado_a");

-- CreateIndex
CREATE INDEX "casos_vendedor_id_idx" ON "casos"("vendedor_id");

-- CreateIndex
CREATE INDEX "casos_socio_id_idx" ON "casos"("socio_id");

-- CreateIndex
CREATE INDEX "historial_etapas_caso_id_fecha_idx" ON "historial_etapas"("caso_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "datos_imss_caso_id_key" ON "datos_imss"("caso_id");

-- CreateIndex
CREATE UNIQUE INDEX "datos_afore_caso_id_key" ON "datos_afore"("caso_id");

-- CreateIndex
CREATE INDEX "calculos_caso_id_created_at_idx" ON "calculos"("caso_id", "created_at");

-- CreateIndex
CREATE INDEX "documentos_caso_id_idx" ON "documentos"("caso_id");

-- CreateIndex
CREATE INDEX "documentos_fecha_vencimiento_idx" ON "documentos"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "eventos_caso_id_fecha_idx" ON "eventos"("caso_id", "fecha");

-- CreateIndex
CREATE INDEX "alertas_asignado_a_estado_severidad_idx" ON "alertas"("asignado_a", "estado", "severidad");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_clave_dedup_asignado_a_key" ON "alertas"("clave_dedup", "asignado_a");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_m40_caso_id_mes_key" ON "pagos_m40"("caso_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_afore_caso_id_numero_key" ON "pagos_afore"("caso_id", "numero");

-- CreateIndex
CREATE INDEX "cobros_estado_fecha_cobro_idx" ON "cobros"("estado", "fecha_cobro");

-- CreateIndex
CREATE UNIQUE INDEX "esquemas_comision_nombre_tipo_servicio_version_key" ON "esquemas_comision"("nombre", "tipo_servicio", "version");

-- CreateIndex
CREATE INDEX "comisiones_beneficiario_tipo_beneficiario_id_estado_idx" ON "comisiones"("beneficiario_tipo", "beneficiario_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_clave_vigente_desde_key" ON "parametros"("clave", "vigente_desde");

-- CreateIndex
CREATE UNIQUE INDEX "ejecuciones_tarea_tarea_fecha_cdmx_key" ON "ejecuciones_tarea"("tarea", "fecha_cdmx");

-- CreateIndex
CREATE INDEX "auditoria_tabla_registro_id_idx" ON "auditoria"."auditoria"("tabla", "registro_id");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_fecha_idx" ON "auditoria"."auditoria"("usuario_id", "fecha");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_documento_servicio" ADD CONSTRAINT "tipos_documento_servicio_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_documento_servicio" ADD CONSTRAINT "tipos_documento_servicio_tipo_servicio_fkey" FOREIGN KEY ("tipo_servicio") REFERENCES "tipos_servicio"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_referidor_id_fkey" FOREIGN KEY ("referidor_id") REFERENCES "referidores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_tipo_servicio_fkey" FOREIGN KEY ("tipo_servicio") REFERENCES "tipos_servicio"("clave") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_referidor_id_fkey" FOREIGN KEY ("referidor_id") REFERENCES "referidores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_caso_origen_id_fkey" FOREIGN KEY ("caso_origen_id") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_etapas" ADD CONSTRAINT "historial_etapas_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensiones_contrato" ADD CONSTRAINT "suspensiones_contrato_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datos_imss" ADD CONSTRAINT "datos_imss_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datos_afore" ADD CONSTRAINT "datos_afore_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datos_afore" ADD CONSTRAINT "datos_afore_afore_fkey" FOREIGN KEY ("afore") REFERENCES "afores"("clave") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculos" ADD CONSTRAINT "calculos_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tipo_id_fkey" FOREIGN KEY ("tipo_id") REFERENCES "tipos_documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_m40" ADD CONSTRAINT "pagos_m40_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_afore" ADD CONSTRAINT "pagos_afore_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_pago_afore_id_fkey" FOREIGN KEY ("pago_afore_id") REFERENCES "pagos_afore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esquemas_comision" ADD CONSTRAINT "esquemas_comision_tipo_servicio_fkey" FOREIGN KEY ("tipo_servicio") REFERENCES "tipos_servicio"("clave") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_caso_id_fkey" FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_esquema_id_fkey" FOREIGN KEY ("esquema_id") REFERENCES "esquemas_comision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_pago_afore_id_fkey" FOREIGN KEY ("pago_afore_id") REFERENCES "pagos_afore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "cobros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_arco" ADD CONSTRAINT "solicitudes_arco_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

