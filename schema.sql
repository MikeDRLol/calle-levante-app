-- =============================================================================
-- Calle Levante — Esquema PostgreSQL (Supabase)
-- Empresa de eventos musicales
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase o con: supabase db execute -f schema.sql
-- Requiere: esquema auth (auth.users) provisto por Supabase.
-- RLS: habilitar en una migración posterior con políticas concretas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensiones
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

CREATE TYPE public.usuario_rol AS ENUM (
  'admin',
  'gestor',
  'contabilidad',
  'operaciones',
  'solo_lectura'
);

CREATE TYPE public.evento_estado AS ENUM (
  'borrador',
  'confirmado',
  'en_curso',
  'finalizado',
  'cancelado'
);

CREATE TYPE public.participante_rol AS ENUM (
  'artista',
  'tecnico',
  'dj',
  'personal_apoyo',
  'otro'
);

CREATE TYPE public.liquidacion_estado AS ENUM (
  'pendiente',
  'aprobada',
  'pagada',
  'rechazada',
  'anulada'
);

CREATE TYPE public.movimiento_direccion AS ENUM (
  'entrada',
  'salida'
);

CREATE TYPE public.movimiento_origen AS ENUM (
  'manual',
  'bizum',
  'factura',
  'gasto',
  'liquidacion'
);

CREATE TYPE public.bizum_estado AS ENUM (
  'pendiente',
  'confirmado',
  'rechazado',
  'devuelto'
);

CREATE TYPE public.factura_estado AS ENUM (
  'borrador',
  'emitida',
  'pagada_parcial',
  'pagada',
  'vencida',
  'anulada'
);

CREATE TYPE public.material_estado AS ENUM (
  'disponible',
  'en_uso',
  'mantenimiento',
  'baja'
);

CREATE TYPE public.asignacion_material_estado AS ENUM (
  'reservada',
  'entregada',
  'devuelta',
  'perdida',
  'danada'
);

CREATE TYPE public.gasto_estado AS ENUM (
  'pendiente',
  'pagado',
  'anulado'
);

CREATE TYPE public.nota_entidad AS ENUM (
  'cliente',
  'evento',
  'participante',
  'factura',
  'proveedor',
  'material',
  'liquidacion',
  'gasto',
  'bizum'
);

-- -----------------------------------------------------------------------------
-- Funciones auxiliares
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_liquidacion_evento_participante()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_evento_id uuid;
BEGIN
  SELECT evento_id INTO v_evento_id
  FROM public.participantes
  WHERE id = NEW.participante_id;

  IF v_evento_id IS NULL THEN
    RAISE EXCEPTION 'El participante % no existe', NEW.participante_id;
  END IF;

  IF NEW.evento_id IS DISTINCT FROM v_evento_id THEN
    RAISE EXCEPTION
      'La liquidación (evento %) no coincide con el evento del participante (%)',
      NEW.evento_id, v_evento_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_asignacion_material_cantidad()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_disponible integer;
  v_ocupado_otras integer;
BEGIN
  SELECT cantidad_disponible INTO v_disponible
  FROM public.material
  WHERE id = NEW.material_id
  FOR UPDATE;

  IF TG_OP = 'UPDATE' AND OLD.material_id = NEW.material_id THEN
    SELECT COALESCE(SUM(cantidad), 0) INTO v_ocupado_otras
    FROM public.asignaciones_material
    WHERE material_id = NEW.material_id
      AND id <> NEW.id
      AND estado IN ('reservada', 'entregada');

    v_disponible := v_disponible + CASE
      WHEN OLD.estado IN ('reservada', 'entregada') THEN OLD.cantidad
      ELSE 0
    END;
  END IF;

  IF NEW.estado IN ('reservada', 'entregada')
     AND NEW.cantidad > v_disponible THEN
    RAISE EXCEPTION
      'Cantidad solicitada (%) supera el stock disponible (%) del material %',
      NEW.cantidad, v_disponible, NEW.material_id;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Usuarios de la aplicación (vinculados a Supabase Auth)
-- -----------------------------------------------------------------------------

CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  apellidos text,
  email text NOT NULL,
  telefono text,
  rol public.usuario_rol NOT NULL DEFAULT 'operaciones',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT usuarios_email_format CHECK (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  CONSTRAINT usuarios_nombre_not_blank CHECK (char_length(trim(nombre)) > 0)
);

