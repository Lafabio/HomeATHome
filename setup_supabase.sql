-- Execute este script no Supabase SQL Editor
-- Acesse: https://supabase.com/dashboard > Seu Projeto > SQL Editor

-- Criar tabela de interessados
CREATE TABLE IF NOT EXISTS interessados (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    sexo VARCHAR(20) NOT NULL,
    idade INTEGER NOT NULL,
    telefone VARCHAR(20),
    endereco_completo TEXT,
    info_adicionais TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    endereco_geocode TEXT,
    data_cadastro TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE interessados ENABLE ROW LEVEL SECURITY;

-- Criar politica para permitir todas as operacoes (para uso simples)
CREATE POLICY "Permitir todas operacoes" ON interessados
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Criar indice para buscas
CREATE INDEX IF NOT EXISTS idx_interessados_nome ON interessados(nome);
