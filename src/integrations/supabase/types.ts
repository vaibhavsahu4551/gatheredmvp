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
          id: number
          subscription_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          subscription_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          subscription_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_groups: {
        Row: {
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          created_at: string
          group_id: string
          id: string
          pride_actor_id: string | null
          user_id: string
          voice_duration_ms: number | null
          voice_url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          group_id: string
          id?: string
          pride_actor_id?: string | null
          user_id: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          group_id?: string
          id?: string
          pride_actor_id?: string | null
          user_id?: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          sender_id: string
          share_id: string | null
          share_kind: string | null
          thread_id: string
          voice_duration_ms: number | null
          voice_url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          sender_id: string
          share_id?: string | null
          share_kind?: string | null
          thread_id: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          sender_id?: string
          share_id?: string | null
          share_kind?: string | null
          thread_id?: string
          voice_duration_ms?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          created_at: string
          id: string
          last_read_a: string | null
          last_read_b: string | null
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_a?: string | null
          last_read_b?: string | null
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_a?: string | null
          last_read_b?: string | null
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      event_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          pride_actor_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          pride_actor_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          pride_actor_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          created_at: string
          event_id: string
          gender: string | null
          id: string
          pride_actor_id: string | null
          status: Database["public"]["Enums"]["participant_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          gender?: string | null
          id?: string
          pride_actor_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          gender?: string | null
          id?: string
          pride_actor_id?: string | null
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          auto_cancel_hours: number
          boost_weight: number
          category: Database["public"]["Enums"]["event_category"] | null
          city: string
          created_at: string
          description: string | null
          entry_fee: number | null
          event_type: string | null
          exact_location: string | null
          host_id: string
          id: string
          is_pride: boolean
          location_address: string
          location_lat: number | null
          location_lng: number | null
          max_size: number
          min_boys: number | null
          min_girls: number | null
          min_size: number
          pride_actor_id: string | null
          pride_premium_only: boolean
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          auto_cancel_hours?: number
          boost_weight?: number
          category?: Database["public"]["Enums"]["event_category"] | null
          city: string
          created_at?: string
          description?: string | null
          entry_fee?: number | null
          event_type?: string | null
          exact_location?: string | null
          host_id: string
          id?: string
          is_pride?: boolean
          location_address: string
          location_lat?: number | null
          location_lng?: number | null
          max_size: number
          min_boys?: number | null
          min_girls?: number | null
          min_size: number
          pride_actor_id?: string | null
          pride_premium_only?: boolean
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          auto_cancel_hours?: number
          boost_weight?: number
          category?: Database["public"]["Enums"]["event_category"] | null
          city?: string
          created_at?: string
          description?: string | null
          entry_fee?: number | null
          event_type?: string | null
          exact_location?: string | null
          host_id?: string
          id?: string
          is_pride?: boolean
          location_address?: string
          location_lat?: number | null
          location_lng?: number | null
          max_size?: number
          min_boys?: number | null
          min_girls?: number | null
          min_size?: number
          pride_actor_id?: string | null
          pride_premium_only?: boolean
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_banners: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_id: string | null
          id: string
          image_url: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_banners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_requests: {
        Row: {
          created_at: string
          from_id: string
          id: string
          status: string
          to_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          status?: string
          to_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          status?: string
          to_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json | null
          id: string
          is_pride: boolean
          kind: string
          read_at: string | null
          target_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_pride?: boolean
          kind: string
          read_at?: string | null
          target_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_pride?: boolean
          kind?: string
          read_at?: string | null
          target_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          city: string
          created_at: string
          event_id: string | null
          id: string
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          city: string
          created_at?: string
          event_id?: string | null
          id?: string
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          city?: string
          created_at?: string
          event_id?: string | null
          id?: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      pride_profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          photo_path: string | null
          pride_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          photo_path?: string | null
          pride_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          photo_path?: string | null
          pride_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pride_violations: {
        Row: {
          created_at: string
          details: string | null
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string
          dob: string | null
          early_access: boolean
          firebase_uid: string | null
          full_name: string | null
          gender: string | null
          id: string
          interests: string[]
          onboarding_complete: boolean
          phone: string | null
          photos: string[]
          premium_expires_at: string | null
          pride_opt_in: boolean
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          selfie_url: string | null
          subscription_tier: string
          suspended_until: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string
          dob?: string | null
          early_access?: boolean
          firebase_uid?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          interests?: string[]
          onboarding_complete?: boolean
          phone?: string | null
          photos?: string[]
          premium_expires_at?: string | null
          pride_opt_in?: boolean
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          selfie_url?: string | null
          subscription_tier?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string
          dob?: string | null
          early_access?: boolean
          firebase_uid?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          interests?: string[]
          onboarding_complete?: boolean
          phone?: string | null
          photos?: string[]
          premium_expires_at?: string | null
          pride_opt_in?: boolean
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          selfie_url?: string | null
          subscription_tier?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_end: string | null
          current_start: string | null
          id: string
          plan_id: string | null
          raw: Json | null
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_end?: string | null
          current_start?: string | null
          id?: string
          plan_id?: string | null
          raw?: Json | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_end?: string | null
          current_start?: string | null
          id?: string
          plan_id?: string | null
          raw?: Json | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          description: string
          id: string
          screenshot_path: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_id?: string
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
      user_settings: {
        Row: {
          created_at: string
          deactivated_at: string | null
          linkup_privacy: string
          notify_comments: boolean
          notify_join_requests: boolean
          notify_likes: boolean
          notify_linkups: boolean
          notify_messages: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          linkup_privacy?: string
          notify_comments?: boolean
          notify_join_requests?: boolean
          notify_likes?: boolean
          notify_linkups?: boolean
          notify_messages?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          linkup_privacy?: string
          notify_comments?: boolean
          notify_join_requests?: boolean
          notify_likes?: boolean
          notify_linkups?: boolean
          notify_messages?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_status: {
        Row: {
          notes: string | null
          priority: boolean
          status: Database["public"]["Enums"]["verification_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          notes?: string | null
          priority?: boolean
          status?: Database["public"]["Enums"]["verification_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          notes?: string | null
          priority?: boolean
          status?: Database["public"]["Enums"]["verification_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_user: {
        Args: { _user: string }
        Returns: {
          bio: string
          created_at: string
          full_name: string
          id: string
          phone: string
          suspended_until: string
        }[]
      }
      admin_list_users: {
        Args: { _search?: string }
        Returns: {
          created_at: string
          full_name: string
          id: string
          phone: string
          pride_opt_in: boolean
          suspended_until: string
        }[]
      }
      admin_suspend_user: {
        Args: { _reason: string; _until: string; _user: string }
        Returns: undefined
      }
      count_events_created_last_30d: {
        Args: { _user: string }
        Returns: number
      }
      count_events_joined_last_30d: { Args: { _user: string }; Returns: number }
      get_dm_unread: {
        Args: never
        Returns: {
          last_body: string
          last_created_at: string
          last_sender: string
          thread_id: string
          unread: number
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          bio: string
          city: string
          created_at: string
          dob: string
          early_access: boolean
          full_name: string
          gender: string
          id: string
          interests: string[]
          onboarding_complete: boolean
          photos: string[]
          premium_expires_at: string
          pride_opt_in: boolean
          selfie_url: string
          subscription_tier: string
          updated_at: string
        }[]
      }
      get_pride_identities: {
        Args: { _pride_ids: string[] }
        Returns: {
          bio: string
          display_name: string
          photo_path: string
          pride_id: string
        }[]
      }
      mark_dm_read: { Args: { _thread: string }; Returns: undefined }
      pride_suspended: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin"
      event_category:
        | "Gaming"
        | "Coffee"
        | "Dinner"
        | "Movie"
        | "Hangout"
        | "Sports"
        | "Party"
      event_status: "pending" | "confirmed" | "cancelled" | "completed"
      participant_status: "pending" | "approved" | "rejected" | "cancelled"
      verification_state: "unverified" | "pending" | "verified"
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
      app_role: ["admin"],
      event_category: [
        "Gaming",
        "Coffee",
        "Dinner",
        "Movie",
        "Hangout",
        "Sports",
        "Party",
      ],
      event_status: ["pending", "confirmed", "cancelled", "completed"],
      participant_status: ["pending", "approved", "rejected", "cancelled"],
      verification_state: ["unverified", "pending", "verified"],
    },
  },
} as const
