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
          default_booking_whatsapp: string | null
          id: number
          maintenance_enabled: boolean
          maintenance_message: string | null
          subscription_enabled: boolean
          updated_at: string
          upi_id: string | null
          upi_payee_name: string | null
        }
        Insert: {
          default_booking_whatsapp?: string | null
          id?: number
          maintenance_enabled?: boolean
          maintenance_message?: string | null
          subscription_enabled?: boolean
          updated_at?: string
          upi_id?: string | null
          upi_payee_name?: string | null
        }
        Update: {
          default_booking_whatsapp?: string | null
          id?: number
          maintenance_enabled?: boolean
          maintenance_message?: string | null
          subscription_enabled?: boolean
          updated_at?: string
          upi_id?: string | null
          upi_payee_name?: string | null
        }
        Relationships: []
      }
      badge_catalog: {
        Row: {
          active: boolean
          badge: string
          created_at: string
          description: string | null
          icon: string
          label: string
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          badge: string
          created_at?: string
          description?: string | null
          icon?: string
          label: string
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          badge?: string
          created_at?: string
          description?: string | null
          icon?: string
          label?: string
          priority?: number
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
      challenge_completions: {
        Row: {
          challenge_id: string | null
          created_at: string
          id: string
          reward_detail: string | null
          reward_kind: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          id?: string
          reward_detail?: string | null
          reward_kind?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          id?: string
          reward_detail?: string | null
          reward_kind?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          circle_id: string | null
          created_at: string
          event_id: string | null
          id: string
        }
        Insert: {
          circle_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
        }
        Update: {
          circle_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_groups_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: true
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
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
      circle_members: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          name: string
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string
          name: string
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_flags: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          image_path: string | null
          is_pride: boolean
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_pride?: boolean
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_pride?: boolean
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_icebreakers: {
        Row: {
          created_at: string
          day: string
          prompt_id: string
        }
        Insert: {
          created_at?: string
          day: string
          prompt_id: string
        }
        Update: {
          created_at?: string
          day?: string
          prompt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_icebreakers_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "icebreaker_prompts"
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
      event_application_questions: {
        Row: {
          choices: string[]
          created_at: string
          event_id: string
          id: string
          is_required: boolean
          question_text: string
          question_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          choices?: string[]
          created_at?: string
          event_id: string
          id?: string
          is_required?: boolean
          question_text: string
          question_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          choices?: string[]
          created_at?: string
          event_id?: string
          id?: string
          is_required?: boolean
          question_text?: string
          question_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_application_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_applications: {
        Row: {
          answers: Json
          created_at: string
          event_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          event_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          area: string
          back_by: string
          contact_phone: string | null
          created_at: string
          event_id: string
          expires_at: string
          id: string
          starts_at: string
          token: string
          user_id: string
        }
        Insert: {
          area: string
          back_by: string
          contact_phone?: string | null
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          starts_at: string
          token: string
          user_id: string
        }
        Update: {
          area?: string
          back_by?: string
          contact_phone?: string | null
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          starts_at?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
          beginner_friendly: boolean
          booking_type: string
          boost_weight: number
          category: Database["public"]["Enums"]["event_category"] | null
          circle_id: string | null
          city: string
          close_reason: string | null
          closed_at: string | null
          cohost_id: string | null
          cohost_pride_actor_id: string | null
          cohost_status: string
          cover_url: string | null
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
          venue_type: string
        }
        Insert: {
          auto_cancel_hours?: number
          beginner_friendly?: boolean
          booking_type?: string
          boost_weight?: number
          category?: Database["public"]["Enums"]["event_category"] | null
          circle_id?: string | null
          city: string
          close_reason?: string | null
          closed_at?: string | null
          cohost_id?: string | null
          cohost_pride_actor_id?: string | null
          cohost_status?: string
          cover_url?: string | null
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
          venue_type?: string
        }
        Update: {
          auto_cancel_hours?: number
          beginner_friendly?: boolean
          booking_type?: string
          boost_weight?: number
          category?: Database["public"]["Enums"]["event_category"] | null
          circle_id?: string | null
          city?: string
          close_reason?: string | null
          closed_at?: string | null
          cohost_id?: string | null
          cohost_pride_actor_id?: string | null
          cohost_status?: string
          cover_url?: string | null
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
          venue_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
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
      icebreaker_prompts: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      music_tracks: {
        Row: {
          active: boolean
          artist: string
          attribution: string | null
          category: string
          created_at: string
          id: string
          license: string
          storage_path: string | null
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          artist: string
          attribution?: string | null
          category?: string
          created_at?: string
          id?: string
          license?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          artist?: string
          attribution?: string | null
          category?: string
          created_at?: string
          id?: string
          license?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string
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
      official_event_passes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          price: number
          sold_quantity: number
          sort_order: number
          total_quantity: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          price?: number
          sold_quantity?: number
          sort_order?: number
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          price?: number
          sold_quantity?: number
          sort_order?: number
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_event_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "official_events"
            referencedColumns: ["id"]
          },
        ]
      }
      official_events: {
        Row: {
          booking_whatsapp: string | null
          category: string
          city: string
          contact_phone: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          created_by_type: string
          description: string | null
          ends_at: string | null
          id: string
          instructions: string | null
          is_featured: boolean
          is_official: boolean
          is_pinned: boolean
          organizer_logo: string | null
          organizer_name: string
          pass_info: string | null
          pass_price: number | null
          pass_quantity: number | null
          price_text: string | null
          published: boolean
          starts_at: string
          terms: string | null
          ticket_url: string | null
          title: string
          updated_at: string
          venue: string
        }
        Insert: {
          booking_whatsapp?: string | null
          category?: string
          city?: string
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_type?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          instructions?: string | null
          is_featured?: boolean
          is_official?: boolean
          is_pinned?: boolean
          organizer_logo?: string | null
          organizer_name?: string
          pass_info?: string | null
          pass_price?: number | null
          pass_quantity?: number | null
          price_text?: string | null
          published?: boolean
          starts_at: string
          terms?: string | null
          ticket_url?: string | null
          title: string
          updated_at?: string
          venue?: string
        }
        Update: {
          booking_whatsapp?: string | null
          category?: string
          city?: string
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_type?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          instructions?: string | null
          is_featured?: boolean
          is_official?: boolean
          is_pinned?: boolean
          organizer_logo?: string | null
          organizer_name?: string
          pass_info?: string | null
          pass_price?: number | null
          pass_quantity?: number | null
          price_text?: string | null
          published?: boolean
          starts_at?: string
          terms?: string | null
          ticket_url?: string | null
          title?: string
          updated_at?: string
          venue?: string
        }
        Relationships: []
      }
      official_orders: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          event_id: string
          id: string
          order_code: string
          pass_id: string | null
          pass_name: string
          payment_status: string
          quantity: number
          screenshot_path: string | null
          ticket_status: string
          updated_at: string
          user_id: string
          utr: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          event_id: string
          id?: string
          order_code?: string
          pass_id?: string | null
          pass_name: string
          payment_status?: string
          quantity: number
          screenshot_path?: string | null
          ticket_status?: string
          updated_at?: string
          user_id: string
          utr: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          event_id?: string
          id?: string
          order_code?: string
          pass_id?: string | null
          pass_name?: string
          payment_status?: string
          quantity?: number
          screenshot_path?: string | null
          ticket_status?: string
          updated_at?: string
          user_id?: string
          utr?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "official_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_orders_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "official_event_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      points_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          reason: string | null
          ref_user_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          reason?: string | null
          ref_user_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          reason?: string | null
          ref_user_id?: string | null
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
          icebreaker_day: string | null
          id: string
          kind: string
          photo_url: string | null
          prompt_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          city: string
          created_at?: string
          event_id?: string | null
          icebreaker_day?: string | null
          id?: string
          kind?: string
          photo_url?: string | null
          prompt_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          city?: string
          created_at?: string
          event_id?: string | null
          icebreaker_day?: string | null
          id?: string
          kind?: string
          photo_url?: string | null
          prompt_id?: string | null
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
          {
            foreignKeyName: "posts_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "icebreaker_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      pride_profiles: {
        Row: {
          bio: string | null
          created_at: string
          display_name: string
          interests: string[]
          photo_path: string | null
          pride_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_name: string
          interests?: string[]
          photo_path?: string | null
          pride_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_name?: string
          interests?: string[]
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
          boost_credits: number
          city: string | null
          created_at: string
          dob: string | null
          drinking: string | null
          early_access: boolean
          firebase_uid: string | null
          full_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          instagram_handle: string | null
          interests: string[]
          is_verified: boolean
          onboarding_complete: boolean
          phone: string | null
          photos: string[]
          points: number
          premium_expires_at: string | null
          pride_guidelines_at: string | null
          pride_opt_in: boolean
          profession: string | null
          razorpay_customer_id: string | null
          razorpay_subscription_id: string | null
          referral_awarded_at: string | null
          referral_code: string | null
          referred_by: string | null
          smoking: string | null
          spotify_url: string | null
          subscription_tier: string
          suspended_until: string | null
          suspension_reason: string | null
          updated_at: string
          x_handle: string | null
        }
        Insert: {
          bio?: string | null
          boost_credits?: number
          city?: string | null
          created_at?: string
          dob?: string | null
          drinking?: string | null
          early_access?: boolean
          firebase_uid?: string | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          instagram_handle?: string | null
          interests?: string[]
          is_verified?: boolean
          onboarding_complete?: boolean
          phone?: string | null
          photos?: string[]
          points?: number
          premium_expires_at?: string | null
          pride_guidelines_at?: string | null
          pride_opt_in?: boolean
          profession?: string | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          referral_awarded_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          smoking?: string | null
          spotify_url?: string | null
          subscription_tier?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          updated_at?: string
          x_handle?: string | null
        }
        Update: {
          bio?: string | null
          boost_credits?: number
          city?: string | null
          created_at?: string
          dob?: string | null
          drinking?: string | null
          early_access?: boolean
          firebase_uid?: string | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          instagram_handle?: string | null
          interests?: string[]
          is_verified?: boolean
          onboarding_complete?: boolean
          phone?: string | null
          photos?: string[]
          points?: number
          premium_expires_at?: string | null
          pride_guidelines_at?: string | null
          pride_opt_in?: boolean
          profession?: string | null
          razorpay_customer_id?: string | null
          razorpay_subscription_id?: string | null
          referral_awarded_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          smoking?: string | null
          spotify_url?: string | null
          subscription_tier?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          updated_at?: string
          x_handle?: string | null
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
      rewards_config: {
        Row: {
          badge_name: string
          cost_badge: number
          cost_boost: number
          cost_trial_days: number
          id: number
          referral_points: number
          trial_days: number
          updated_at: string
          welcome_points: number
        }
        Insert: {
          badge_name?: string
          cost_badge?: number
          cost_boost?: number
          cost_trial_days?: number
          id?: number
          referral_points?: number
          trial_days?: number
          updated_at?: string
          welcome_points?: number
        }
        Update: {
          badge_name?: string
          cost_badge?: number
          cost_boost?: number
          cost_trial_days?: number
          id?: number
          referral_points?: number
          trial_days?: number
          updated_at?: string
          welcome_points?: number
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          event_id: string | null
          expires_at: string
          id: string
          is_pride: boolean
          media_path: string
          media_type: string
          music_artist: string | null
          music_attribution: string | null
          music_end_ms: number
          music_start_ms: number
          music_title: string | null
          music_url: string | null
          pride_actor_id: string | null
          text_overlay: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          expires_at?: string
          id?: string
          is_pride?: boolean
          media_path: string
          media_type?: string
          music_artist?: string | null
          music_attribution?: string | null
          music_end_ms?: number
          music_start_ms?: number
          music_title?: string | null
          music_url?: string | null
          pride_actor_id?: string | null
          text_overlay?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          expires_at?: string
          id?: string
          is_pride?: boolean
          media_path?: string
          media_type?: string
          music_artist?: string | null
          music_attribution?: string | null
          music_end_ms?: number
          music_start_ms?: number
          music_title?: string | null
          music_url?: string | null
          pride_actor_id?: string | null
          text_overlay?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          story_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
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
      suggestion_dismissals: {
        Row: {
          created_at: string
          dismissed_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_id?: string
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
      user_badges: {
        Row: {
          badge: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          badge: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          badge?: string
          created_at?: string
          id?: string
          reason?: string | null
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
          rejection_reason: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["verification_state"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          notes?: string | null
          priority?: boolean
          rejection_reason?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["verification_state"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          notes?: string | null
          priority?: boolean
          rejection_reason?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["verification_state"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_challenge_assignments: {
        Row: {
          challenge_id: string
          created_at: string
          week_start: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          week_start: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_challenge_assignments_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_challenges: {
        Row: {
          active: boolean
          badge_name: string | null
          created_at: string
          description: string | null
          goal_target: number
          goal_type: string
          id: string
          reward_amount: number
          reward_kind: string
          title: string
        }
        Insert: {
          active?: boolean
          badge_name?: string | null
          created_at?: string
          description?: string | null
          goal_target?: number
          goal_type: string
          id?: string
          reward_amount?: number
          reward_kind?: string
          title: string
        }
        Update: {
          active?: boolean
          badge_name?: string | null
          created_at?: string
          description?: string | null
          goal_target?: number
          goal_type?: string
          id?: string
          reward_amount?: number
          reward_kind?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_points: {
        Args: { _amount: number; _reason: string; _user: string }
        Returns: undefined
      }
      admin_challenge_stats: {
        Args: never
        Returns: {
          badge_count: number
          boost_count: number
          challenge_id: string
          completions: number
          title: string
          trial_count: number
          week_start: string
        }[]
      }
      admin_delete_challenge: { Args: { _id: string }; Returns: undefined }
      admin_delete_icebreaker_prompt: {
        Args: { _id: string }
        Returns: undefined
      }
      admin_delete_post: { Args: { _id: string }; Returns: undefined }
      admin_delete_story: { Args: { _story: string }; Returns: undefined }
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
      admin_grant_badge: {
        Args: { _badge: string; _reason: string; _user: string }
        Returns: undefined
      }
      admin_icebreaker_history: {
        Args: { _limit?: number }
        Returns: {
          body: string
          day: string
          prompt_id: string
          responses: number
        }[]
      }
      admin_icebreaker_responses: {
        Args: { _day?: string; _limit?: number }
        Returns: {
          caption: string
          created_at: string
          full_name: string
          id: string
          user_id: string
        }[]
      }
      admin_list_badge_catalog: {
        Args: never
        Returns: {
          active: boolean
          awarded: number
          badge: string
          description: string
          icon: string
          label: string
          priority: number
        }[]
      }
      admin_list_challenges: {
        Args: never
        Returns: {
          active: boolean
          badge_name: string
          created_at: string
          description: string
          goal_target: number
          goal_type: string
          id: string
          reward_amount: number
          reward_kind: string
          times_used: number
          title: string
        }[]
      }
      admin_list_flags: {
        Args: { _status?: string }
        Returns: {
          confidence: number
          created_at: string
          full_name: string
          id: string
          image_path: string
          is_pride: boolean
          reason: string
          source: string
          status: string
          user_id: string
        }[]
      }
      admin_list_icebreaker_prompts: {
        Args: never
        Returns: {
          active: boolean
          body: string
          created_at: string
          id: string
          last_used: string
          uses: number
        }[]
      }
      admin_list_points_tx: {
        Args: { _kind?: string; _limit?: number; _user?: string }
        Returns: {
          amount: number
          created_at: string
          full_name: string
          id: string
          kind: string
          reason: string
          user_id: string
        }[]
      }
      admin_list_posts: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          caption: string
          city: string
          comments: number
          created_at: string
          full_name: string
          id: string
          kind: string
          likes: number
          photo_url: string
          reports: number
          user_id: string
        }[]
      }
      admin_list_referrals: {
        Args: { _search?: string }
        Returns: {
          awarded_at: string
          onboarded: boolean
          referred_id: string
          referred_name: string
          referrer_id: string
          referrer_name: string
          signed_up_at: string
        }[]
      }
      admin_list_stories: {
        Args: { _search?: string }
        Returns: {
          author_name: string
          created_at: string
          expires_at: string
          id: string
          media_path: string
          media_type: string
          reports: number
          text_overlay: string
          user_id: string
          views: number
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
      admin_list_verification: {
        Args: { _status?: string }
        Returns: {
          full_name: string
          is_premium: boolean
          photos: string[]
          priority: boolean
          rejection_reason: string
          selfie_path: string
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_points_stats: {
        Args: never
        Returns: {
          issued_this_month: number
          spent_this_month: number
          total_balance: number
        }[]
      }
      admin_referral_leaderboard: {
        Args: { _scope?: string }
        Returns: {
          converted: number
          name: string
          referrals: number
          user_id: string
        }[]
      }
      admin_referral_stats: {
        Args: never
        Returns: {
          converted: number
          referrers: number
          this_month: number
          total: number
        }[]
      }
      admin_resolve_flag: {
        Args: { _action: string; _id: string; _suspend_days?: number }
        Returns: undefined
      }
      admin_revenue_stats: {
        Args: never
        Returns: {
          active_premium: number
          cancelled_this_month: number
          mrr: number
          new_this_month: number
        }[]
      }
      admin_set_rewards_config: {
        Args: {
          _badge_name: string
          _cost_badge: number
          _cost_boost: number
          _cost_trial_days: number
          _referral_points: number
          _trial_days: number
          _welcome_points: number
        }
        Returns: undefined
      }
      admin_set_today_icebreaker: { Args: { _prompt: string }; Returns: string }
      admin_set_verification: {
        Args: { _reason?: string; _status: string; _user: string }
        Returns: undefined
      }
      admin_set_week_challenge: { Args: { _id: string }; Returns: string }
      admin_subscriber_trend: {
        Args: { _days?: number }
        Returns: {
          day: string
          subscribers: number
        }[]
      }
      admin_suspend_user: {
        Args: { _reason: string; _until: string; _user: string }
        Returns: undefined
      }
      admin_top_referrers: {
        Args: { _limit?: number }
        Returns: {
          full_name: string
          points: number
          referrals: number
          user_id: string
        }[]
      }
      admin_upsert_badge_catalog: {
        Args: {
          _active: boolean
          _badge: string
          _description: string
          _icon: string
          _label: string
          _priority: number
        }
        Returns: undefined
      }
      admin_upsert_challenge: {
        Args: {
          _active: boolean
          _badge_name: string
          _description: string
          _goal_target: number
          _goal_type: string
          _id: string
          _reward_amount: number
          _reward_kind: string
          _title: string
        }
        Returns: string
      }
      admin_upsert_icebreaker_prompt: {
        Args: { _active: boolean; _body: string; _id: string }
        Returns: string
      }
      announce_daily_icebreaker: { Args: never; Returns: undefined }
      apply_premium_purchase: {
        Args: {
          _bonus_points: number
          _boosts: number
          _founding: boolean
          _months: number
          _plan: string
          _user: string
        }
        Returns: string
      }
      claim_referral: { Args: { _code: string }; Returns: boolean }
      claim_weekly_challenge: { Args: never; Returns: string }
      cleanup_expired_stories: { Args: never; Returns: undefined }
      close_event_early: {
        Args: { _event_id: string; _reason?: string }
        Returns: undefined
      }
      count_events_created_last_30d: {
        Args: { _user: string }
        Returns: number
      }
      count_events_joined_last_30d: { Args: { _user: string }; Returns: number }
      create_event_checkin: {
        Args: { _event: string; _hours: number; _phone: string }
        Returns: string
      }
      event_is_closed: { Args: { _event: string }; Returns: boolean }
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
      get_event_checkin: {
        Args: { _token: string }
        Returns: {
          area: string
          back_by: string
          starts_at: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          bio: string
          city: string
          created_at: string
          dob: string
          drinking: string
          early_access: boolean
          full_name: string
          gender: string
          height_cm: number
          id: string
          instagram_handle: string
          interests: string[]
          is_verified: boolean
          onboarding_complete: boolean
          photos: string[]
          premium_expires_at: string
          pride_opt_in: boolean
          profession: string
          smoking: string
          spotify_url: string
          subscription_tier: string
          updated_at: string
          x_handle: string
        }[]
      }
      get_my_rewards: {
        Args: never
        Returns: {
          points: number
          referral_code: string
          referral_count: number
          referred_by: string
        }[]
      }
      get_pride_identities: {
        Args: { _pride_ids: string[] }
        Returns: {
          bio: string
          display_name: string
          interests: string[]
          photo_path: string
          pride_id: string
        }[]
      }
      get_today_icebreaker: {
        Args: never
        Returns: {
          answer_count: number
          day: string
          my_post_id: string
          prompt: string
          prompt_id: string
        }[]
      }
      get_weekly_challenge: {
        Args: never
        Returns: {
          badge_name: string
          challenge_id: string
          completed: boolean
          description: string
          goal_target: number
          goal_type: string
          progress: number
          reward_amount: number
          reward_kind: string
          title: string
          week_start: string
        }[]
      }
      join_circle_by_code: { Args: { _code: string }; Returns: string }
      mark_dm_read: { Args: { _thread: string }; Returns: undefined }
      pride_my_cohost_invites: {
        Args: never
        Returns: {
          city: string
          event_id: string
          starts_at: string
          title: string
        }[]
      }
      pride_respond_cohost: {
        Args: { _accept: boolean; _event: string }
        Returns: undefined
      }
      pride_search_identities: {
        Args: { _q: string }
        Returns: {
          display_name: string
          photo_path: string
          pride_id: string
        }[]
      }
      pride_set_cohost: {
        Args: { _event: string; _pride_id: string }
        Returns: undefined
      }
      pride_suspended: { Args: { _user: string }; Returns: boolean }
      redeem_reward: { Args: { _kind: string }; Returns: string }
      respond_event_application: {
        Args: { _application_id: string; _decision: string }
        Returns: {
          answers: Json
          created_at: string
          event_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roll_daily_icebreaker: { Args: never; Returns: string }
      roll_weekly_challenge: { Args: never; Returns: string }
      submit_verification: { Args: { _path: string }; Returns: undefined }
      sweep_empty_events: { Args: never; Returns: undefined }
      use_boost_credit: { Args: { _event?: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