CREATE INDEX idx_usuarios_rol ON public.usuarios (rol) WHERE activo = true;
CREATE INDEX idx_usuarios_email ON public.usuarios (lower(email));

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  nombre_comercial text,
  nif_cif text,
  email text,
  telefono text,
  direccion text,
  codigo_postal text,
  ciudad text,
  provincia text,
  pais text NOT NULL DEFAULT 'ES',
  persona_contacto text,
  notas_internas text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT clientes_razon_social_not_blank CHECK (char_length(trim(razon_social)) > 0),
  CONSTRAINT clientes_nif_format CHECK (
    nif_cif IS NULL OR char_length(trim(nif_cif)) BETWEEN 8 AND 15
  )
);

CREATE UNIQUE INDEX idx_clientes_nif_cif_unique
  ON public.clientes (upper(trim(nif_cif)))
  WHERE nif_cif IS NOT NULL AND trim(nif_cif) <> '';

CREATE INDEX idx_clientes_razon_social ON public.clientes (lower(razon_social));
CREATE INDEX idx_clientes_activo ON public.clientes (activo) WHERE activo = true;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Proveedores
-- -----------------------------------------------------------------------------

CREATE TABLE public.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  nif_cif text,
  email text,
  telefono text,
  direccion text,
  codigo_postal text,
  ciudad text,
  pais text NOT NULL DEFAULT 'ES',
  iban text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT proveedores_razon_social_not_blank CHECK (char_length(trim(razon_social)) > 0)
);

CREATE INDEX idx_proveedores_razon_social ON public.proveedores (lower(razon_social));
CREATE INDEX idx_proveedores_activo ON public.proveedores (activo) WHERE activo = true;

CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Categorías de material
-- -----------------------------------------------------------------------------

