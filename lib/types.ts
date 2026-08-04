export type PostStatus =
  | "criacao_legenda"
  | "em_producao"
  | "em_revisao"
  | "em_aprovacao"
  | "em_alteracao"
  | "em_agendamento"
  | "publicado";
export type PostFormat = "feed" | "story" | "reels";
export type MediaType = "imagem" | "video";

export interface ClientPost {
  id: string;
  format: PostFormat | null;
  // Nome da etiqueta do Trello como ela foi escrita. Vale pra qualquer
  // etiqueta que a equipe criar, não só feed/story/reels.
  label_name: string | null;
  caption: string | null;
  media_type: MediaType | null;
  media_urls: string[];
  scheduled_date: string | null; // YYYY-MM-DD
  status: PostStatus;
}

export interface GetPostsResponse {
  client: { name: string };
  posts: ClientPost[];
}

export interface AdminClient {
  id: string;
  name: string;
  trello_board_id: string;
  access_token: string;
  is_active: boolean;
  created_at: string;
}
