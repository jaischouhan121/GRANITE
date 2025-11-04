import { Block, CuttingEntry, StockItem, PolishEntry, SalesInvoice, BridgeCutterEntry, CompanySpecificData } from './types';

export const MOCK_BLOCKS: Block[] = [];

export const MOCK_CUTTING_HISTORY: CuttingEntry[] = [];

export const MOCK_STOCK_DATA: StockItem[] = [];

export const MOCK_POLISH_HISTORY: PolishEntry[] = [];

export const MOCK_SALES_HISTORY: SalesInvoice[] = [];

export const MOCK_BRIDGE_CUTTER_HISTORY: BridgeCutterEntry[] = [];

export const EMPTY_COMPANY_DATA: CompanySpecificData = {
    blocks: [],
    cuttingHistory: [],
    polishHistory: [],
    salesHistory: [],
    bridgeCutterHistory: [],
};