CREATE TABLE public.categorias_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  parent_id uuid REFERENCES public.categorias_material (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT categorias_material_nombre_not_blank CHECK (char_length(trim(nombre)) > 0),
  CONSTRAINT categorias_material_no_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE UNIQUE INDEX idx_categorias_material_nombre_parent
  ON public.categorias_material (lower(trim(nombre)), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX idx_categorias_material_parent_id ON public.categorias_material (parent_id);

CREATE TRIGGER trg_categorias_material_updated_at
  BEFORE UPDATE ON public.categorias_material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Material (inventario)
-- -----------------------------------------------------------------------------

CREATE TABLE public.material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.categorias_material (id) ON DELETE RESTRICT,
  codigo text,
  nombre text NOT NULL,
  descripcion text,
  cantidad_total integer NOT NULL DEFAULT 0,
  cantidad_disponible integer NOT NULL DEFAULT 0,
  unidad text NOT NULL DEFAULT 'ud',
  valor_estimado numeric(12, 2),
  estado public.material_estado NOT NULL DEFAULT 'disponible',
  ubicacion text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT material_nombre_not_blank CHECK (char_length(trim(nombre)) > 0),
  CONSTRAINT material_cantidades_nonneg CHECK (
    cantidad_total >= 0 AND cantidad_disponible >= 0
  ),
  CONSTRAINT material_disponible_lte_total CHECK (
    cantidad_disponible <= cantidad_total
  ),
  CONSTRAINT material_valor_nonneg CHECK (
    valor_estimado IS NULL OR valor_estimado >= 0
  )
);

CREATE UNIQUE INDEX idx_material_codigo_unique
  ON public.material (upper(trim(codigo)))
  WHERE codigo IS NOT NULL AND trim(codigo) <> '';

CREATE INDEX idx_material_categoria_id ON public.material (categoria_id);
CREATE INDEX idx_material_estado ON public.material (estado);
CREATE INDEX idx_material_nombre ON public.material (lower(nombre));

CREATE TRIGGER trg_material_updated_at
  BEFORE UPDATE ON public.material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Eventos
-- -----------------------------------------------------------------------------

CREATE TABLE public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE RESTRICT,
  responsable_usuario_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text,
  lugar text,
  direccion text,
  ciudad text,
  fecha_inicio timestamptz NOT NULL,
  fecha_fin timestamptz NOT NULL,
  estado public.evento_estado NOT NULL DEFAULT 'borrador',
  presupuesto_acordado numeric(12, 2),
  moneda char(3) NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT eventos_nombre_not_blank CHECK (char_length(trim(nombre)) > 0),
  CONSTRAINT eventos_fechas_coherentes CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT eventos_presupuesto_nonneg CHECK (
    presupuesto_acordado IS NULL OR presupuesto_acordado >= 0
  ),
  CONSTRAINT eventos_moneda_iso CHECK (moneda ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_eventos_cliente_id ON public.eventos (cliente_id);
CREATE INDEX idx_eventos_fecha_inicio ON public.eventos (fecha_inicio);
CREATE INDEX idx_eventos_estado ON public.eventos (estado);
CREATE INDEX idx_eventos_responsable ON public.eventos (responsable_usuario_id);

CREATE TRIGGER trg_eventos_updated_at
  BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Participantes (asignación a un evento concreto)
-- -----------------------------------------------------------------------------

CREATE TABLE public.participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos (id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  nombre text NOT NULL,
  apellidos text,
  rol public.participante_rol NOT NULL DEFAULT 'artista',
  email text,
  telefono text,
  documento_identidad text,
  iban text,
  honorarios_brutos numeric(12, 2),
  retencion_irpf numeric(12, 2),
  honorarios_netos numeric(12, 2),
  confirmado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT participantes_nombre_not_blank CHECK (char_length(trim(nombre)) > 0),
  CONSTRAINT participantes_honorarios_nonneg CHECK (
    honorarios_brutos IS NULL OR honorarios_brutos >= 0
  ),
  CONSTRAINT participantes_retencion_nonneg CHECK (
    retencion_irpf IS NULL OR retencion_irpf >= 0
  ),
  CONSTRAINT participantes_netos_nonneg CHECK (
    honorarios_netos IS NULL OR honorarios_netos >= 0
  )
);

CREATE INDEX idx_participantes_evento_id ON public.participantes (evento_id);
CREATE INDEX idx_participantes_usuario_id ON public.participantes (usuario_id);
CREATE INDEX idx_participantes_rol ON public.participantes (rol);

CREATE TRIGGER trg_participantes_updated_at
  BEFORE UPDATE ON public.participantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Facturas
-- -----------------------------------------------------------------------------

CREATE TABLE public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE RESTRICT,
  evento_id uuid REFERENCES public.eventos (id) ON DELETE SET NULL,
  serie text NOT NULL DEFAULT 'A',
  numero integer NOT NULL,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  base_imponible numeric(12, 2) NOT NULL DEFAULT 0,
  tipo_iva numeric(5, 2) NOT NULL DEFAULT 21.00,
  cuota_iva numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  estado public.factura_estado NOT NULL DEFAULT 'borrador',
  moneda char(3) NOT NULL DEFAULT 'EUR',
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT facturas_serie_numero_unique UNIQUE (serie, numero),
  CONSTRAINT facturas_importes_nonneg CHECK (
    base_imponible >= 0 AND cuota_iva >= 0 AND total >= 0
  ),
  CONSTRAINT facturas_tipo_iva_valid CHECK (tipo_iva >= 0 AND tipo_iva <= 100),
  CONSTRAINT facturas_vencimiento_coherente CHECK (
    fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_emision
  ),
  CONSTRAINT facturas_moneda_iso CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT facturas_serie_not_blank CHECK (char_length(trim(serie)) > 0),
  CONSTRAINT facturas_numero_positive CHECK (numero > 0)
);

CREATE INDEX idx_facturas_cliente_id ON public.facturas (cliente_id);
CREATE INDEX idx_facturas_evento_id ON public.facturas (evento_id);
CREATE INDEX idx_facturas_estado ON public.facturas (estado);
CREATE INDEX idx_facturas_fecha_emision ON public.facturas (fecha_emision DESC);

CREATE TRIGGER trg_facturas_updated_at
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Liquidaciones (pagos a participantes)
-- -----------------------------------------------------------------------------

CREATE TABLE public.liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id uuid NOT NULL REFERENCES public.participantes (id) ON DELETE RESTRICT,
  evento_id uuid NOT NULL REFERENCES public.eventos (id) ON DELETE RESTRICT,
  importe numeric(12, 2) NOT NULL,
  estado public.liquidacion_estado NOT NULL DEFAULT 'pendiente',
  fecha_prevista date,
  fecha_pago date,
  metodo_pago text,
  referencia_pago text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT liquidaciones_importe_positive CHECK (importe > 0),
  CONSTRAINT liquidaciones_fecha_pago_coherente CHECK (
    fecha_pago IS NULL OR fecha_prevista IS NULL OR fecha_pago >= fecha_prevista
  )
);

CREATE INDEX idx_liquidaciones_participante_id ON public.liquidaciones (participante_id);
CREATE INDEX idx_liquidaciones_evento_id ON public.liquidaciones (evento_id);
CREATE INDEX idx_liquidaciones_estado ON public.liquidaciones (estado);
CREATE INDEX idx_liquidaciones_fecha_prevista ON public.liquidaciones (fecha_prevista);

