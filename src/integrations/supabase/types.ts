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
      community_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_palace_anchors: {
        Row: {
          anchor_order: number
          created_at: string
          id: string
          name: string
          style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_order?: number
          created_at?: string
          id?: string
          name: string
          style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_order?: number
          created_at?: string
          id?: string
          name?: string
          style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_palace_placements: {
        Row: {
          anchor_id: string
          created_at: string
          id: string
          imagery_text: string
          last_recalled_at: string | null
          recall_correct: number
          recall_incorrect: number
          status: string
          updated_at: string
          user_id: string
          word_id: string
        }
        Insert: {
          anchor_id: string
          created_at?: string
          id?: string
          imagery_text: string
          last_recalled_at?: string | null
          recall_correct?: number
          recall_incorrect?: number
          status?: string
          updated_at?: string
          user_id: string
          word_id: string
        }
        Update: {
          anchor_id?: string
          created_at?: string
          id?: string
          imagery_text?: string
          last_recalled_at?: string | null
          recall_correct?: number
          recall_incorrect?: number
          status?: string
          updated_at?: string
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_palace_placements_anchor_id_fkey"
            columns: ["anchor_id"]
            isOneToOne: false
            referencedRelation: "memory_palace_anchors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_palace_placements_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          event_id: string
          event_type: string | null
          processed_at: string
          provider: string
          raw_payload: Json | null
        }
        Insert: {
          event_id: string
          event_type?: string | null
          processed_at?: string
          provider: string
          raw_payload?: Json | null
        }
        Update: {
          event_id?: string
          event_type?: string | null
          processed_at?: string
          provider?: string
          raw_payload?: Json | null
        }
        Relationships: []
      }
      payment_verification_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payment_id: string
          provider: string
          reviewed_at: string | null
          selected_plan: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_id: string
          provider?: string
          reviewed_at?: string | null
          selected_plan: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_id?: string
          provider?: string
          reviewed_at?: string | null
          selected_plan?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      quiz_sessions: {
        Row: {
          answers: Json
          completed: boolean
          created_at: string
          duration_seconds: number | null
          id: string
          quiz_date: string
          score: number
          total_questions: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answers?: Json
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          id?: string
          quiz_date: string
          score?: number
          total_questions?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answers?: Json
          completed?: boolean
          created_at?: string
          duration_seconds?: number | null
          id?: string
          quiz_date?: string
          score?: number
          total_questions?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_processed_events: {
        Row: {
          event_type: string
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          event_type: string
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount_paid: number | null
          billing_interval: string | null
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          provider: string | null
          provider_link_id: string | null
          provider_payment_id: string | null
          provider_payment_request_id: string | null
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_link_id?: string | null
          provider_payment_id?: string | null
          provider_payment_request_id?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          provider?: string | null
          provider_link_id?: string | null
          provider_payment_id?: string | null
          provider_payment_request_id?: string | null
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      word_stats: {
        Row: {
          correct_count: number
          created_at: string
          difficulty_score: number
          id: string
          incorrect_count: number
          last_tested_at: string | null
          updated_at: string
          word_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          difficulty_score?: number
          id?: string
          incorrect_count?: number
          last_tested_at?: string | null
          updated_at?: string
          word_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          difficulty_score?: number
          id?: string
          incorrect_count?: number
          last_tested_at?: string | null
          updated_at?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_stats_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: true
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          antonyms: string | null
          created_at: string
          example_sentence: string | null
          id: string
          meaning_english: string | null
          meaning_hindi: string | null
          notes: string | null
          part_of_speech: string | null
          pronunciation: string | null
          spelling: string | null
          synonyms: string | null
          updated_at: string
          user_id: string | null
          word: string
          word_forms: string | null
        }
        Insert: {
          antonyms?: string | null
          created_at?: string
          example_sentence?: string | null
          id?: string
          meaning_english?: string | null
          meaning_hindi?: string | null
          notes?: string | null
          part_of_speech?: string | null
          pronunciation?: string | null
          spelling?: string | null
          synonyms?: string | null
          updated_at?: string
          user_id?: string | null
          word: string
          word_forms?: string | null
        }
        Update: {
          antonyms?: string | null
          created_at?: string
          example_sentence?: string | null
          id?: string
          meaning_english?: string | null
          meaning_hindi?: string | null
          notes?: string | null
          part_of_speech?: string | null
          pronunciation?: string | null
          spelling?: string | null
          synonyms?: string | null
          updated_at?: string
          user_id?: string | null
          word?: string
          word_forms?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_community_messages: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          content: string
          created_at: string
          display_name: string
          id: string
          user_id: string
        }[]
      }
      get_leaderboard: {
        Args: never
        Returns: {
          accuracy: number
          avatar_url: string
          display_name: string
          total_questions: number
          total_quizzes: number
          total_score: number
          user_id: string
          words_added: number
        }[]
      }
      get_learner_quiz_history: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          accuracy: number
          created_at: string
          duration_seconds: number
          id: string
          quiz_date: string
          score: number
          total_questions: number
        }[]
      }
      get_memory_palace_active: {
        Args: { _user_id: string }
        Returns: {
          anchor_id: string
          anchor_name: string
          created_at: string
          id: string
          imagery_text: string
          last_recalled_at: string
          meaning_english: string
          recall_correct: number
          recall_incorrect: number
          word: string
          word_id: string
        }[]
      }
      get_memory_palace_anchors: {
        Args: { _user_id: string }
        Returns: {
          active_word_count: number
          anchor_order: number
          id: string
          name: string
          style: string
        }[]
      }
      get_profile_by_username: {
        Args: { _username: string }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
      get_unplaced_words: {
        Args: { _user_id: string }
        Returns: {
          id: string
          meaning_english: string
          word: string
        }[]
      }
      ensure_my_profile: { Args: never; Returns: undefined }
      is_user_pro: { Args: { _user_id: string }; Returns: boolean }
      is_username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
