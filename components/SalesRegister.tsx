import React, { useState, useMemo } from 'react';
import { SalesInvoice, SalesItem, Block, CuttingEntry, PolishEntry, BridgeCutterEntry } from '../types';

interface SalesRegisterProps {
    salesHistory: SalesInvoice[];
    onSave: (invoiceData: Omit<SalesInvoice, 'id'>) => void;
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    bridgeCutterHistory: BridgeCutterEntry[];
}

interface PolishedStockItem {
    id: number;
    block_no: string;
    polish_date: string;
    polish_length_ft: number;
    polish_height_ft: number;
    pcs: number;
    sqft: number;
    color_name: string;
    thickness_mm: number;
}

const initialNewItemState = {
    block_no: '',
    color_name: '',
    length_ft: '',
    height_ft: '',
    thickness_mm: '',
    pcs: '1',
    sqft: '',
    rate: '',
    gst_amount: '',
};

const SalesRegister: React.FC<SalesRegisterProps> = ({ salesHistory, onSave, blocks, cuttingHistory, polishHistory, bridgeCutterHistory }) => {
    
    const [invoice, setInvoice] = useState<{ invoice_no: string; invoice_date: string; party_name: string; vehicle_no?: string }>({
        invoice_no: `INV-${salesHistory.length + 1}`,
        invoice_date: new Date().toISOString().split('T')[0],
        party_name: '',
        vehicle_no: '',
    });
    const [items, setItems] = useState<SalesItem[]>([]);
    const [newItem, setNewItem] = useState(initialNewItemState);
    const [isConfirming, setIsConfirming] = useState(false);

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
                    stock.push({
                        id: block.id,
                        block_no: block_no,
                        polish_date: representativeEntry.polish_date,
                        polish_length_ft: representativeEntry.polish_length_ft,
                        polish_height_ft: representativeEntry.polish_height_ft,
                        pcs: remainingPcs,
                        sqft: 0, // Not needed for this logic
                        color_name: block.color_name,
                        thickness_mm: cuttingInfo.thickness_mm,
                    });
                }
            }
        }
        return stock;
    }, [blocks, cuttingHistory, polishHistory, salesHistory, bridgeCutterHistory]);

    const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));

        if (name === 'block_no') {
            const selectedStock = availablePolishStock.find(s => s.block_no === value);
            if (selectedStock) {
                setNewItem(prev => ({
                    ...prev,
                    block_no: value,
                    color_name: selectedStock.color_name,
                    length_ft: String(selectedStock.polish_length_ft),
                    height_ft: String(selectedStock.polish_height_ft),
                    thickness_mm: String(selectedStock.thickness_mm),
                }));
            }
        }
    };

    const handleAddItem = () => {
        const len = parseFloat(newItem.length_ft) || 0;
        const hgt = parseFloat(newItem.height_ft) || 0;
        const pcs = parseInt(newItem.pcs) || 0;
        const rate = parseFloat(newItem.rate) || 0;
        const gst = parseFloat(newItem.gst_amount) || 0;
        const thickness = parseInt(newItem.thickness_mm) || 0;
        const sqft = parseFloat(newItem.sqft) || 0;

        if (!newItem.block_no || !newItem.color_name || len <= 0 || hgt <= 0 || pcs <= 0 || sqft <= 0) {
            alert('Please fill in all required fields with valid values.');
            return;
        }

        const baseAmount = sqft * rate;

        const itemToAdd: SalesItem = {
            block_no: newItem.block_no,
            color_name: newItem.color_name,
            length_ft: len,
            height_ft: hgt,
            thickness_mm: thickness,
            pcs: pcs,
            sqft: sqft,
            rate: rate,
            gst_amount: gst,
            amount: parseFloat((baseAmount + gst).toFixed(2)),
        };

        setItems(prev => [...prev, itemToAdd]);
        setNewItem(initialNewItemState);
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirmSave = (saleType: 'Cash' | 'Credit') => {
        if (!invoice.party_name || items.length === 0) {
            alert('Please enter party name and add at least one item.');
            setIsConfirming(false);
            return;
        }
        
        const totals = items.reduce((acc, item) => {
            acc.total_pcs += item.pcs;
            acc.total_sqft += item.sqft;
            acc.total_amount += item.amount;
            return acc;
        }, { total_pcs: 0, total_sqft: 0, total_amount: 0 });

        const invoiceData: Omit<SalesInvoice, 'id'> = {
            ...invoice,
            items: items,
            ...totals,
            sale_type: saleType,
            received_amount: saleType === 'Cash' ? totals.total_amount : 0,
        };

        onSave(invoiceData);
        alert(`Invoice saved as ${saleType} sale!`);
        
        // Reset form
        setInvoice({
            invoice_no: `INV-${salesHistory.length + 2}`,
            invoice_date: new Date().toISOString().split('T')[0],
            party_name: '',
            vehicle_no: '',
        });
        setItems([]);
        setIsConfirming(false);
    };
    
    const invoiceTotals = useMemo(() => items.reduce((acc, item) => {
        acc.pcs += item.pcs;
        acc.sqft += item.sqft;
        acc.gst += item.gst_amount;
        acc.amount += item.amount;
        return acc;
    }, { pcs: 0, sqft: 0, gst: 0, amount: 0 }), [items]);

    return (
        <div className="space-y-8">
            {isConfirming && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-secondary p-8 rounded-lg shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold text-text-primary mb-4">Confirm Sale Type</h3>
                        <p className="text-sm text-highlight mb-6">Please classify this invoice as a cash or credit sale before saving.</p>
                        <div className="flex justify-end space-x-4">
                            <button onClick={() => setIsConfirming(false)} className="px-4 py-2 bg-accent hover:bg-slate-600 text-white font-semibold rounded-md">Cancel</button>
                            <button onClick={() => handleConfirmSave('Credit')} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-md">Save as Credit</button>
                            <button onClick={() => handleConfirmSave('Cash')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-md">Save as Cash</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-6">New Sales Invoice</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-highlight">Invoice No</label>
                        <input type="text" value={invoice.invoice_no} readOnly className="mt-1 block w-full bg-gray-700 p-2 rounded-md" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-highlight">Invoice Date</label>
                        <input type="date" value={invoice.invoice_date} onChange={e => setInvoice({...invoice, invoice_date: e.target.value})} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-highlight">Party Name</label>
                        <input type="text" value={invoice.party_name} onChange={e => setInvoice({...invoice, party_name: e.target.value})} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-highlight">Vehicle No (Optional)</label>
                        <input type="text" value={invoice.vehicle_no} onChange={e => setInvoice({...invoice, vehicle_no: e.target.value})} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                    </div>
                </div>

                <div className="border-t border-accent pt-6">
                    <h3 className="text-lg font-medium text-text-primary mb-4">Add Item to Invoice</h3>
                    <div className="bg-accent p-4 rounded-md space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-highlight">Block No (Search)</label>
                                <input 
                                    type="text" 
                                    list="block_no_suggestions"
                                    name="block_no" 
                                    value={newItem.block_no} 
                                    onChange={handleNewItemChange} 
                                    className="mt-1 block w-full bg-primary p-2 rounded-md" 
                                    placeholder="Type to search..."
                                />
                                <datalist id="block_no_suggestions">
                                    {availablePolishStock
                                        .filter(s => s.block_no.toLowerCase().includes(newItem.block_no.toLowerCase()))
                                        .map(s => <option key={s.id} value={s.block_no}>{s.block_no} ({s.color_name})</option>)
                                    }
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Color Name</label>
                                <input type="text" name="color_name" value={newItem.color_name} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Length (ft)</label>
                                <input type="number" step="0.01" name="length_ft" value={newItem.length_ft} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Height (ft)</label>
                                <input type="number" step="0.01" name="height_ft" value={newItem.height_ft} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                             <div>
                                <label className="block text-sm font-medium text-highlight">Thickness (mm)</label>
                                <input type="number" name="thickness_mm" value={newItem.thickness_mm} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Pieces</label>
                                <input type="number" name="pcs" value={newItem.pcs} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-highlight">Total Sqft (Manual)</label>
                                <input type="number" step="0.01" name="sqft" value={newItem.sqft} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">Rate (/sqft)</label>
                                <input type="number" step="0.01" name="rate" value={newItem.rate} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-highlight">GST Amount</label>
                                <input type="number" step="0.01" name="gst_amount" value={newItem.gst_amount} onChange={handleNewItemChange} className="mt-1 block w-full bg-primary p-2 rounded-md" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button type="button" onClick={handleAddItem} className="w-full sm:w-auto h-10 px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-indigo-500">Add Item</button>
                        </div>
                    </div>
                </div>

                 <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-accent text-left text-xs font-medium text-highlight uppercase">
                           <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">Block No</th>
                                <th className="p-2">Description</th>
                                <th className="p-2">Pcs</th>
                                <th className="p-2">Sqft</th>
                                <th className="p-2">Rate</th>
                                <th className="p-2">GST</th>
                                <th className="p-2">Amount</th>
                                <th className="p-2"></th>
                           </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} className="border-b border-accent">
                                    <td className="p-2">{index + 1}</td>
                                    <td className="p-2 font-mono">{item.block_no}</td>
                                    <td className="p-2">{`${item.color_name} ${item.length_ft}x${item.height_ft}ft ${item.thickness_mm}mm`}</td>
                                    <td className="p-2">{item.pcs}</td>
                                    <td className="p-2">{item.sqft}</td>
                                    <td className="p-2">{item.rate.toLocaleString('en-IN')}</td>
                                    <td className="p-2">{item.gst_amount.toLocaleString('en-IN')}</td>
                                    <td className="p-2 font-bold text-text-primary">{item.amount.toLocaleString('en-IN')}</td>
                                    <td className="p-2"><button onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-300">✕</button></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-accent font-bold">
                                <td colSpan={3} className="p-2 text-right">Total</td>
                                <td className="p-2">{invoiceTotals.pcs}</td>
                                <td className="p-2">{invoiceTotals.sqft.toFixed(2)}</td>
                                <td className="p-2"></td>
                                <td className="p-2">{invoiceTotals.gst.toLocaleString('en-IN')}</td>
                                <td className="p-2">{invoiceTotals.amount.toLocaleString('en-IN')}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                 <div className="flex justify-end pt-6 border-t border-accent">
                    <button onClick={() => setIsConfirming(true)} className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-indigo-500">Save Invoice</button>
                </div>
            </div>

             <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-4">Sales History</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-accent">
                        <thead className="bg-accent">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase">Invoice No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase">Party Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase">Sale Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase">Total Sqft</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase">Total Amount</th>
                            </tr>
                        </thead>
                         <tbody className="bg-secondary divide-y divide-accent">
                            {salesHistory.map(inv => (
                                <tr key={inv.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{inv.invoice_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{inv.invoice_no}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{inv.party_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            inv.sale_type === 'Cash' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                        }`}>
                                            {inv.sale_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{inv.total_sqft.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand">{inv.total_amount.toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {salesHistory.length === 0 && <p className="text-center py-8 text-highlight">No sales history found.</p>}
                </div>
            </div>
        </div>
    );
};

export default SalesRegister;