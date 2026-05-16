-- =========================================
-- EXTENSIONES
-- =========================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================================
-- ENUMS
-- =========================================

CREATE TYPE rol_usuario AS ENUM (
    'admin',
    'cliente'
);

CREATE TYPE tipo_superficie_enum AS ENUM (
    'sintetica',
    'natural',
    'madera',
    'arcilla'
);

CREATE TYPE estado_reserva_enum AS ENUM (
    'pendiente',
    'confirmada',
    'cancelada'
);

CREATE TYPE metodo_pago_enum AS ENUM (
    'efectivo',
    'transferencia',
    'online'
);

CREATE TYPE nivel_ruido_enum AS ENUM (
    'bajo',
    'medio',
    'alto'
);

-- =========================================
-- TABLA USUARIOS
-- =========================================

CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,

    telefono VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,

    rol rol_usuario NOT NULL DEFAULT 'cliente',

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    eliminado BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================
-- TABLA TIPOS DE CANCHA
-- =========================================

CREATE TABLE tipos_cancha (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- TABLA CANCHAS
-- =========================================

CREATE TABLE canchas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nombre VARCHAR(50) NOT NULL UNIQUE,

    tipo_cancha_id BIGINT NOT NULL
        REFERENCES tipos_cancha(id)
        ON DELETE RESTRICT,

    tipo_superficie tipo_superficie_enum NOT NULL,

    precio_por_hora NUMERIC(10,2) NOT NULL
        CHECK (precio_por_hora >= 0),

    esta_activa BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    eliminado BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================
-- TABLA HORARIOS DE CANCHA (SLOTS)
-- =========================================

CREATE TABLE horarios_cancha (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    codigo VARCHAR(30) UNIQUE NOT NULL,
    -- Ejemplo:
    -- CANCHA1-LUN-1700

    cancha_id BIGINT NOT NULL
        REFERENCES canchas(id)
        ON DELETE CASCADE,

    dia_semana INT NOT NULL
        CHECK (dia_semana BETWEEN 0 AND 6),
        -- 0 domingo
        -- 1 lunes
        -- etc.

    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_horario_valido
        CHECK (hora_fin > hora_inicio),

    CONSTRAINT uq_slot_unico
        UNIQUE (cancha_id, dia_semana, hora_inicio)
);

-- =========================================
-- TABLA RESERVAS
-- =========================================

CREATE TABLE reservas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    usuario_id BIGINT NOT NULL
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    horario_cancha_id BIGINT NOT NULL
        REFERENCES horarios_cancha(id)
        ON DELETE RESTRICT,

    fecha_reserva DATE NOT NULL,

    estado estado_reserva_enum NOT NULL
        DEFAULT 'confirmada',

    total_pago NUMERIC(10,2) NOT NULL
        CHECK (total_pago >= 0),

    metodo_pago metodo_pago_enum,

    observaciones TEXT,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Evita doble reserva del mismo slot
    CONSTRAINT uq_reserva_slot
        UNIQUE (fecha_reserva, horario_cancha_id)
);

-- =========================================
-- TABLA INFORMACION DEL NEGOCIO
-- =========================================

CREATE TABLE informacion_negocio (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    clave VARCHAR(50) NOT NULL UNIQUE,
    -- Ej:
    -- politica_cancelacion
    -- reglas_calzado

    valor TEXT NOT NULL,

    ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- TABLA LOGS CONVERSACIONES IA
-- =========================================

CREATE TABLE logs_conversaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    usuario_id BIGINT
        REFERENCES usuarios(id)
        ON DELETE SET NULL,

    session_id VARCHAR(100) NOT NULL,

    -- MENSAJES
    texto_usuario TEXT,
    texto_respuesta TEXT,

    -- LATENCIAS
    latencia_stt_ms INT,
    latencia_llm_ms INT,
    latencia_tts_ms INT,
    latencia_total_ms INT,

    -- TOKENS Y COSTOS
    tokens_input INT,
    tokens_output INT,

    costo_estimado_usd NUMERIC(12,8),

    -- CALIDAD AUDIO
    nivel_ruido_percibido nivel_ruido_enum,

    error_transcripcion BOOLEAN NOT NULL DEFAULT FALSE,

    detalles_error TEXT,

    -- MÉTRICA TESIS / UX
    satisfaccion_usuario INT
        CHECK (satisfaccion_usuario BETWEEN 1 AND 5),

    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- INDICES
-- =========================================

CREATE INDEX idx_reservas_fecha
ON reservas(fecha_reserva);

CREATE INDEX idx_reservas_usuario
ON reservas(usuario_id);

CREATE INDEX idx_reservas_horario
ON reservas(horario_cancha_id);

CREATE INDEX idx_horarios_cancha
ON horarios_cancha(cancha_id);

CREATE INDEX idx_horarios_dia
ON horarios_cancha(dia_semana);

CREATE INDEX idx_logs_usuario
ON logs_conversaciones(usuario_id);

CREATE INDEX idx_logs_session
ON logs_conversaciones(session_id);

CREATE INDEX idx_logs_fecha
ON logs_conversaciones(fecha_registro);

-- =========================================
-- FUNCION UPDATED_AT AUTOMATICA
-- =========================================

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- TRIGGERS UPDATED_AT
-- =========================================

CREATE TRIGGER trg_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_canchas_updated_at
BEFORE UPDATE ON canchas
FOR EACH ROW
EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trg_reservas_updated_at
BEFORE UPDATE ON reservas
FOR EACH ROW
EXECUTE FUNCTION actualizar_updated_at();

-- =========================================
-- ROW LEVEL SECURITY (SUPABASE)
-- =========================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_conversaciones ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLITICAS BASICAS
-- =========================================

-- Usuarios pueden ver sus propias reservas
CREATE POLICY "usuarios_ver_sus_reservas"
ON reservas
FOR SELECT
USING (
    auth.uid()::text = usuario_id::text
);

-- Usuarios pueden crear sus propias reservas
CREATE POLICY "usuarios_crear_reservas"
ON reservas
FOR INSERT
WITH CHECK (
    auth.uid()::text = usuario_id::text
);