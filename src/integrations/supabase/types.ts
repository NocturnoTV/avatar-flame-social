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
      badges: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
          id: string
          key: string
          name: string
          position: number
          price_blox: number
          rarity: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji: string
          id?: string
          key: string
          name: string
          position?: number
          price_blox: number
          rarity?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string
          id?: string
          key?: string
          name?: string
          position?: number
          price_blox?: number
          rarity?: string
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          created_at: string
          id: string
          language: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          word?: string
        }
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
      blox_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          kind: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blox_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          handled_at: string | null
          handled_by: string | null
          id: string
          last_activity_at: string
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
          last_activity_at?: string
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
          last_activity_at?: string
          moderator_note?: string | null
          page_url?: string | null
          reporter_id?: string
          severity?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          answered_at: string | null
          callee_id: string
          caller_id: string
          conversation_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          callee_id: string
          caller_id: string
          conversation_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          callee_id?: string
          caller_id?: string
          conversation_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          banner_url: string | null
          category: string
          created_at: string
          description: string | null
          game_name: string | null
          handle: string
          icon_url: string | null
          id: string
          language: string
          member_count: number
          name: string
          owner_id: string
          rules: string | null
          tag: string
          tags: string[]
          verified: boolean
          visibility: string
        }
        Insert: {
          banner_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          game_name?: string | null
          handle: string
          icon_url?: string | null
          id?: string
          language?: string
          member_count?: number
          name: string
          owner_id: string
          rules?: string | null
          tag: string
          tags?: string[]
          verified?: boolean
          visibility?: string
        }
        Update: {
          banner_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          game_name?: string | null
          handle?: string
          icon_url?: string | null
          id?: string
          language?: string
          member_count?: number
          name?: string
          owner_id?: string
          rules?: string | null
          tag?: string
          tags?: string[]
          verified?: boolean
          visibility?: string
        }
        Relationships: []
      }
      community_affiliates: {
        Row: {
          affiliate_id: string
          community_id: string
          created_at: string
        }
        Insert: {
          affiliate_id: string
          community_id: string
          created_at?: string
        }
        Update: {
          affiliate_id?: string
          community_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_affiliates_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_affiliates_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          community_id: string
          created_at: string
          details: string | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          community_id: string
          created_at?: string
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          community_id?: string
          created_at?: string
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_audit_log_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_bans: {
        Row: {
          banned_by: string | null
          community_id: string
          created_at: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          community_id: string
          created_at?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          community_id?: string
          created_at?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_bans_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_channel_categories: {
        Row: {
          community_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_channel_categories_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_channel_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_channel_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "community_channel_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_channel_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_channel_messages: {
        Row: {
          channel_id: string
          community_id: string
          content: string
          created_at: string
          duration_ms: number | null
          id: string
          kind: string
          media_url: string | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          community_id: string
          content: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          media_url?: string | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          community_id?: string
          content?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          media_url?: string | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "community_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_channel_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_channel_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "community_channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      community_channels: {
        Row: {
          category_id: string | null
          community_id: string
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string
          position: number
        }
        Insert: {
          category_id?: string | null
          community_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name: string
          position?: number
        }
        Update: {
          category_id?: string | null
          community_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "community_channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_channels_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
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
      community_events: {
        Row: {
          capacity: number | null
          community_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string | null
          starts_at: string
          tags: string[]
          title: string
        }
        Insert: {
          capacity?: number | null
          community_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url?: string | null
          starts_at: string
          tags?: string[]
          title: string
        }
        Update: {
          capacity?: number | null
          community_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string | null
          starts_at?: string
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_games: {
        Row: {
          community_id: string
          created_at: string
          id: string
          name: string
          position: number
          roblox_universe_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          roblox_universe_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          roblox_universe_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_games_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_lfg_posts: {
        Row: {
          community_id: string
          created_at: string
          id: string
          mic_pref: string
          note: string | null
          players_needed: string
          status: string
          user_id: string
          when_text: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          mic_pref?: string
          note?: string | null
          players_needed?: string
          status?: string
          user_id: string
          when_text?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          mic_pref?: string
          note?: string | null
          players_needed?: string
          status?: string
          user_id?: string
          when_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_lfg_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_media: {
        Row: {
          caption: string | null
          community_id: string
          created_at: string
          id: string
          kind: string
          likes_count: number
          media_url: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          community_id: string
          created_at?: string
          id?: string
          kind?: string
          likes_count?: number
          media_url: string
          user_id: string
        }
        Update: {
          caption?: string | null
          community_id?: string
          created_at?: string
          id?: string
          kind?: string
          likes_count?: number
          media_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_media_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_media_likes: {
        Row: {
          created_at: string
          media_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          media_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          media_id?: string
          user_id?: string
        }
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
      community_member_roles: {
        Row: {
          assigned_at: string
          community_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          community_id: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          community_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_member_roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "community_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
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
      community_post_likes: {
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
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          comments_count: number
          community_id: string
          content: string
          created_at: string
          id: string
          likes_count: number
          pinned: boolean
          user_id: string
        }
        Insert: {
          comments_count?: number
          community_id: string
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          pinned?: boolean
          user_id: string
        }
        Update: {
          comments_count?: number
          community_id?: string
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          pinned?: boolean
          user_id?: string
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
      community_roles: {
        Row: {
          color: string
          community_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          permissions: string[]
          position: number
        }
        Insert: {
          color?: string
          community_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          permissions?: string[]
          position?: number
        }
        Update: {
          color?: string
          community_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          permissions?: string[]
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_roles_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_thread_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          thread_id?: string
          user_id?: string
        }
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
      community_threads: {
        Row: {
          body: string | null
          community_id: string
          created_at: string
          featured: boolean
          id: string
          replies_count: number
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          community_id: string
          created_at?: string
          featured?: boolean
          id?: string
          replies_count?: number
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          community_id?: string
          created_at?: string
          featured?: boolean
          id?: string
          replies_count?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_threads_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_xp_events: {
        Row: {
          amount: number
          community_id: string
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          community_id: string
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          community_id?: string
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_xp_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_nicknames: {
        Row: {
          contact_id: string
          nickname: string
          owner_id: string
          updated_at: string
        }
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
          hidden_at: string | null
          joined_at: string
          last_message_date: string | null
          last_read_at: string
          muted: boolean
          pinned: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string | null
          joined_at?: string
          last_message_date?: string | null
          last_read_at?: string
          muted?: boolean
          pinned?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string | null
          joined_at?: string
          last_message_date?: string | null
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
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
          owner_id: string | null
          request_status: string
          streak_count: number
          streak_date: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          owner_id?: string | null
          request_status?: string
          streak_count?: number
          streak_date?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          owner_id?: string | null
          request_status?: string
          streak_count?: number
          streak_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      device_code_attempts: {
        Row: {
          attempts: number
          ip: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          ip: string
          window_started_at?: string
        }
        Update: {
          attempts?: number
          ip?: string
          window_started_at?: string
        }
        Relationships: []
      }
      device_login_links: {
        Row: {
          created_at: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_login_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_login_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_login_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          event_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          joined_at?: string
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
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          id: string
          kind: string
          location: string | null
          location_type: string
          organizer_name: string | null
          prize: string | null
          starts_at: string
          title: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          id?: string
          kind: string
          location?: string | null
          location_type?: string
          organizer_name?: string | null
          prize?: string | null
          starts_at: string
          title: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          id?: string
          kind?: string
          location?: string | null
          location_type?: string
          organizer_name?: string | null
          prize?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_entries: {
        Row: {
          answer: string
          created_at: string
          id: string
          position: number
          published: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question?: string
          updated_at?: string
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
      feed_post_likes: {
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
            foreignKeyName: "feed_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_reposts: {
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
            foreignKeyName: "feed_post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          replies_count: number
          reposts_count: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          replies_count?: number
          reposts_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          replies_count?: number
          reposts_count?: number
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
      moderation_disputes: {
        Row: {
          created_at: string
          id: string
          message: string
          moderator_id: string | null
          moderator_note: string | null
          reviewed_at: string | null
          sanction_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          moderator_id?: string | null
          moderator_note?: string | null
          reviewed_at?: string | null
          sanction_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          moderator_id?: string | null
          moderator_note?: string | null
          reviewed_at?: string | null
          sanction_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_disputes_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_disputes_sanction_id_fkey"
            columns: ["sanction_id"]
            isOneToOne: false
            referencedRelation: "moderation_sanctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_disputes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_sanctions: {
        Row: {
          action: string
          created_at: string
          id: string
          moderator_id: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_sanctions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      news_article_comments: {
        Row: {
          article_id: string
          content: string
          created_at: string
          id: string
          likes_count: number
          user_id: string
        }
        Insert: {
          article_id: string
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          user_id: string
        }
        Update: {
          article_id?: string
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_article_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_article_likes: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_article_likes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_article_saves: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_article_saves_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          author_id: string | null
          category: string
          comments_count: number
          content: string
          created_at: string
          excerpt: string | null
          featured: boolean
          id: string
          image_url: string | null
          key_points: string[]
          language: string
          likes_count: number
          published_at: string | null
          reading_time_minutes: number
          scheduled_for: string | null
          slug: string
          source: string
          source_url: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string
          comments_count?: number
          content?: string
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          key_points?: string[]
          language?: string
          likes_count?: number
          published_at?: string | null
          reading_time_minutes?: number
          scheduled_for?: string | null
          slug: string
          source?: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string
          comments_count?: number
          content?: string
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          key_points?: string[]
          language?: string
          likes_count?: number
          published_at?: string | null
          reading_time_minutes?: number
          scheduled_for?: string | null
          slug?: string
          source?: string
          source_url?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          comment_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read: boolean
          user_id: string
          video_id: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read?: boolean
          user_id: string
          video_id?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read?: boolean
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
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
      profile_visits: {
        Row: {
          created_at: string
          viewer_id: string
          visited_date: string
          visited_id: string
        }
        Insert: {
          created_at?: string
          viewer_id: string
          visited_date: string
          visited_id: string
        }
        Update: {
          created_at?: string
          viewer_id?: string
          visited_date?: string
          visited_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_visits_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_visits_visited_id_fkey"
            columns: ["visited_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string
          age: number | null
          avatar_url: string | null
          banner_style: string
          banner_url: string | null
          banner_video_url: string | null
          bio: string | null
          blox_balance: number
          country: string | null
          created_at: string
          deletion_requested_at: string | null
          dnd: boolean
          frame_style: string
          id: string
          language: string
          last_active_at: string
          last_ad_reward_at: string | null
          age_visible: boolean
          spoken_languages: string[]
          spark_looking_for: string | null
          spark_voice_pref: string[]
          spark_availability: string[]
          link_url: string | null
          onboarding_completed: boolean
          profile_font: string
          profile_glow: string
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
          timezone: string
          updated_at: string
          username: string | null
          username_changed_at: string | null
          verified: boolean
          verified_at: string | null
          watch_history_enabled: boolean
          welcomed_at: string | null
        }
        Insert: {
          accent_color?: string
          age?: number | null
          avatar_url?: string | null
          banner_style?: string
          banner_url?: string | null
          banner_video_url?: string | null
          bio?: string | null
          blox_balance?: number
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          dnd?: boolean
          frame_style?: string
          id: string
          language?: string
          last_active_at?: string
          last_ad_reward_at?: string | null
          age_visible?: boolean
          spoken_languages?: string[]
          spark_looking_for?: string | null
          spark_voice_pref?: string[]
          spark_availability?: string[]
          link_url?: string | null
          onboarding_completed?: boolean
          profile_font?: string
          profile_glow?: string
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
          theme?: string
          timezone?: string
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          verified?: boolean
          verified_at?: string | null
          watch_history_enabled?: boolean
          welcomed_at?: string | null
        }
        Update: {
          accent_color?: string
          age?: number | null
          avatar_url?: string | null
          banner_style?: string
          banner_url?: string | null
          banner_video_url?: string | null
          bio?: string | null
          blox_balance?: number
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          dnd?: boolean
          frame_style?: string
          id?: string
          language?: string
          last_active_at?: string
          last_ad_reward_at?: string | null
          age_visible?: boolean
          spoken_languages?: string[]
          spark_looking_for?: string | null
          spark_voice_pref?: string[]
          spark_availability?: string[]
          link_url?: string | null
          onboarding_completed?: boolean
          profile_font?: string
          profile_glow?: string
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
          theme?: string
          timezone?: string
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          verified?: boolean
          verified_at?: string | null
          watch_history_enabled?: boolean
          welcomed_at?: string | null
        }
        Relationships: []
      }
      profiles_private: {
        Row: {
          banned_until: string | null
          birth_date: string | null
          created_at: string
          moderation_note: string | null
          moderation_status: string
          notification_prefs: Json
          parent_email: string | null
          parent_name: string | null
          parental_consent: boolean
          privacy_prefs: Json
          updated_at: string
          user_id: string
          warning_count: number
        }
        Insert: {
          banned_until?: string | null
          birth_date?: string | null
          created_at?: string
          moderation_note?: string | null
          moderation_status?: string
          notification_prefs?: Json
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: boolean
          privacy_prefs?: Json
          updated_at?: string
          user_id: string
          warning_count?: number
        }
        Update: {
          banned_until?: string | null
          birth_date?: string | null
          created_at?: string
          moderation_note?: string | null
          moderation_status?: string
          notification_prefs?: Json
          parent_email?: string | null
          parent_name?: string | null
          parental_consent?: boolean
          privacy_prefs?: Json
          updated_at?: string
          user_id?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_private_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stickers: {
        Row: {
          created_at: string
          format: string
          id: string
          position: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          position?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          position?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stickers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device_tokens: {
        Row: {
          created_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          video_id: string | null
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
          video_id?: string | null
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
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
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
      service_incidents: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          started_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          started_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      service_status: {
        Row: {
          id: string
          message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          message?: string | null
          status?: string
          updated_at?: string
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
      status_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          service: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          service: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          service?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "bug_reports"
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
      user_badges: {
        Row: {
          acquired_at: string
          badge_id: string
          equipped: boolean
          user_id: string
        }
        Insert: {
          acquired_at?: string
          badge_id: string
          equipped?: boolean
          user_id: string
        }
        Update: {
          acquired_at?: string
          badge_id?: string
          equipped?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_daily_quest_progress_items: {
        Row: {
          created_at: string
          entity_id: string
          quest_date: string
          quest_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          quest_date: string
          quest_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          quest_date?: string
          quest_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_quest_progress_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_quests: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          quest_date: string
          quest_key: string
          reward_blox: number
          target: number
          user_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          quest_date: string
          quest_key: string
          reward_blox: number
          target: number
          user_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          quest_date?: string
          quest_key?: string
          reward_blox?: number
          target?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quest_streaks: {
        Row: {
          current_streak: number
          last_completed_date: string | null
          longest_streak: number
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_completed_date?: string | null
          longest_streak?: number
          user_id: string
        }
        Update: {
          current_streak?: number
          last_completed_date?: string | null
          longest_streak?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quest_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      video_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          reaction: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          reaction: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          reaction?: string
          user_id?: string
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
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          video_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          video_id?: string
          viewer_id?: string
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
          boosted_until: string | null
          caption: string | null
          comments_count: number
          created_at: string
          duration_seconds: number | null
          favorites_count: number
          hashtags: string[]
          id: string
          likes_count: number
          moderation_status: string
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
          boosted_until?: string | null
          caption?: string | null
          comments_count?: number
          created_at?: string
          duration_seconds?: number | null
          favorites_count?: number
          hashtags?: string[]
          id?: string
          likes_count?: number
          moderation_status?: string
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
          boosted_until?: string | null
          caption?: string | null
          comments_count?: number
          created_at?: string
          duration_seconds?: number | null
          favorites_count?: number
          hashtags?: string[]
          id?: string
          likes_count?: number
          moderation_status?: string
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
      watch_history: {
        Row: {
          user_id: string
          video_id: string
          watched_at: string
        }
        Insert: {
          user_id: string
          video_id: string
          watched_at?: string
        }
        Update: {
          user_id?: string
          video_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_history_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_community_xp: {
        Args: {
          _amount: number
          _community: string
          _reason: string
          _user: string
        }
        Returns: undefined
      }
      boost_video: {
        Args: { _blox_cost: number; _hours: number; _video: string }
        Returns: undefined
      }
      bump_quest_progress: {
        Args: { _entity_id: string; _metric_key: string }
        Returns: undefined
      }
      bump_quest_progress_for: {
        Args: { _entity_id: string; _metric_key: string; _user: string }
        Returns: undefined
      }
      can_read_community_object: { Args: { _name: string }; Returns: boolean }
      can_read_voice_object: { Args: { _name: string }; Returns: boolean }
      can_view_community: { Args: { _community: string }; Returns: boolean }
      claim_ad_reward: { Args: never; Returns: number }
      claim_daily_quest: { Args: { _quest_id: string }; Returns: undefined }
      community_add_affiliate: {
        Args: { _affiliate: string; _community: string }
        Returns: undefined
      }
      community_add_game: {
        Args: {
          _community: string
          _name: string
          _thumbnail: string
          _universe_id: string
        }
        Returns: string
      }
      community_affiliate_limit: {
        Args: { _community: string }
        Returns: number
      }
      community_assign_role: {
        Args: { _community: string; _role: string; _target: string }
        Returns: undefined
      }
      community_ban_member: {
        Args: { _community: string; _reason: string; _target: string }
        Returns: undefined
      }
      community_create_category: {
        Args: { _community: string; _name: string }
        Returns: string
      }
      community_create_channel:
        | {
            Args: { _category: string; _community: string; _name: string }
            Returns: string
          }
        | {
            Args: {
              _category: string
              _community: string
              _kind?: string
              _name: string
            }
            Returns: string
          }
      community_create_role: {
        Args: {
          _color: string
          _community: string
          _name: string
          _permissions: string[]
        }
        Returns: string
      }
      community_delete_category: {
        Args: { _category: string }
        Returns: undefined
      }
      community_delete_channel: {
        Args: { _channel: string }
        Returns: undefined
      }
      community_delete_role: { Args: { _role: string }; Returns: undefined }
      community_directory_rankings: {
        Args: never
        Returns: {
          activity_points: number
          community_id: string
          member_count: number
          rank_position: number
          ranking_score: number
        }[]
      }
      community_has_permission: {
        Args: { _community: string; _perm: string; _user: string }
        Returns: boolean
      }
      community_kick_member: {
        Args: { _community: string; _target: string }
        Returns: undefined
      }
      community_move_channel: {
        Args: { _category: string; _channel: string; _position: number }
        Returns: undefined
      }
      community_remove_affiliate: {
        Args: { _affiliate: string; _community: string }
        Returns: undefined
      }
      community_remove_game: { Args: { _game: string }; Returns: undefined }
      community_rename_channel: {
        Args: { _channel: string; _name: string }
        Returns: undefined
      }
      community_role_limit: { Args: { _community: string }; Returns: number }
      community_transfer_ownership: {
        Args: { _community: string; _new_owner: string }
        Returns: undefined
      }
      community_unassign_role: {
        Args: { _community: string; _role: string; _target: string }
        Returns: undefined
      }
      community_unban_member: {
        Args: { _community: string; _target: string }
        Returns: undefined
      }
      community_update_role: {
        Args: {
          _color: string
          _name: string
          _permissions: string[]
          _role: string
        }
        Returns: undefined
      }
      create_group: {
        Args: { _members: string[]; _name: string }
        Returns: string
      }
      ensure_daily_quests: { Args: never; Returns: undefined }
      ensure_daily_quests_for: {
        Args: { _today: string; _user: string }
        Returns: undefined
      }
      flag_message_for_safety: {
        Args: { _content: string; _conversation: string; _sender: string }
        Returns: undefined
      }
      gift_blox: {
        Args: { _amount: number; _message?: string; _to_user: string }
        Returns: undefined
      }
      gift_video_creator: {
        Args: { _amount: number; _video: string }
        Returns: string
      }
      guest_profiles: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          bio: string
          id: string
          language: string
          roblox_avatar_url: string
          roblox_display_name: string
          roblox_username: string
          username: string
          verified: boolean
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
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
      log_community_action: {
        Args: {
          _action: string
          _actor: string
          _community: string
          _details: string
          _target: string
        }
        Returns: undefined
      }
      mark_conversation_read: {
        Args: { _conversation: string }
        Returns: undefined
      }
      perform_swipe: {
        Args: {
          _action: Database["public"]["Enums"]["swipe_action"]
          _target: string
        }
        Returns: Json
      }
      purchase_badge: { Args: { _badge: string }; Returns: undefined }
      recommendation_analytics_summary: {
        Args: { _since?: string }
        Returns: {
          avg_watch_ratio: number
          comment_rate: number
          completion_rate: number
          like_rate: number
          report_rate: number
          share_rate: number
          skip_rate: number
          watch_events: number
        }[]
      }
      rename_group: {
        Args: { _conversation: string; _name: string }
        Returns: undefined
      }
      send_welcome_notification: { Args: { _user: string }; Returns: undefined }
      set_group_avatar: {
        Args: { _avatar_url: string; _conversation: string }
        Returns: undefined
      }
      set_group_owner: {
        Args: { _conversation: string; _new_owner: string }
        Returns: undefined
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
          age: number | null
          avatar_url: string | null
          banner_style: string
          banner_url: string | null
          banner_video_url: string | null
          bio: string | null
          blox_balance: number
          country: string | null
          created_at: string
          deletion_requested_at: string | null
          dnd: boolean
          frame_style: string
          id: string
          language: string
          last_active_at: string
          last_ad_reward_at: string | null
          age_visible: boolean
          spoken_languages: string[]
          spark_looking_for: string | null
          spark_voice_pref: string[]
          spark_availability: string[]
          link_url: string | null
          onboarding_completed: boolean
          profile_font: string
          profile_glow: string
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
          timezone: string
          updated_at: string
          username: string | null
          username_changed_at: string | null
          verified: boolean
          verified_at: string | null
          watch_history_enabled: boolean
          welcomed_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      start_direct_message: { Args: { _target: string }; Returns: string }
      status_report_series: {
        Args: never
        Returns: {
          bucket: string
          report_count: number
        }[]
      }
      toggle_badge_equipped: {
        Args: { _badge: string; _equipped: boolean }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      message_kind: "text" | "image" | "voice" | "system" | "gift" | "sticker"
      notification_kind:
        | "match"
        | "message"
        | "like"
        | "super"
        | "system"
        | "video_like"
        | "video_comment"
        | "video_favorite"
        | "video_repost"
        | "video_comment_reply"
        | "video_mention"
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
      message_kind: ["text", "image", "voice", "system", "gift", "sticker"],
      notification_kind: [
        "match",
        "message",
        "like",
        "super",
        "system",
        "video_like",
        "video_comment",
        "video_favorite",
        "video_repost",
        "video_comment_reply",
        "video_mention",
      ],
      swipe_action: ["like", "pass", "super"],
    },
  },
} as const
