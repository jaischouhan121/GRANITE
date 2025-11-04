

import React, { useState, useMemo, useEffect } from 'react';
import { Block, CuttingEntry, PolishEntry, SalesInvoice, BridgeCutterEntry } from '../types';

interface BridgeCutterRegisterProps {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    salesHistory: SalesInvoice[];
    bridgeCutterHistory: BridgeCutterEntry[];
    onSave: (entryData: Omit<BridgeCutterEntry, 'id'>) => void;
}

interface PolishedStockItem {
    id: number;
    block_no: string;
    polish_date: string;
    pcs: number;
    sqft: number;
    color_name: string;
    thickness_mm: number;
}

const initialFormState = {
    bridge_cutter_date: new Date().toISOString().split('T')[0],
    slabs_used: 1,
    tile_length_mm: 0,
    tile_height_mm: 0,
    pcs: 0,
};

const BridgeCutterRegister: React.FC<BridgeCutterRegisterProps> = ({ blocks, cuttingHistory, polishHistory, salesHistory, bridgeCutterHistory, onSave }) => {
    const [selectedBlockNo, setSelectedBlockNo] = useState<string | null>(null);
    const [formState, setFormState] = useState(initialFormState);
    const [calculatedSqft, setCalculatedSqft] = useState(0);
    const [search, setSearch] = useState('');

    const availablePolishStock = useMemo(() => {
        const blockMap = new Map<string, Block>();
        blocks.forEach(b => blockMap.set(b.block_no, b));

        const cuttingInfoMap = new Map<string, { thickness_mm: number }>();
        cuttingHistory.forEach(c => {
            if (!cuttingInfoMap.has(c.block_no)) {
                cuttingInfoMap.set(c.block_no, { thickness_mm: c.thickness_mm });
            }
        });

        const polishedSummary = polishHistory
            .filter(p => p.status === 'Polished')
            .reduce((acc, entry) => {
                if (!acc[entry.block_no]) {
                    acc[entry.block_no] = { totalPcs: 0, entry: entry };
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

        const bridgeCutterUsedPcs = bridgeCutterHistory.reduce((acc, entry) => {
            acc[entry.block_no] = (acc[entry.block_no] || 0) + (entry.slabs_used || 0);
            return acc;
        }, {} as {[key: string]: number});

        const stock: PolishedStockItem[] = [];
        for (const block_no in polishedSummary) {
            const totalPolished = polishedSummary[block_no].totalPcs;
            const totalSold = soldPcsByBlockNo[block_no] || 0;
            const totalUsedInBridge = bridgeCutterUsedPcs[block_no] || 0;
            const remainingPcs = totalPolished - totalSold - totalUsedInBridge;

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
                        pcs: remainingPcs,
                        sqft: parseFloat((remainingPcs * sqftPerPc).toFixed(2)),
                        color_name: block.color_name,
                        thickness_mm: cuttingInfo.thickness_mm,
                    });
                }
            }
        }
        return stock.sort((a, b) => new Date(b.polish_date).getTime() - new Date(a.polish_date).getTime());
    }, [blocks, cuttingHistory, polishHistory, salesHistory, bridgeCutterHistory]);

    const filteredAvailableStock = availablePolishStock.filter(s => 
        s.block_no.toLowerCase().includes(search.toLowerCase()) || 
        s.color_name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedStockItem = useMemo(() => {
        return availablePolishStock.find(s => s.block_no === selectedBlockNo);
    }, [selectedBlockNo, availablePolishStock]);

    useEffect(() => {
        const { tile_length_mm, tile_height_mm, pcs } = formState;
        // Convert mm to ft (1 ft = 304.8 mm), then calculate sqft
        const sqftPerTile = (tile_length_mm / 304.8) * (tile_height_mm / 304.8);
        const totalSqft = sqftPerTile * pcs;
        setCalculatedSqft(parseFloat(totalSqft.toFixed(2)));
    }, [formState]);

    const handleStockSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const blockNo = e.target.value;
        setSelectedBlockNo(blockNo || null);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStockItem) {
            alert('Please select a polished slab batch to cut.');
            return;
        }
        if (formState.pcs <= 0 || formState.tile_length_mm <= 0 || formState.tile_height_mm <= 0) {
            alert('Please enter valid dimensions and a quantity greater than zero.');
            return;
        }
        if (formState.slabs_used > selectedStockItem.pcs) {
            alert(`You cannot use more slabs than available. Available: ${selectedStockItem.pcs}`);
            return;
        }


        const newEntry: Omit<BridgeCutterEntry, 'id'> = {
            block_no: selectedStockItem.block_no,
            color_name: selectedStockItem.color_name,
            bridge_cutter_date: formState.bridge_cutter_date,
            slabs_used: formState.slabs_used,
            tile_length_mm: formState.tile_length_mm,
            tile_height_mm: formState.tile_height_mm,
            tile_thickness_mm: selectedStockItem.thickness_mm,
            pcs: formState.pcs,
            total_sqft: calculatedSqft,
        };

        onSave(newEntry);
        alert(`Tiles from block ${selectedStockItem.block_no} saved successfully.`);
        
        // Reset form
        setSelectedBlockNo(null);
        setFormState(initialFormState);
        setSearch('');
    };
    
    const historyWithColor = useMemo(() => {
        const blockMap = new Map<string, { color_name: string }>();
        blocks.forEach(b => blockMap.set(b.block_no, { color_name: b.color_name }));
        return bridgeCutterHistory.map(entry => ({
            ...entry,
            color_name: entry.color_name || blockMap.get(entry.block_no)?.color_name || 'N/A'
        })).sort((a, b) => new Date(b.bridge_cutter_date).getTime() - new Date(a.bridge_cutter_date).getTime());
    }, [bridgeCutterHistory, blocks]);

    return (
        <div className="space-y-8">
            <form onSubmit={handleSubmit} className="bg-secondary p-8 rounded-lg shadow-lg space-y-6">
                <h2 className="text-xl font-semibold text-text-primary mb-4">New Bridge Cutter Entry (Slab to Tiles)</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-highlight">Find & Select Polished Slabs</label>
                        <input
                            type="text"
                            placeholder="Search by Block No or Color..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2 mb-2"
                        />
                        <select 
                            onChange={handleStockSelect} 
                            value={selectedBlockNo || ''}
                            className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2"
                        >
                            <option value="">-- Select a batch --</option>
                            {filteredAvailableStock.map(item => (
                                <option key={item.id} value={item.block_no}>
                                    {item.block_no} ({item.color_name}) - {item.pcs} slabs available
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedStockItem && (
                         <div className="bg-accent p-4 rounded-md text-sm">
                            <h4 className="font-bold text-text-primary mb-2">Selected Batch Details</h4>
                            <p><span className="text-highlight">Color:</span> {selectedStockItem.color_name}</p>
                            <p><span className="text-highlight">Available Slabs:</span> {selectedStockItem.pcs}</p>
                            <p><span className="text-highlight">Thickness:</span> {selectedStockItem.thickness_mm} mm</p>
                            <p><span className="text-highlight">Total Sqft:</span> {selectedStockItem.sqft}</p>
                        </div>
                    )}
                </div>

                {selectedStockItem && (
                    <div className="border-t border-accent pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 items-end">
                            <div>
                                <label className="block text-sm font-medium text-highlight">Date</label>
                                <input type="date" name="bridge_cutter_date" value={formState.bridge_cutter_date} onChange={handleFormChange} className="mt-1 w-full bg-accent p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Slabs Used</label>
                                <input 
                                    type="number" 
                                    name="slabs_used" 
                                    value={formState.slabs_used} 
                                    onChange={handleFormChange} 
                                    className="mt-1 w-full bg-accent p-2 rounded-md" 
                                    min="1"
                                    max={selectedStockItem?.pcs}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Tile Length (mm)</label>
                                <input type="number" name="tile_length_mm" value={formState.tile_length_mm} onChange={handleFormChange} className="mt-1 w-full bg-accent p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Tile Height (mm)</label>
                                <input type="number" name="tile_height_mm" value={formState.tile_height_mm} onChange={handleFormChange} className="mt-1 w-full bg-accent p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Pcs (Tiles)</label>
                                <input type="number" name="pcs" value={formState.pcs} onChange={handleFormChange} className="mt-1 w-full bg-accent p-2 rounded-md" />
                            </div>
                             <div className="flex flex-col justify-end">
                                <label className="block text-sm font-medium text-highlight">Total Sqft</label>
                                <div className="mt-1 p-2 h-10 flex items-center bg-gray-700 rounded-md font-bold">{calculatedSqft}</div>
                            </div>
                        </div>
                         <div className="flex justify-end pt-4">
                            <button type="submit" className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500">Save Tile Entry</button>
                        </div>
                    </div>
                )}
            </form>
            
            <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-4">Bridge Cutter History</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-accent">
                        <thead className="bg-accent">
                           <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Source Block</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Color</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Tile Dims (mm)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Thickness (mm)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pcs</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Total Sqft</th>
                           </tr>
                        </thead>
                         <tbody className="bg-secondary divide-y divide-accent">
                            {historyWithColor.map(entry => (
                                <tr key={entry.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.bridge_cutter_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{entry.block_no}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.color_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{`${entry.tile_length_mm} x ${entry.tile_height_mm}`}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.tile_thickness_mm}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{entry.pcs}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand">{entry.total_sqft.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {bridgeCutterHistory.length === 0 && <p className="text-center py-8 text-highlight">No bridge cutter history found.</p>}
                </div>
            </div>
        </div>
    );
};

export default BridgeCutterRegister;