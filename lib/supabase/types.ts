export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      artistas: {
        Row: {
          auth_provider: string | null
          banco: string | null
          bio: string | null
          bio_completa: string | null
          ciudad: string | null
          color_acento: string
          comision: number
          created_at: string
          cuenta_bancaria: string | null
          es_editorial: boolean
          es_founder: boolean
          foto_url: string | null
          generos: string[] | null
          id: string
          instagram_url: string | null
          nombre: string
          redes: Json
          region: string | null
          rut: string | null
          seo_descripcion: string | null
          seo_titulo: string | null
          slug: string
          soundcloud_url: string | null
          spotify_id: string | null
          spotify_url: string | null
          tienda_activa: boolean
          tiene_tienda: boolean
          tiktok_url: string | null
          tipo_cuenta: string | null
          user_id: string | null
          verificado: boolean | null
          youtube_url: string | null
        }
        Insert: {
          auth_provider?: string | null
          banco?: string | null
          bio?: string | null
          bio_completa?: string | null
          ciudad?: string | null
          color_acento?: string
          comision?: number
          created_at?: string
          cuenta_bancaria?: string | null
          es_editorial?: boolean
          es_founder?: boolean
          foto_url?: string | null
          generos?: string[] | null
          id?: string
          instagram_url?: string | null
          nombre: string
          redes?: Json
          region?: string | null
          rut?: string | null
          seo_descripcion?: string | null
          seo_titulo?: string | null
          slug: string
          soundcloud_url?: string | null
          spotify_id?: string | null
          spotify_url?: string | null
          tienda_activa?: boolean
          tiene_tienda?: boolean
          tiktok_url?: string | null
          tipo_cuenta?: string | null
          user_id?: string | null
          verificado?: boolean | null
          youtube_url?: string | null
        }
        Update: {
          auth_provider?: string | null
          banco?: string | null
          bio?: string | null
          bio_completa?: string | null
          ciudad?: string | null
          color_acento?: string
          comision?: number
          created_at?: string
          cuenta_bancaria?: string | null
          es_editorial?: boolean
          es_founder?: boolean
          foto_url?: string | null
          generos?: string[] | null
          id?: string
          instagram_url?: string | null
          nombre?: string
          redes?: Json
          region?: string | null
          rut?: string | null
          seo_descripcion?: string | null
          seo_titulo?: string | null
          slug?: string
          soundcloud_url?: string | null
          spotify_id?: string | null
          spotify_url?: string | null
          tienda_activa?: boolean
          tiene_tienda?: boolean
          tiktok_url?: string | null
          tipo_cuenta?: string | null
          user_id?: string | null
          verificado?: boolean | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          icono: string | null
          id: string
          nombre: string
          orden: number
          padre_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          icono?: string | null
          id?: string
          nombre: string
          orden?: number
          padre_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number
          padre_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      cupones: {
        Row: {
          activo: boolean
          artista_id: string | null
          codigo: string
          created_at: string
          descripcion: string | null
          expira_at: string | null
          id: string
          tipo_descuento: string
          usos_actuales: number
          usos_maximos: number | null
          valor: number
        }
        Insert: {
          activo?: boolean
          artista_id?: string | null
          codigo: string
          created_at?: string
          descripcion?: string | null
          expira_at?: string | null
          id?: string
          tipo_descuento?: string
          usos_actuales?: number
          usos_maximos?: number | null
          valor?: number
        }
        Update: {
          activo?: boolean
          artista_id?: string | null
          codigo?: string
          created_at?: string
          descripcion?: string | null
          expira_at?: string | null
          id?: string
          tipo_descuento?: string
          usos_actuales?: number
          usos_maximos?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupones_artista_id_fkey"
            columns: ["artista_id"]
            isOneToOne: false
            referencedRelation: "artistas"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          artista_id: string | null
          comprobante_url: string | null
          created_at: string | null
          fecha_transferencia: string | null
          id: string
          monto: number
          nota: string | null
          numero_comprobante: string | null
        }
        Insert: {
          artista_id?: string | null
          comprobante_url?: string | null
          created_at?: string | null
          fecha_transferencia?: string | null
          id?: string
          monto: number
          nota?: string | null
          numero_comprobante?: string | null
        }
        Update: {
          artista_id?: string | null
          comprobante_url?: string | null
          created_at?: string | null
          fecha_transferencia?: string | null
          id?: string
          monto?: number
          nota?: string | null
          numero_comprobante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_artista_id_fkey"
            columns: ["artista_id"]
            isOneToOne: false
            referencedRelation: "artistas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          artista_id: string | null
          cantidad: number
          ciudad_envio: string | null
          comision_monto: number
          comision_porcentaje: number
          comprador_direccion: Json
          comprador_email: string
          comprador_nombre: string
          created_at: string
          cupon_id: string | null
          direccion_envio: string | null
          estado: string
          grupo_id: string | null
          id: string
          liquidado: boolean | null
          mercadopago_id: string | null
          mercadopago_preference_id: string | null
          metodo_pago: string | null
          monto_artista: number
          mp_preference_id: string | null
          precio_unitario: number
          producto_id: string | null
          region_envio: string | null
        }
        Insert: {
          artista_id?: string | null
          cantidad?: number
          ciudad_envio?: string | null
          comision_monto?: number
          comision_porcentaje?: number
          comprador_direccion?: Json
          comprador_email: string
          comprador_nombre: string
          created_at?: string
          cupon_id?: string | null
          direccion_envio?: string | null
          estado?: string
          grupo_id?: string | null
          id?: string
          liquidado?: boolean | null
          mercadopago_id?: string | null
          mercadopago_preference_id?: string | null
          metodo_pago?: string | null
          monto_artista?: number
          mp_preference_id?: string | null
          precio_unitario?: number
          producto_id?: string | null
          region_envio?: string | null
        }
        Update: {
          artista_id?: string | null
          cantidad?: number
          ciudad_envio?: string | null
          comision_monto?: number
          comision_porcentaje?: number
          comprador_direccion?: Json
          comprador_email?: string
          comprador_nombre?: string
          created_at?: string
          cupon_id?: string | null
          direccion_envio?: string | null
          estado?: string
          grupo_id?: string | null
          id?: string
          liquidado?: boolean | null
          mercadopago_id?: string | null
          mercadopago_preference_id?: string | null
          metodo_pago?: string | null
          monto_artista?: number
          mp_preference_id?: string | null
          precio_unitario?: number
          producto_id?: string | null
          region_envio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_artista_id_fkey"
            columns: ["artista_id"]
            isOneToOne: false
            referencedRelation: "artistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_cupon_id_fkey"
            columns: ["cupon_id"]
            isOneToOne: false
            referencedRelation: "cupones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordenes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          artista_id: string
          categoria_id: string | null
          created_at: string
          descripcion: string | null
          estado: string
          id: string
          imagenes: Json
          motivo_rechazo: string | null
          nombre: string
          precio: number
          stock: number
          tipo: string
          zonas_envio: Json
        }
        Insert: {
          artista_id: string
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          id?: string
          imagenes?: Json
          motivo_rechazo?: string | null
          nombre: string
          precio?: number
          stock?: number
          tipo?: string
          zonas_envio?: Json
        }
        Update: {
          artista_id?: string
          categoria_id?: string | null
          created_at?: string
          descripcion?: string | null
          estado?: string
          id?: string
          imagenes?: Json
          motivo_rechazo?: string | null
          nombre?: string
          precio?: number
          stock?: number
          tipo?: string
          zonas_envio?: Json
        }
        Relationships: [
          {
            foreignKeyName: "productos_artista_id_fkey"
            columns: ["artista_id"]
            isOneToOne: false
            referencedRelation: "artistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      publicaciones: {
        Row: {
          artista_id: string
          bajada: string | null
          categoria: string | null
          ciudad: string | null
          comentario_moderacion: string | null
          created_at: string
          cuerpo: string | null
          estado: string
          fecha_cierre: string | null
          genero: string | null
          id: string
          imagen_url: string | null
          slug: string
          tipo: string
          titular: string
          updated_at: string
          visibilidad: string
        }
        Insert: {
          artista_id: string
          bajada?: string | null
          categoria?: string | null
          ciudad?: string | null
          comentario_moderacion?: string | null
          created_at?: string
          cuerpo?: string | null
          estado?: string
          fecha_cierre?: string | null
          genero?: string | null
          id?: string
          imagen_url?: string | null
          slug: string
          tipo?: string
          titular: string
          updated_at?: string
          visibilidad?: string
        }
        Update: {
          artista_id?: string
          bajada?: string | null
          categoria?: string | null
          ciudad?: string | null
          comentario_moderacion?: string | null
          created_at?: string
          cuerpo?: string | null
          estado?: string
          fecha_cierre?: string | null
          genero?: string | null
          id?: string
          imagen_url?: string | null
          slug?: string
          tipo?: string
          titular?: string
          updated_at?: string
          visibilidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicaciones_artista_id_fkey"
            columns: ["artista_id"]
            isOneToOne: false
            referencedRelation: "artistas"
            referencedColumns: ["id"]
          },
        ]
      }
      suscriptores: {
        Row: {
          created_at: string
          email: string
          estado: string
          id: string
          origen: string
        }
        Insert: {
          created_at?: string
          email: string
          estado?: string
          id?: string
          origen?: string
        }
        Update: {
          created_at?: string
          email?: string
          estado?: string
          id?: string
          origen?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      incrementar_usos_cupon: { Args: { cupon_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "artista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "artista"],
    },
  },
} as const
