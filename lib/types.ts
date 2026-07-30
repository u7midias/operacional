export type PostStatus = "em_producao" | "aguardando_aprovacao" | "aprovado" | "publicado";
export type PostFormat = "feed" | "story" | "reels";
export type MediaType = "imagem" | "video";

export interface ClientPost {
  id: string;
  format: PostFormat | null;
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
