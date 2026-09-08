-- 1. Adicionar coluna user_id na tabela interessados
ALTER TABLE interessados ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Criar indice para user_id
CREATE INDEX IF NOT EXISTS idx_interessados_user_id ON interessados(user_id);

-- 3. Remover politica antiga
DROP POLICY IF EXISTS "Permitir todas operacoes" ON interessados;

-- 4. Criar novas politicas por usuario
CREATE POLICY "Usuarios veem seus proprios dados" ON interessados
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios inserem seus proprios dados" ON interessados
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios atualizam seus proprios dados" ON interessados
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios deletam seus proprios dados" ON interessados
    FOR DELETE USING (auth.uid() = user_id);
