-- Guarda o nome da etiqueta do Trello como texto livre.
--
-- `format` é um enum limitado a feed/story/reels, então qualquer etiqueta nova
-- criada pela equipe (ex: "CRIATIVO PARA ANÚNCIO") não tinha onde ser gravada
-- e o post aparecia como "Post" genérico no calendário do cliente. Aqui vale a
-- mesma lição do conjunto de status: quem inventa esses nomes é a operação, e
-- eles mudam — texto livre, não enum.
--
-- `format` continua existindo: é o que dá o rótulo bonitinho (Feed/Story/
-- Reels) quando a etiqueta é uma das três conhecidas.

alter table posts add column if not exists label_name text;
