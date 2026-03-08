/**
 * Generated types for Supabase database
 * This file should be generated using Supabase CLI: supabase gen types typescript --project-id <project-id>
 *
 * For now, we'll define a basic structure that matches our schema
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          created_at: string;
          title: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
        };
      };
      systemData: {
        Row: {
          id: string;
          created_at: string;
          grosirInvoiceNo: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          grosirInvoiceNo?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          grosirInvoiceNo?: number;
        };
      };
      barangs: {
        Row: {
          id: string;
          createdAt: string;
          createdBy: string;
          barangNama: string;
          barangType: string;
          barangUnit: string;
          barangHarga: number;
          barangModal: number;
          barangGrosir: number;
          barangBon: number;
          barangNote: string | null;
          stockBarang: number;
          stockTokoMini: number;
        };
        Insert: {
          id?: string;
          createdAt?: string;
          createdBy?: string;
          barangNama: string;
          barangType?: string;
          barangUnit?: string;
          barangHarga?: number;
          barangModal?: number;
          barangGrosir?: number;
          barangBon?: number;
          barangNote?: string | null;
          stockBarang?: number;
          stockTokoMini?: number;
        };
        Update: {
          id?: string;
          createdAt?: string;
          createdBy?: string;
          barangNama?: string;
          barangType?: string;
          barangUnit?: string;
          barangHarga?: number;
          barangModal?: number;
          barangGrosir?: number;
          barangBon?: number;
          barangNote?: string | null;
          stockBarang?: number;
          stockTokoMini?: number;
        };
      };
      jualanKontan: {
        Row: {
          id: string;
          created_at: string;
          created_atIndo: string;
          totalBelanja: number;
          namaKasir: string;
          caraPembayaran: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          created_atIndo?: string;
          totalBelanja: number;
          namaKasir: string;
          caraPembayaran: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          created_atIndo?: string;
          totalBelanja?: number;
          namaKasir?: string;
          caraPembayaran?: string;
        };
      };
      jualanGrosir: {
        Row: {
          id: string;
          created_at: string;
          created_atIndo: string;
          invoiceNo: number;
          namaPelanggan: string;
          totalBelanja: number;
          setorGrosir: number;
          sisaBonGrosir: number;
          namaKasir: string;
          caraPembayaran: string;
          paymentHistory: any; // jsonb
          payment_status?: string; // unpaid | partially_paid | paid
          percent_paid?: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          created_atIndo?: string;
          invoiceNo?: number;
          namaPelanggan?: string;
          totalBelanja?: number;
          setorGrosir?: number;
          sisaBonGrosir?: number;
          namaKasir?: string;
          caraPembayaran?: string;
          paymentHistory?: any; // jsonb
          payment_status?: string;
          percent_paid?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          created_atIndo?: string;
          invoiceNo?: number;
          namaPelanggan?: string;
          totalBelanja?: number;
          setorGrosir?: number;
          sisaBonGrosir?: number;
          namaKasir?: string;
          caraPembayaran?: string;
          paymentHistory?: any; // jsonb
          payment_status?: string;
          percent_paid?: number;
        };
      };
      grosirPayments: {
        Row: {
          id: string;
          created_at: string;
          jualanGrosirId: string;
          amount: number;
          paymentMethod: string;
          createdBy: string;
          userId: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          jualanGrosirId: string;
          amount: number;
          paymentMethod?: string;
          createdBy: string;
          userId?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          jualanGrosirId?: string;
          amount?: number;
          paymentMethod?: string;
          createdBy?: string;
          userId?: string | null;
        };
      };
      jualanItems: {
        Row: {
          id: string;
          created_at: string;
          jualanKontanId: string | null;
          jualanGrosirId: string | null;
          barangId: string;
          barangNama: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          barangUnit: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          jualanKontanId?: string | null;
          jualanGrosirId?: string | null;
          barangId: string;
          barangNama: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          barangUnit: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          jualanKontanId?: string | null;
          jualanGrosirId?: string | null;
          barangId?: string;
          barangNama?: string;
          quantity?: number;
          unitPrice?: number;
          totalPrice?: number;
          barangUnit?: string;
        };
      };
      shop_expenses: {
        Row: {
          id: string;
          created_at: string;
          expense_date: string;
          category: string;
          description: string | null;
          amount: number;
          created_by: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          expense_date: string;
          category: string;
          description?: string | null;
          amount: number;
          created_by?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          expense_date?: string;
          category?: string;
          description?: string | null;
          amount?: number;
          created_by?: string | null;
          notes?: string | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          table_number: number;
          started_at: string;
          duration_hours: number;
          rate_per_hour: number;
          status: string;
          paid_at: string | null;
          payment_method: string | null;
          cashier_id: string;
        };
        Insert: {
          id?: string;
          table_number: number;
          started_at?: string;
          duration_hours: number;
          rate_per_hour: number;
          status?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          cashier_id: string;
        };
        Update: {
          id?: string;
          table_number?: number;
          started_at?: string;
          duration_hours?: number;
          rate_per_hour?: number;
          status?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          cashier_id?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