CREATE TRIGGER trg_liquidaciones_updated_at
  BEFORE UPDATE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_liquidaciones_evento_participante
  BEFORE INSERT OR UPDATE OF participante_id, evento_id ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.check_liquidacion_evento_participante();

-- -----------------------------------------------------------------------------
-- Gastos
-- -----------------------------------------------------------------------------

CREATE TABLE public.gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES public.proveedores (id) ON DELETE SET NULL,
  evento_id uuid REFERENCES public.eventos (id) ON DELETE SET NULL,
  concepto text NOT NULL,
  importe numeric(12, 2) NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado public.gasto_estado NOT NULL DEFAULT 'pendiente',
  numero_documento text,
  deducible boolean NOT NULL DEFAULT true,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT gastos_concepto_not_blank CHECK (char_length(trim(concepto)) > 0),
  CONSTRAINT gastos_importe_positive CHECK (importe > 0)
);

CREATE INDEX idx_gastos_proveedor_id ON public.gastos (proveedor_id);
CREATE INDEX idx_gastos_evento_id ON public.gastos (evento_id);
CREATE INDEX idx_gastos_fecha ON public.gastos (fecha DESC);
CREATE INDEX idx_gastos_estado ON public.gastos (estado);

CREATE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Bizums
-- -----------------------------------------------------------------------------

CREATE TABLE public.bizums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES public.eventos (id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes (id) ON DELETE SET NULL,
  factura_id uuid REFERENCES public.facturas (id) ON DELETE SET NULL,
  importe numeric(12, 2) NOT NULL,
  fecha_operacion timestamptz NOT NULL DEFAULT timezone('utc', now()),
  concepto text,
  telefono_origen text,
  telefono_destino text,
  codigo_referencia text,
  estado public.bizum_estado NOT NULL DEFAULT 'pendiente',
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT bizums_importe_positive CHECK (importe > 0),
  CONSTRAINT bizums_vinculo_logico CHECK (
    evento_id IS NOT NULL OR cliente_id IS NOT NULL OR factura_id IS NOT NULL
  )
);

CREATE INDEX idx_bizums_evento_id ON public.bizums (evento_id);
CREATE INDEX idx_bizums_cliente_id ON public.bizums (cliente_id);
CREATE INDEX idx_bizums_factura_id ON public.bizums (factura_id);
CREATE INDEX idx_bizums_fecha_operacion ON public.bizums (fecha_operacion DESC);
CREATE INDEX idx_bizums_estado ON public.bizums (estado);
CREATE INDEX idx_bizums_codigo_referencia ON public.bizums (codigo_referencia)
  WHERE codigo_referencia IS NOT NULL;

CREATE TRIGGER trg_bizums_updated_at
  BEFORE UPDATE ON public.bizums
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Movimientos económicos (libro de movimientos)
-- -----------------------------------------------------------------------------

