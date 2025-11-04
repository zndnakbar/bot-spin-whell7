export type Slice = {
  id: string;
  label: string;
  type: 'voucher'|'cashback'|'points'|'ticket'|'mystery'|'none'|'none_soft';
  weight: number;
  daily_cap: number|null;
  max_per_user_per_day?: number|null;
  metadata_json?: string|null;
  style_json?: string|null;
  position_index?: number;
};
