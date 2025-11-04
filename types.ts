export interface Block {
    id: number;
    invoice_no: string;
    invoice_date: string;
    party_name: string;
    inward_date: string;
    royalty_rate_per_ton: number;
    transport_rate_per_ton: number;
    block_rate_per_ton: number;
    block_no: string;
    block_mines_no: string;
    color_name: string;
    length_cm: number;
    height_cm: number;
    width_cm: number;
    cubic_m: number;
    weight_ton: number;
    royalty_amount: number;
    transport_amount: number;
    block_total_amount: number;
    status: 'Pending' | 'Partial' | 'OK' | 'Split';
}

export interface CuttingEntry {
    id: number;
    block_id: number;
    block_no: string;
    cutter_name: string;
    block_issue_date: string;
    cutting_date: string;
    cut_length_ft: number;
    cut_height_ft: number;
    pcs: number;
    thickness_mm: number;
    sqft_per_entry: number;
}

export interface PolishEntry {
    id: number;
    block_no: string;
    polish_date: string;
    pcs: number;
    polish_length_ft: number;
    polish_height_ft: number;
    sqft: number;
    status: 'Polished' | 'Rejected';
}

export interface SalesItem {
    block_no: string;
    color_name: string;
    length_ft: number;
    height_ft: number;
    thickness_mm: number;
    pcs: number;
    sqft: number;
    rate: number;
    gst_amount: number;
    amount: number;
}

export interface SalesInvoice {
    id: number;
    invoice_no: string;
    invoice_date: string;
    party_name: string;
    items: SalesItem[];
    total_pcs: number;
    total_sqft: number;
    total_amount: number;
    vehicle_no?: string;
    sale_type: 'Cash' | 'Credit';
    received_amount: number;
}

export interface BridgeCutterEntry {
    id: number;
    block_no: string;
    color_name: string;
    bridge_cutter_date: string;
    slabs_used: number;
    tile_length_mm: number;
    tile_height_mm: number;
    tile_thickness_mm: number;
    pcs: number;
    total_sqft: number;
}

export interface CompanySpecificData {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    salesHistory: SalesInvoice[];
    bridgeCutterHistory: BridgeCutterEntry[];
}

export interface ERPData {
    companies: string[];
    activeCompany: string | null;
    companyData: {
        [companyName: string]: CompanySpecificData;
    };
}


// Report Item Types
export interface BlockInwardReportItem {
  inward_date: string;
  block_no: string;
  color_name: string;
  party_name: string;
  dimensions_cm: string;
  cubic_m: number;
  weight_ton: number;
}

export interface RejectStockItem {
  date: string;
  block_no: string;
  color_name: string;
  dimensions_ft: string;
  thickness_mm: number;
  rejected_pcs: number;
  rejected_sqft: number;
}

export interface WastageReportItem {
  polish_date: string;
  block_no: string;
  color_name: string;
  cutter_sqft: number;
  polished_sqft: number;
  wastage_sqft: number;
  wastage_percentage: string;
}

export interface CuttingReportItem {
    date: string;
    block_cubic_meter: number;
    block_no: string;
    color_name: string;
    thickness_mm: number;
    length_ft: number;
    height_ft: number;
    pieces: number;
    sqft: number;
}

export interface PolishReportItem {
    polish_date: string;
    cutting_date: string;
    block_no: string;
    color_name: string;
    dimensions_ft: string;
    thickness_mm: number;
    pcs: number;
    sqft: number;
}

export interface BridgeCutterReportItem {
    date: string;
    block_no: string;
    color_name: string;
    slabs_used: number;
    tile_dims_mm: string;
    thickness_mm: number;
    pcs: number;
    sqft: number;
}

export interface DebtorsReportItem {
    invoice_id: number;
    invoice_date: string;
    invoice_no: string;
    party_name: string;
    total_amount: number;
    received_amount: number;
    net_amount: number;
}

export interface SalesReportItem {
    invoice_date: string;
    invoice_no: string;
    party_name: string;
    sale_type: 'Cash' | 'Credit';
    total_sqft: number;
    total_gst: number;
    total_amount: number;
}

// Keep this for constants compatibility
export interface StockItem {
    id: number;
    name: string;
    quantity: number;
    type: 'Block' | 'Rough' | 'Polished';
}
