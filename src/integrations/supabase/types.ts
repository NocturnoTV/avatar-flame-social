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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: string | null
          id: string
          target_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      banned_words: {
        Row: { id: string; word: string; language: string; created_at: string }
        Insert: { id?: string; word: string; language?: string; created_at?: string }
        Update: { id?: string; word?: string; language?: string; created_at?: string }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          handled_at: string | null
          handled_by: string | null
          id: string
          moderator_note: string | null
          page_url: string | null
          reporter_id: string
          severity: string
          status: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          moderator_note?: string | null
          page_url?: string | null
          reporter_id: string
          severity?: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          moderator_note?: string | null
          page_url?: string | null
          reporter_id?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      faq_entries: {
        Row: {
          id: string
          question: string
          answer: string
          position: number
          published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question: string
          answer: string
          position?: number
          published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question?: string
          answer?: string
          position?: number
          published?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_status: {
        Row: { id: string; status: string; message: string | null; updated_at: string }
        Insert: { id?: string; status?: string; message?: string | null; updated_at?: string }
        Update: { id?: string; status?: string; message?: string | null; updated_at?: string }
        Relationships: []
      }
      service_incidents: {
        Row: {
          id: string
          title: string
          status: string
          started_at: string
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          status?: string
          started_at?: string
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          status?: string
          started_at?: string
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          id: string
          handle: string
          name: string
          description: string | null
          category: string
          language: string
          game_name: string | null
          visibility: string
          banner_url: string | null
          icon_url: string | null
          tags: string[]
          rules: string | null
          verified: boolean
          owner_id: string
          member_count: number
          created_at: string
        }
        Insert: {
          id?: string
          handle: string
          name: string
          description?: string | null
          category?: string
          language?: string
          game_name?: string | null
          visibility?: string
          banner_url?: string | null
          icon_url?: string | null
          tags?: string[]
          rules?: string | null
          verified?: boolean
          owner_id: string
          member_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          handle?: string
          name?: string
          description?: string | null
          category?: string
          language?: string
          game_name?: string | null
          visibility?: string
          banner_url?: string | null
          icon_url?: string | null
          tags?: string[]
          rules?: string | null
          verified?: boolean
          owner_id?: string
          member_count?: number
          created_at?: string
        }
        Relationships: []
      }
      community_threads: {
        Row: {
          id: string
          community_id: string
          user_id: string
          title: string
          body: string | null
          featured: boolean
          replies_count: number
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          title: string
          body?: string | null
          featured?: boolean
          replies_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          title?: string
          body?: string | null
          featured?: boolean
          replies_count?: number
          created_at?: string
        }
        Relationships: []
      }
      community_thread_replies: {
        Row: { id: string; thread_id: string; user_id: string; content: string; created_at: string }
        Insert: { id?: string; thread_id: string; user_id: string; content: string; created_at?: string }
        Update: { id?: string; thread_id?: string; user_id?: string; content?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "community_thread_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "community_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      community_lfg_posts: {
        Row: {
          id: string
          community_id: string
          user_id: string
          players_needed: string
          when_text: string
          mic_pref: string
          note: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          players_needed?: string
          when_text?: string
          mic_pref?: string
          note?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          players_needed?: string
          when_text?: string
          mic_pref?: string
          note?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      community_events: {
        Row: {
          id: string
          community_id: string
          created_by: string
          title: string
          description: string | null
          image_url: string | null
          starts_at: string
          capacity: number | null
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          created_by: string
          title: string
          description?: string | null
          image_url?: string | null
          starts_at: string
          capacity?: number | null
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          created_by?: string
          title?: string
          description?: string | null
          image_url?: string | null
          starts_at?: string
          capacity?: number | null
          tags?: string[]
          created_at?: string
        }
        Relationships: []
      }
      community_event_rsvps: {
        Row: { event_id: string; user_id: string; created_at: string }
        Insert: { event_id: string; user_id: string; created_at?: string }
        Update: { event_id?: string; user_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "community_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "community_events"
            referencedColumns: ["id"]
          },
        ]
      }
      community_media: {
        Row: {
          id: string
          community_id: string
          user_id: string
          kind: string
          media_url: string
          caption: string | null
          likes_count: number
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          kind?: string
          media_url: string
          caption?: string | null
          likes_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          kind?: string
          media_url?: string
          caption?: string | null
          likes_count?: number
          created_at?: string
        }
        Relationships: []
      }
      community_media_likes: {
        Row: { media_id: string; user_id: string; created_at: string }
        Insert: { media_id: string; user_id: string; created_at?: string }
        Update: { media_id?: string; user_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "community_media_likes_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "community_media"
            referencedColumns: ["id"]
          },
        ]
      }
      community_xp_events: {
        Row: {
          id: string
          community_id: string
          user_id: string
          amount: number
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          amount: number
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          amount?: number
          reason?: string
          created_at?: string
        }
        Relationships: []
      }
      community_members: {
        Row: { community_id: string; user_id: string; role: string; joined_at: string }
        Insert: { community_id: string; user_id: string; role?: string; joined_at?: string }
        Update: { community_id?: string; user_id?: string; role?: string; joined_at?: string }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          id: string
          community_id: string
          user_id: string
          content: string
          pinned: boolean
          likes_count: number
          comments_count: number
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          content: string
          pinned?: boolean
          likes_count?: number
          comments_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          content?: string
          pinned?: boolean
          likes_count?: number
          comments_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: { post_id: string; user_id: string; created_at: string }
        Insert: { post_id: string; user_id: string; created_at?: string }
        Update: { post_id?: string; user_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_nicknames: {
        Row: { contact_id: string; nickname: string; owner_id: string; updated_at: string }
        Insert: {
          contact_id: string
          nickname: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          nickname?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          pinned: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          pinned?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          pinned?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
          request_status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          request_status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          request_status?: string
        }
        Relationships: []
      }
      data_requests: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_games: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          roblox_universe_id: string | null
          thumbnail_url: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          roblox_universe_id?: string | null
          thumbnail_url?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          roblox_universe_id?: string | null
          thumbnail_url?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      hidden_categories: {
        Row: {
          category: string
          created_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_creators: {
        Row: {
          created_at: string
          creator_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          duration_ms: number | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          media_url: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          media_url?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          media_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          position: number
          published: boolean
          subtitle: string | null
          title: string
          tone: string
          updated_at: string
          url: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          subtitle?: string | null
          title: string
          tone?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          subtitle?: string | null
          title?: string
          tone?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read: boolean
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read?: boolean
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_color: string
          avatar_url: string | null
          banner_style: string
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          country: string | null
          created_at: string
          deletion_requested_at: string | null
          dnd: boolean
          frame_style: string
          id: string
          language: string
          last_active_at: string
          link_url: string | null
          notification_prefs: Json
          onboarding_completed: boolean
          parent_email: string | null
          parent_name: string | null
          parental_consent: boolean
          privacy_prefs: Json
          roblox_avatar_url: string | null
          roblox_connected_at: string | null
          roblox_display_name: string | null
          roblox_synced_at: string | null
          roblox_user_id: string | null
          roblox_username: string | null
          show_online_status: boolean
          spark_badges: string[]
          spark_plus_active: boolean
          spark_plus_expires_at: string | null
          sparks_enabled: boolean
          sticker: string | null
          profile_font: string
          profile_glow: string
          theme: string
          updated_at: string
          username: string | null
          username_changed_at: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          accent_color?: string
          avatar_url?: string | null
          banner_style?: string
          banner_url?: string | null
          bio?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          dnd?: boolean
          frame_style?: string
          id: string
          language?: string
          last_active_at?: string
          link_url?: string | null
          notification_prefs?: Json
          onboarding_completed?: boolean
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: boolean
          privacy_prefs?: Json
          roblox_avatar_url?: string | null
          roblox_connected_at?: string | null
          roblox_display_name?: string | null
          roblox_synced_at?: string | null
          roblox_user_id?: string | null
          roblox_username?: string | null
          show_online_status?: boolean
          spark_badges?: string[]
          spark_plus_active?: boolean
          spark_plus_expires_at?: string | null
          sparks_enabled?: boolean
          sticker?: string | null
          profile_font?: string
          profile_glow?: string
          theme?: string
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          accent_color?: string
          avatar_url?: string | null
          banner_style?: string
          banner_url?: string | null
          bio?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          dnd?: boolean
          frame_style?: string
          id?: string
          language?: string
          last_active_at?: string
          link_url?: string | null
          notification_prefs?: Json
          onboarding_completed?: boolean
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: boolean
          privacy_prefs?: Json
          roblox_avatar_url?: string | null
          roblox_connected_at?: string | null
          roblox_display_name?: string | null
          roblox_synced_at?: string | null
          roblox_user_id?: string | null
          roblox_username?: string | null
          show_online_status?: boolean
          spark_badges?: string[]
          spark_plus_active?: boolean
          spark_plus_expires_at?: string | null
          sparks_enabled?: boolean
          sticker?: string | null
          profile_font?: string
          profile_glow?: string
          theme?: string
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      recommendation_config: {
        Row: {
          decay: Json
          exploration_ratio: number
          id: string
          updated_at: string
          weights: Json
        }
        Insert: {
          decay?: Json
          exploration_ratio?: number
          id: string
          updated_at?: string
          weights?: Json
        }
        Update: {
          decay?: Json
          exploration_ratio?: number
          id?: string
          updated_at?: string
          weights?: Json
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          message_id: string | null
          moderator_note: string | null
          reason: string
          reporter_id: string
          status: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message_id?: string | null
          moderator_note?: string | null
          reason: string
          reporter_id: string
          status?: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message_id?: string | null
          moderator_note?: string | null
          reason?: string
          reporter_id?: string
          status?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      roblox_games: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          roblox_universe_id: string | null
          source: string
          synced_at: string | null
          thumbnail_url: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          roblox_universe_id?: string | null
          source?: string
          synced_at?: string | null
          thumbnail_url?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          roblox_universe_id?: string | null
          source?: string
          synced_at?: string | null
          thumbnail_url?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      roblox_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
          return_to: string
          state: string
          user_id: string
          verifier: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          nonce: string
          return_to?: string
          state: string
          user_id: string
          verifier: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
          return_to?: string
          state?: string
          user_id?: string
          verifier?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: []
      }
      spark_plus_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
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
      swipes: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at: string
          id: string
          swiper_id: string
          target_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          swiper_id: string
          target_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          swiper_id?: string
          target_id?: string
        }
        Relationships: []
      }
      user_creator_affinity: {
        Row: {
          affinity: number
          creator_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affinity?: number
          creator_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affinity?: number
          creator_id?: string
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
      user_topic_affinity: {
        Row: {
          affinity: number
          category: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affinity?: number
          category: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affinity?: number
          category?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_categories: {
        Row: {
          category: string
          created_at: string
          video_id: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          video_id: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          video_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_categories_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          parent_id: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          parent_id?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          parent_id?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_comment_reactions: {
        Row: {
          comment_id: string
          user_id: string
          reaction: string
          created_at: string
        }
        Insert: {
          comment_id: string
          user_id: string
          reaction: string
          created_at?: string
        }
        Update: {
          comment_id?: string
          user_id?: string
          reaction?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      video_favorites: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_favorites_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_not_interested: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_not_interested_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_reposts: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_reposts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          created_at: string
          id: string
          video_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          video_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          video_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_watch_events: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          replayed: boolean
          skipped: boolean
          time_before_skip_ms: number | null
          user_id: string
          video_id: string
          watch_ms: number
          watch_ratio: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          replayed?: boolean
          skipped?: boolean
          time_before_skip_ms?: number | null
          user_id: string
          video_id: string
          watch_ms?: number
          watch_ratio?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          replayed?: boolean
          skipped?: boolean
          time_before_skip_ms?: number | null
          user_id?: string
          video_id?: string
          watch_ms?: number
          watch_ratio?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_events_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          caption: string | null
          comments_count: number
          created_at: string
          duration_seconds: number | null
          favorites_count: number
          hashtags: string[]
          id: string
          likes_count: number
          recommendation_eligible: boolean
          reposts_count: number
          shares_count: number
          sound_name: string | null
          storage_path: string
          thumbnail_path: string | null
          updated_at: string
          user_id: string
          views_count: number
          visibility: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          duration_seconds?: number | null
          favorites_count?: number
          hashtags?: string[]
          id?: string
          likes_count?: number
          recommendation_eligible?: boolean
          reposts_count?: number
          shares_count?: number
          sound_name?: string | null
          storage_path: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id: string
          views_count?: number
          visibility?: string
        }
        Update: {
          caption?: string | null
          comments_count?: number
          created_at?: string
          duration_seconds?: number | null
          favorites_count?: number
          hashtags?: string[]
          id?: string
          likes_count?: number
          recommendation_eligible?: boolean
          reposts_count?: number
          shares_count?: number
          sound_name?: string | null
          storage_path?: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number
          visibility?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: {
        Args: { _members: string[]; _name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_member: {
        Args: { _conversation: string; _user: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      perform_swipe: {
        Args: {
          _action: Database["public"]["Enums"]["swipe_action"]
          _target: string
        }
        Returns: Json
      }
      spark_deck: {
        Args: {
          _lang?: string
          _limit?: number
          _max_age?: number
          _min_age?: number
        }
        Returns: {
          accent_color: string
          avatar_url: string | null
          banner_style: string
          banner_url: string | null
          bio: string | null
          birth_date: string | null
          country: string | null
          created_at: string
          deletion_requested_at: string | null
          dnd: boolean
          frame_style: string
          id: string
          language: string
          last_active_at: string
          link_url: string | null
          notification_prefs: Json
          onboarding_completed: boolean
          parent_email: string | null
          parent_name: string | null
          parental_consent: boolean
          privacy_prefs: Json
          roblox_avatar_url: string | null
          roblox_connected_at: string | null
          roblox_display_name: string | null
          roblox_synced_at: string | null
          roblox_user_id: string | null
          roblox_username: string | null
          show_online_status: boolean
          spark_badges: string[]
          spark_plus_active: boolean
          spark_plus_expires_at: string | null
          sparks_enabled: boolean
          sticker: string | null
          theme: string
          updated_at: string
          username: string | null
          username_changed_at: string | null
          verified: boolean
          verified_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      start_direct_message: {
        Args: { _target: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      message_kind: "text" | "image" | "voice" | "system"
      notification_kind: "match" | "message" | "like" | "super" | "system"
      swipe_action: "like" | "pass" | "super"
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
      app_role: ["admin", "moderator", "user"],
      message_kind: ["text", "image", "voice", "system"],
      notification_kind: ["match", "message", "like", "super", "system"],
      swipe_action: ["like", "pass", "super"],
    },
  },
} as const
