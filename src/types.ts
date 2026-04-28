export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  roleId?: number;
  permissions?: string[];
}

export interface Devolucion {
  Ticket: string;
  N_Guia: string;
  N_Serie: string;
  Sticker: string;
  Comentario: string;
  Adjunto: string;
  FechaRegistro: string;
  IdEquipo?: string;
  VC_oden_compra_numero?: string;
  VC_nombre_equipo?: string;
}

export interface TechnicalReport {
  Id: string | number;
  Ticket: string;
  FechaCierre: string;
  NombreArchivoPDF?: string;
  IdEquipo: string;
  NombreEquipo: string;
  CodigoExternoEquipo: string;
  TrabajoRealizado?: string;
  ComentarioTecnico?: string;
  Tecnico?: string;
  Asunto?: string;
  SolicitaNuevaVisita?: string;
  MotivoNuevaVisita?: string;
  LlamadaFSM?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
