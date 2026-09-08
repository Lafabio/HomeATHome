-- Tabela para registrar horas de pregação
CREATE TABLE IF NOT EXISTS horas_pregacao (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    horas DECIMAL(5,2) NOT NULL DEFAULT 0,
    minutos INTEGER NOT NULL DEFAULT 0,
    tipo VARCHAR(50) DEFAULT 'Estudo Biblico',
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_horas_user_id ON horas_pregacao(user_id);
CREATE INDEX IF NOT EXISTS idx_horas_data ON horas_pregacao(data);

-- RLS - cada usuario ve apenas seus dados
ALTER TABLE horas_pregacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem suas horas" ON horas_pregacao
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios inserem suas horas" ON horas_pregacao
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam suas horas" ON horas_pregacao
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios deletam suas horas" ON horas_pregacao
    FOR DELETE USING (auth.uid() = user_id);