CREATE TABLE public.movimientos_economicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES public.eventos (id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes (id) ON DELETE SET NULL,
  direccion public.movimiento_direccion NOT NULL,
  origen public.movimiento_origen NOT NULL DEFAULT 'manual',
  importe numeric(12, 2) NOT NULL,
  moneda char(3) NOT NULL DEFAULT 'EUR',
  fecha_movimiento timestamptz NOT NULL DEFAULT timezone('utc', now()),
  concepto text NOT NULL,
  bizum_id uuid REFERENCES public.bizums (id) ON DELETE SET NULL,
  factura_id uuid REFERENCES public.facturas (id) ON DELETE SET NULL,
  gasto_id uuid REFERENCES public.gastos (id) ON DELETE SET NULL,
  liquidacion_id uuid REFERENCES public.liquidaciones (id) ON DELETE SET NULL,
  registrado_por_usuario_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT movimientos_importe_positive CHECK (importe > 0),
  CONSTRAINT movimientos_moneda_iso CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT movimientos_concepto_not_blank CHECK (char_length(trim(concepto)) > 0),
  CONSTRAINT movimientos_origen_unico CHECK (
    (
      (bizum_id IS NOT NULL)::int +
      (factura_id IS NOT NULL)::int +
      (gasto_id IS NOT NULL)::int +
      (liquidacion_id IS NOT NULL)::int
    ) <= 1
  ),
  CONSTRAINT movimientos_origen_coherente CHECK (
    (origen = 'manual' AND bizum_id IS NULL AND factura_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL)
    OR (origen = 'bizum' AND bizum_id IS NOT NULL)
    OR (origen = 'factura' AND factura_id IS NOT NULL)
    OR (origen = 'gasto' AND gasto_id IS NOT NULL)
    OR (origen = 'liquidacion' AND liquidacion_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_movimientos_bizum_id_unique
  ON public.movimientos_economicos (bizum_id)
  WHERE bizum_id IS NOT NULL;

CREATE UNIQUE INDEX idx_movimientos_gasto_id_unique
  ON public.movimientos_economicos (gasto_id)
  WHERE gasto_id IS NOT NULL;

CREATE UNIQUE INDEX idx_movimientos_liquidacion_id_unique
  ON public.movimientos_economicos (liquidacion_id)
  WHERE liquidacion_id IS NOT NULL;

CREATE INDEX idx_movimientos_evento_id ON public.movimientos_economicos (evento_id);
CREATE INDEX idx_movimientos_cliente_id ON public.movimientos_economicos (cliente_id);
CREATE INDEX idx_movimientos_fecha ON public.movimientos_economicos (fecha_movimiento DESC);
CREATE INDEX idx_movimientos_direccion ON public.movimientos_economicos (direccion);
CREATE INDEX idx_movimientos_origen ON public.movimientos_economicos (origen);
CREATE INDEX idx_movimientos_factura_id ON public.movimientos_economicos (factura_id)
  WHERE factura_id IS NOT NULL;

CREATE TRIGGER trg_movimientos_economicos_updated_at
  BEFORE UPDATE ON public.movimientos_economicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Asignaciones de material a eventos
-- -----------------------------------------------------------------------------

CREATE TABLE public.asignaciones_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.material (id) ON DELETE RESTRICT,
  evento_id uuid NOT NULL REFERENCES public.eventos (id) ON DELETE CASCADE,
  cantidad integer NOT NULL,
  estado public.asignacion_material_estado NOT NULL DEFAULT 'reservada',
  fecha_reserva timestamptz NOT NULL DEFAULT timezone('utc', now()),
  fecha_entrega timestamptz,
  fecha_devolucion timestamptz,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT asignaciones_cantidad_positive CHECK (cantidad > 0),
  CONSTRAINT asignaciones_fechas_coherentes CHECK (
    fecha_entrega IS NULL
    OR fecha_devolucion IS NULL
    OR fecha_devolucion >= fecha_entrega
  )
);

CREATE INDEX idx_asignaciones_material_material_id ON public.asignaciones_material (material_id);
CREATE INDEX idx_asignaciones_material_evento_id ON public.asignaciones_material (evento_id);
CREATE INDEX idx_asignaciones_material_estado ON public.asignaciones_material (estado);

CREATE TRIGGER trg_asignaciones_material_updated_at
  BEFORE UPDATE ON public.asignaciones_material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_asignaciones_material_cantidad
  BEFORE INSERT OR UPDATE OF cantidad, material_id, estado ON public.asignaciones_material
  FOR EACH ROW EXECUTE FUNCTION public.check_asignacion_material_cantidad();

-- -----------------------------------------------------------------------------
-- Notas (polimórficas por tipo + id de entidad)
-- -----------------------------------------------------------------------------

CREATE TABLE public.notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_usuario_id uuid REFERENCES public.usuarios (id) ON DELETE SET NULL,
  entidad_tipo public.nota_entidad NOT NULL,
  entidad_id uuid NOT NULL,
  titulo text,
  contenido text NOT NULL,
  fijada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT notas_contenido_not_blank CHECK (char_length(trim(contenido)) > 0)
);

CREATE INDEX idx_notas_entidad ON public.notas (entidad_tipo, entidad_id);
CREATE INDEX idx_notas_autor ON public.notas (autor_usuario_id);
CREATE INDEX idx_notas_fijada ON public.notas (fijada) WHERE fijada = true;
CREATE INDEX idx_notas_created_at ON public.notas (created_at DESC);

CREATE TRIGGER trg_notas_updated_at
  BEFORE UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Comentarios (documentación en catálogo)
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.usuarios IS 'Perfiles de aplicación enlazados a auth.users de Supabase.';
COMMENT ON TABLE public.participantes IS 'Personas asignadas a un evento (artistas, técnicos, etc.).';
COMMENT ON TABLE public.movimientos_economicos IS 'Registro central de entradas y salidas de dinero.';
COMMENT ON TABLE public.notas IS 'Notas adjuntas a entidades del sistema (entidad_tipo + entidad_id).';
