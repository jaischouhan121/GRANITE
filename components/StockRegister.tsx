
import React, { useState, useMemo, useEffect } from 'react';
import { Block, CuttingEntry, PolishEntry, SalesInvoice, BridgeCutterEntry } from '../types';

// CSV Export Utility
const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
        alert("No data to export.");
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.map(h => `"${h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}"`).join(','), // header row
        ...data.map(row =>
            headers.map(fieldName => {
                let cell = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];
                cell = String(cell);
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        )
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


type StockType = 'Block' | 'Rough' | 'Polish' | 'Tiles';

interface StockRegisterProps {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    salesHistory: SalesInvoice[];
    bridgeCutterHistory: BridgeCutterEntry[];
}

interface RoughStockItem {
    block_no: string;
    color_name: string;
    cut_length_ft: number;
    cut_height_ft: number;
    thickness_mm: number;
    pcs: number;
    sqft: number;
    location: string;
}

interface PolishedStockItem {
    id: number;
    block_no: string;
    polish_date: string;
    cutting_date: string;
    polish_length_ft: number;
    polish_height_ft: number;
    pcs: number;
    sqft: number;
    color_name: string;
    thickness_mm: number;
    cubic_m: number;
}

interface TilesStockItem {
    block_no: string;
    color_name: string;
    tile_length_mm: number;
    tile_height_mm: number;
    tile_thickness_mm: number;
    pcs: number;
    total_sqft: number;
}


const StockRegister: React.FC<StockRegisterProps> = ({ blocks, cuttingHistory, polishHistory, salesHistory, bridgeCutterHistory }) => {
    const [activeFilter, setActiveFilter] = useState<StockType>('Block');
    const [selectedColor, setSelectedColor] = useState<string | null>(null);

    useEffect(() => {
        setSelectedColor(null);
    }, [activeFilter]);

    const blockStock = useMemo(() => blocks.filter(b => b.status === 'Pending'), [blocks]);

    const roughStock = useMemo(() => {
        const blockMap = new Map<number, { color_name: string }>();
        blocks.forEach(b => blockMap.set(b.id, { color_name: b.color_name }));

        const cutSummary = cuttingHistory.reduce((acc, cut) => {
            if (!acc[cut.block_no]) {
                const blockDetails = blockMap.get(cut.block_id);
                acc[cut.block_no] = {
                    total_pcs: 0,
                    cut_length_ft: cut.cut_length_ft,
                    cut_height_ft: cut.cut_height_ft,
                    thickness_mm: cut.thickness_mm,
                    color_name: blockDetails?.color_name || 'N/A',
                };
            }
            acc[cut.block_no].total_pcs += cut.pcs;
            return acc;
        }, {} as { [block_no: string]: { total_pcs: number; cut_length_ft: number; cut_height_ft: number; thickness_mm: number; color_name: string; } });

        const polishSummary = polishHistory.reduce((acc, polish) => {
            acc[polish.block_no] = (acc[polish.block_no] || 0) + polish.pcs;
            return acc;
        }, {} as { [block_no: string]: number });

        const stock: RoughStockItem[] = [];
        for (const block_no in cutSummary) {
            const totalCut = cutSummary[block_no].total_pcs;
            const totalPolished = polishSummary[block_no] || 0;
            const remainingPcs = totalCut - totalPolished;

            if (remainingPcs > 0) {
                const { cut_length_ft, cut_height_ft, thickness_mm, color_name } = cutSummary[block_no];
                const sqft = remainingPcs * cut_length_ft * cut_height_ft;
                stock.push({
                    block_no,
                    color_name,
                    cut_length_ft,
                    cut_height_ft,
                    thickness_mm,
                    pcs: remainingPcs,
                    sqft: parseFloat(sqft.toFixed(2)),
                    location: 'Cutting Yard',
                });
            }
        }
        return stock;
    }, [blocks, cuttingHistory, polishHistory]);
    
    const polishStock = useMemo(() => {
        const blockMap = new Map<string, Block>();
        blocks.forEach(b => blockMap.set(b.block_no, b));

        const cuttingInfoMap = new Map<string, { cutting_date: string; thickness_mm: number }>();
        cuttingHistory.forEach(c => {
            if (!cuttingInfoMap.has(c.block_no)) {
                cuttingInfoMap.set(c.block_no, {
                    cutting_date: c.cutting_date,
                    thickness_mm: c.thickness_mm,
                });
            }
        });

        const polishedSummary = polishHistory
            .filter(p => p.status === 'Polished')
            .reduce((acc, entry) => {
                if (!acc[entry.block_no]) {
                    acc[entry.block_no] = { 
                        totalPcs: 0, 
                        entry: entry 
                    };
                }
                acc[entry.block_no].totalPcs += entry.pcs;
                if (new Date(entry.polish_date) > new Date(acc[entry.block_no].entry.polish_date)) {
                    acc[entry.block_no].entry = entry;
                }
                return acc;
            }, {} as { [block_no: string]: { totalPcs: number; entry: PolishEntry } });
        
        const soldPcsByBlockNo = salesHistory.reduce((acc, invoice) => {
            invoice.items.forEach(item => {
                acc[item.block_no] = (acc[item.block_no] || 0) + item.pcs;
            });
            return acc;
        }, {} as { [block_no: string]: number });

        const stock: PolishedStockItem[] = [];
        for (const block_no in polishedSummary) {
            const totalPolished = polishedSummary[block_no].totalPcs;
            const totalSold = soldPcsByBlockNo[block_no] || 0;
            const remainingPcs = totalPolished - totalSold;

            if (remainingPcs > 0) {
                const representativeEntry = polishedSummary[block_no].entry;
                const block = blockMap.get(block_no);
                const cuttingInfo = cuttingInfoMap.get(block_no);

                if (block && cuttingInfo) {
                    const sqftPerPc = representativeEntry.polish_length_ft * representativeEntry.polish_height_ft;
                    stock.push({
                        id: block.id,
                        block_no: block_no,
                        polish_date: representativeEntry.polish_date,
                        cutting_date: cuttingInfo.cutting_date,
                        polish_length_ft: representativeEntry.polish_length_ft,
                        polish_height_ft: representativeEntry.polish_height_ft,
                        pcs: remainingPcs,
                        sqft: parseFloat((remainingPcs * sqftPerPc).toFixed(2)),
                        color_name: block.color_name,
                        thickness_mm: cuttingInfo.thickness_mm,
                        cubic_m: block.cubic_m,
                    });
                }
            }
        }
        
        return stock.sort((a, b) => new Date(b.polish_date).getTime() - new Date(a.polish_date).getTime());
    }, [blocks, cuttingHistory, polishHistory, salesHistory]);

    const tilesStock = useMemo(() => {
        const tilesSummary = bridgeCutterHistory.reduce((acc, entry) => {
            // Group by block, color, and tile dimensions to consolidate identical tiles
            const key = `${entry.block_no}|${entry.color_name}|${entry.tile_length_mm}x${entry.tile_height_mm}|${entry.tile_thickness_mm}`;
            if (!acc[key]) {
                acc[key] = {
                    block_no: entry.block_no,
                    color_name: entry.color_name,
                    tile_length_mm: entry.tile_length_mm,
                    tile_height_mm: entry.tile_height_mm,
                    tile_thickness_mm: entry.tile_thickness_mm,
                    pcs: 0,
                    total_sqft: 0,
                };
            }
            acc[key].pcs += entry.pcs;
            acc[key].total_sqft += entry.total_sqft;
            return acc;
        }, {} as { [key: string]: TilesStockItem });

        // FIX: Explicitly type sort arguments to prevent `unknown` type inference issues.
        return Object.values(tilesSummary).sort((a: TilesStockItem,b: TilesStockItem) => a.block_no.localeCompare(b.block_no));
    }, [bridgeCutterHistory]);

    const blockStockSummary = useMemo(() => {
        // FIX: Extracted the summary item type to be used for explicit typing.
        type BlockSummaryItem = { color_name: string; total_blocks: number; total_cbm: number; };
        type SummaryMap = { [key: string]: BlockSummaryItem };
        const summary = blockStock.reduce((acc: SummaryMap, block: Block) => {
            const color = block.color_name || 'N/A';
            if (!acc[color]) {
                acc[color] = { color_name: color, total_blocks: 0, total_cbm: 0 };
            }
            acc[color].total_blocks++;
            acc[color].total_cbm += block.cubic_m;
            return acc;
        }, {} as SummaryMap);
        // FIX: Explicitly type sort arguments to prevent `unknown` type inference issues.
        return Object.values(summary).sort((a: BlockSummaryItem, b: BlockSummaryItem) => a.color_name.localeCompare(b.color_name));
    }, [blockStock]);

    const roughStockSummary = useMemo(() => {
        // FIX: Extracted the summary item type to be used for explicit typing.
        type RoughStockSummaryItem = { color_name: string; total_pcs: number; total_sqft: number; };
        type SummaryMap = { [key: string]: RoughStockSummaryItem };
        const summary = roughStock.reduce((acc: SummaryMap, item: RoughStockItem) => {
            const color = item.color_name || 'N/A';
            if (!acc[color]) {
                acc[color] = { color_name: color, total_pcs: 0, total_sqft: 0 };
            }
            acc[color].total_pcs += item.pcs;
            acc[color].total_sqft += item.sqft;
            return acc;
        }, {} as SummaryMap);
        // FIX: Explicitly type sort arguments to prevent `unknown` type inference issues.
        return Object.values(summary).sort((a: RoughStockSummaryItem, b: RoughStockSummaryItem) => a.color_name.localeCompare(b.color_name));
    }, [roughStock]);
    
    const polishStockSummary = useMemo(() => {
        // FIX: Extracted the summary item type to be used for explicit typing.
        type PolishStockSummaryItem = { color_name: string; total_pcs: number; total_sqft: number; };
        type SummaryMap = { [key: string]: PolishStockSummaryItem };
        const summary = polishStock.reduce((acc: SummaryMap, item: PolishedStockItem) => {
            const color = item.color_name || 'N/A';
            if (!acc[color]) {
                acc[color] = { color_name: color, total_pcs: 0, total_sqft: 0 };
            }
            acc[color].total_pcs += item.pcs;
            acc[color].total_sqft += item.sqft;
            return acc;
        }, {} as SummaryMap);
        // FIX: Explicitly type sort arguments to prevent `unknown` type inference issues.
        return Object.values(summary).sort((a: PolishStockSummaryItem, b: PolishStockSummaryItem) => a.color_name.localeCompare(b.color_name));
    }, [polishStock]);

    const tilesStockSummary = useMemo(() => {
        // FIX: Extracted the summary item type to be used for explicit typing.
        type TilesStockSummaryItem = { color_name: string; total_pcs: number; total_sqft: number; };
        type SummaryMap = { [key: string]: TilesStockSummaryItem };
        const summary = tilesStock.reduce((acc: SummaryMap, item: TilesStockItem) => {
            const color = item.color_name || 'N/A';
            if (!acc[color]) {
                acc[color] = { color_name: color, total_pcs: 0, total_sqft: 0 };
            }
            acc[color].total_pcs += item.pcs;
            acc[color].total_sqft += item.total_sqft;
            return acc;
        }, {} as SummaryMap);
        // FIX: Explicitly type sort arguments to prevent `unknown` type inference issues.
        return Object.values(summary).sort((a: TilesStockSummaryItem, b: TilesStockSummaryItem) => a.color_name.localeCompare(b.color_name));
    }, [tilesStock]);


    const handleExportCSV = () => {
        let data: any[] = [];
        const viewType = selectedColor ? `details-${selectedColor.replace(/\s+/g, '_')}` : 'summary';
        const filename = `stock-report-${activeFilter.toLowerCase()}-${viewType}-${new Date().toISOString().split('T')[0]}`;

        if (selectedColor) {
            switch (activeFilter) {
                case 'Block': data = blockStock.filter(b => b.color_name === selectedColor).map(({ id, ...rest }) => rest); break;
                case 'Rough': data = roughStock.filter(r => r.color_name === selectedColor); break;
                case 'Polish': data = polishStock.filter(p => p.color_name === selectedColor).map(({ id, ...rest }) => rest); break;
                case 'Tiles': data = tilesStock.filter(t => t.color_name === selectedColor); break;
                default: alert('Select a stock type to export.'); return;
            }
        } else {
            switch (activeFilter) {
                case 'Block': data = blockStockSummary.map(s => ({ ...s, total_cbm: s.total_cbm.toFixed(3) })); break;
                case 'Rough': data = roughStockSummary.map(s => ({ ...s, total_sqft: s.total_sqft.toFixed(2) })); break;
                case 'Polish': data = polishStockSummary.map(s => ({ ...s, total_sqft: s.total_sqft.toFixed(2) })); break;
                case 'Tiles': data = tilesStockSummary.map(s => ({ ...s, total_sqft: s.total_sqft.toFixed(2) })); break;
                default: alert('Select a stock type to export.'); return;
            }
        }
        
        downloadCSV(data, filename);
    };

    const handlePrint = () => {
        window.print();
    };

    const FilterButton: React.FC<{ label: StockType }> = ({ label }) => (
        <button
            onClick={() => setActiveFilter(label)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeFilter === label ? 'bg-brand text-white' : 'bg-accent text-text-secondary hover:bg-gray-600'
            }`}
        >
            {label === 'Rough' ? 'Rough Stock' : `${label} Stock`}
        </button>
    );
    
    const renderContent = () => {
        const detailHeader = selectedColor && (
             <div className="mb-4 flex items-center gap-4">
                <button onClick={() => setSelectedColor(null)} className="text-brand hover:underline no-print">
                    &larr; Back to Summary
                </button>
                <h3 className="text-xl font-semibold text-text-primary">
                    {activeFilter} Stock Details for: <span className="text-brand">{selectedColor}</span>
                </h3>
            </div>
        );

        if (activeFilter === 'Block') {
            if (selectedColor) {
                const filteredData = blockStock.filter(b => b.color_name === selectedColor);
                return (
                    <div>
                        {detailHeader}
                        <table className="min-w-full divide-y divide-accent">
                            <thead className="bg-accent">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Inward Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Block No</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Party Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Dimensions (cm)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">CBM</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Weight (Ton)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-secondary divide-y divide-accent">
                                {filteredData.map((block: Block) => (
                                    <tr key={block.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{block.inward_date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{block.block_no}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary truncate max-w-xs">{block.party_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{`${block.length_cm}x${block.height_cm}x${block.width_cm}`}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{block.cubic_m}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{block.weight_ton}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            return (
                 <table className="min-w-full divide-y divide-accent">
                    <thead className="bg-accent">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Color Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Blocks</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total CBM</th>
                        </tr>
                    </thead>
                    <tbody className="bg-secondary divide-y divide-accent">
                        {blockStockSummary.map(item => (
                            <tr key={item.color_name} onClick={() => setSelectedColor(item.color_name)} className="cursor-pointer hover:bg-accent">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.color_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_blocks}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_cbm.toFixed(3)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        } else if (activeFilter === 'Rough') {
             if (selectedColor) {
                const filteredData = roughStock.filter(r => r.color_name === selectedColor);
                return (
                    <div>
                        {detailHeader}
                        <table className="min-w-full divide-y divide-accent">
                            <thead className="bg-accent">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Block No</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Dimensions (ft)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Thickness (mm)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pending Pcs</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pending Sqft</th>
                                </tr>
                            </thead>
                            <tbody className="bg-secondary divide-y divide-accent">
                                {filteredData.map((item) => (
                                    <tr key={item.block_no}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.block_no}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{`${item.cut_length_ft}x${item.cut_height_ft}`}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{item.thickness_mm}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.pcs}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.sqft}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            return (
                <table className="min-w-full divide-y divide-accent">
                    <thead className="bg-accent">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Color Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Pcs</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Sqft</th>
                        </tr>
                    </thead>
                    <tbody className="bg-secondary divide-y divide-accent">
                        {roughStockSummary.map((item) => (
                            <tr key={item.color_name} onClick={() => setSelectedColor(item.color_name)} className="cursor-pointer hover:bg-accent">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.color_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_pcs}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_sqft.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        } else if (activeFilter === 'Polish') {
            if (selectedColor) {
                const filteredData = polishStock.filter(p => p.color_name === selectedColor);
                return (
                    <div>
                        {detailHeader}
                        <table className="min-w-full divide-y divide-accent">
                            <thead className="bg-accent">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Polish Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Block No</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Dimensions (ft)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Thickness (mm)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pcs</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Sqft</th>
                                </tr>
                            </thead>
                            <tbody className="bg-secondary divide-y divide-accent">
                                {filteredData.map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{item.polish_date}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.block_no}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{`${item.polish_length_ft} x ${item.polish_height_ft}`}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{item.thickness_mm}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.pcs}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.sqft}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            return (
                <table className="min-w-full divide-y divide-accent">
                    <thead className="bg-accent">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Color Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Pcs</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Sqft</th>
                        </tr>
                    </thead>
                    <tbody className="bg-secondary divide-y divide-accent">
                        {polishStockSummary.map((item) => (
                            <tr key={item.color_name} onClick={() => setSelectedColor(item.color_name)} className="cursor-pointer hover:bg-accent">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.color_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_pcs}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_sqft.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        } else if (activeFilter === 'Tiles') {
            if (selectedColor) {
                const filteredData = tilesStock.filter(t => t.color_name === selectedColor);
                return (
                    <div>
                        {detailHeader}
                        <table className="min-w-full divide-y divide-accent">
                            <thead className="bg-accent">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Source Block</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Tile Dims (mm)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Thickness (mm)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pcs</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Sqft</th>
                                </tr>
                            </thead>
                            <tbody className="bg-secondary divide-y divide-accent">
                                {filteredData.map((item, index) => (
                                    <tr key={`${item.block_no}-${index}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.block_no}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{`${item.tile_length_mm} x ${item.tile_height_mm}`}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{item.tile_thickness_mm}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.pcs}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_sqft.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            return (
                <table className="min-w-full divide-y divide-accent">
                    <thead className="bg-accent">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Color Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Pcs</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Sqft</th>
                        </tr>
                    </thead>
                    <tbody className="bg-secondary divide-y divide-accent">
                        {tilesStockSummary.map((item) => (
                            <tr key={item.color_name} onClick={() => setSelectedColor(item.color_name)} className="cursor-pointer hover:bg-accent">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{item.color_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_pcs}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{item.total_sqft.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
        return <div className="text-center py-8 text-highlight no-print">Please select a stock type.</div>;
    };
    
    const stockIsEmpty = () => {
        if (selectedColor) {
            if (activeFilter === 'Block') return blockStock.filter(b => b.color_name === selectedColor).length === 0;
            if (activeFilter === 'Rough') return roughStock.filter(r => r.color_name === selectedColor).length === 0;
            if (activeFilter === 'Polish') return polishStock.filter(p => p.color_name === selectedColor).length === 0;
            if (activeFilter === 'Tiles') return tilesStock.filter(t => t.color_name === selectedColor).length === 0;
        } else {
            if (activeFilter === 'Block') return blockStockSummary.length === 0;
            if (activeFilter === 'Rough') return roughStockSummary.length === 0;
            if (activeFilter === 'Polish') return polishStockSummary.length === 0;
            if (activeFilter === 'Tiles') return tilesStockSummary.length === 0;
        }
        return true;
    }

    return (
        <div className="bg-secondary p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
                <div className="flex space-x-2 no-print">
                    <FilterButton label="Block" />
                    <FilterButton label="Rough" />
                    <FilterButton label="Polish" />
                    <FilterButton label="Tiles" />
                </div>
                <div className="flex space-x-2 no-print">
                     <button 
                        onClick={handleExportCSV}
                        disabled={stockIsEmpty()}
                        className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        Export CSV
                    </button>
                    <button 
                        onClick={handlePrint}
                        disabled={stockIsEmpty()}
                        className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        Print PDF
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                {renderContent()}
                {stockIsEmpty() && <p className="text-center py-8 text-highlight no-print">No stock found for this category.</p>}
            </div>
        </div>
    );
};

export default StockRegister;
