export interface UserDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  ticketBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketLog {
  amount: number;
  reason: 'signup_bonus' | 'purchase' | 'design_creation' | 'admin_grant' | 'generation_fee';
  description?: string;
  designId?: string;
  createdAt: Date;
}
