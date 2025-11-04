import React, { useState, useEffect, useMemo } from 'react';
import { Block } from '../types';

interface FormBlock {
    // Unique key for React rendering
    key: number;
    block_no: string;
    block_mines_no: string;
    color_name: string;
    length_cm: number;
    height_cm: number;
    width_cm: number;
    // Calculated values
    cubic_m: number;
    weight_ton: number;
    royalty_amount: number;
    transport_amount: number;
    block_total_amount: number;
}

const createNewBlock = (): FormBlock => ({
    key: Date.now() + Math.random(),
    block_no: '', block_mines_no: '', color_name: '',
    length_cm: 0, height_cm: 0, width_cm: 0,
    cubic_m: 0, weight_ton: 0, royalty_amount: 0, transport_amount: 0, block_total_amount: 0
});

const initialCommonState = {
    invoice_no: '', invoice_date: '', party_name: '', inward_date: '',
    total_weight_ton: 0, royalty_rate_per_ton: 0, transport_rate_per_ton: 0, block_rate_per_ton: 0,
};

interface BlockInwardFormProps {
    onSave: (blockData: Omit<Block, 'id' | 'status'>[]) => void;
    onUpdate: (blockData: Block) => void;
    blockToEdit?: Block | null;
}

const BlockInwardForm: React.FC<BlockInwardFormProps> = ({ onSave, onUpdate, blockToEdit }) => {
    const [common, setCommon] = useState(initialCommonState);
    const [blocks, setBlocks] = useState<FormBlock[]>([createNewBlock()]);
    const isEditing = !!blockToEdit;

    // Effect to handle editing a single block
    useEffect(() => {
        if (blockToEdit) {
            setCommon({
                invoice_no: blockToEdit.invoice_no,
                invoice_date: blockToEdit.invoice_date,
                party_name: blockToEdit.party_name,
                inward_date: blockToEdit.inward_date,
                total_weight_ton: blockToEdit.weight_ton, // In edit mode, total weight is just this block's weight
                royalty_rate_per_ton: blockToEdit.royalty_rate_per_ton,
                transport_rate_per_ton: blockToEdit.transport_rate_per_ton,
                block_rate_per_ton: blockToEdit.block_rate_per_ton,
            });
            setBlocks([{
                key: blockToEdit.id,
                block_no: blockToEdit.block_no,
                block_mines_no: blockToEdit.block_mines_no,
                color_name: blockToEdit.color_name,
                length_cm: blockToEdit.length_cm,
                height_cm: blockToEdit.height_cm,
                width_cm: blockToEdit.width_cm,
                cubic_m: blockToEdit.cubic_m,
                weight_ton: blockToEdit.weight_ton,
                royalty_amount: blockToEdit.royalty_amount,
                transport_amount: blockToEdit.transport_amount,
                block_total_amount: blockToEdit.block_total_amount,
            }]);
        } else {
            setCommon(initialCommonState);
            setBlocks([createNewBlock()]);
        }
    }, [blockToEdit]);

    // Memoize dimensions string to prevent unnecessary effect runs
    const dimensionsKey = useMemo(() => 
        blocks.map(b => `${b.length_cm}-${b.height_cm}-${b.width_cm}`).join('|'), 
    [blocks]);

    // Effect for all calculations
    useEffect(() => {
        const totalCBM = blocks.reduce((sum, b) => {
            const cbm = (b.length_cm * b.height_cm * b.width_cm) / 1000000;
            return sum + cbm;
        }, 0);

        const updatedBlocks = blocks.map(b => {
            const cbm = (b.length_cm * b.height_cm * b.width_cm) / 1000000;
            let weight_ton = b.weight_ton;

            if (!isEditing) { // Distribute weight only in create mode
                weight_ton = (totalCBM > 0 && common.total_weight_ton > 0)
                    ? (cbm / totalCBM) * common.total_weight_ton
                    : 0;
            } else { // In edit mode, weight is directly from the common state which holds the single block's weight
                 weight_ton = common.total_weight_ton;
            }

            const royalty_amount = weight_ton * common.royalty_rate_per_ton;
            const transport_amount = weight_ton * common.transport_rate_per_ton;
            const block_rate_amount = weight_ton * common.block_rate_per_ton;
            const block_total_amount = royalty_amount + transport_amount + block_rate_amount;
            
            return {
                ...b,
                cubic_m: parseFloat(cbm.toFixed(3)),
                weight_ton: parseFloat(weight_ton.toFixed(3)),
                royalty_amount: parseFloat(royalty_amount.toFixed(2)),
                transport_amount: parseFloat(transport_amount.toFixed(2)),
                block_total_amount: parseFloat(block_total_amount.toFixed(2)),
            };
        });
        
        // Only update state if there's a meaningful change to avoid loops
        if(JSON.stringify(blocks) !== JSON.stringify(updatedBlocks)) {
            setBlocks(updatedBlocks);
        }

    }, [common, dimensionsKey, isEditing]);


    const handleCommonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setCommon(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleBlockChange = (key: number, field: keyof FormBlock, value: any) => {
        setBlocks(prev => prev.map(b => b.key === key ? { ...b, [field]: value } : b));
    };
    
    const addBlock = () => setBlocks(prev => [...prev, createNewBlock()]);
    const removeBlock = (key: number) => setBlocks(prev => prev.filter(b => b.key !== key));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isEditing && blockToEdit) {
            const finalBlock = {
                ...common,
                ...blocks[0],
                // In edit mode, the total weight is the block weight
                weight_ton: common.total_weight_ton,
            };
            delete (finalBlock as any).total_weight_ton;

            onUpdate({
                ...finalBlock,
                id: blockToEdit.id,
                status: blockToEdit.status,
            });
        } else {
            const blocksToSave: Omit<Block, 'id' | 'status'>[] = blocks.map(b => {
                const { key, ...rest } = b;
                return {
                    ...common,
                    ...rest,
                    block_rate_per_ton: common.block_rate_per_ton,
                };
            });
            onSave(blocksToSave);
            alert(`${blocks.length} block(s) saved!`);
            setCommon(initialCommonState);
            setBlocks([createNewBlock()]);
        }
    };
    
    const { totalCBM, totalWeight, totalAmount } = useMemo(() => {
        return blocks.reduce((acc, b) => {
            acc.totalCBM += b.cubic_m;
            acc.totalWeight += b.weight_ton;
            acc.totalAmount += b.block_total_amount;
            return acc;
        }, { totalCBM: 0, totalWeight: 0, totalAmount: 0 });
    }, [blocks]);


    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-secondary p-8 rounded-lg shadow-lg">
            <h3 className="text-xl font-medium leading-6 text-text-primary">
                {isEditing ? `Modify Block: ${blockToEdit.block_no}` : 'New Block Inward (Consignment)'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-accent pt-6">
                <h3 className="text-lg font-medium leading-6 text-text-primary md:col-span-4">Common Details</h3>
                <div>
                    <label className="block text-sm font-medium text-highlight">Invoice No</label>
                    <input type="text" name="invoice_no" value={common.invoice_no} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-highlight">Invoice Date</label>
                    <input type="date" name="invoice_date" value={common.invoice_date} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-highlight">Party Name</label>
                    <input type="text" name="party_name" value={common.party_name} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-highlight">Inward Date</label>
                    <input type="date" name="inward_date" value={common.inward_date} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-accent pt-6">
                <h3 className="text-lg font-medium leading-6 text-text-primary md:col-span-4">Financials & Weight</h3>
                <div>
                     <label className="block text-sm font-medium text-highlight">{isEditing ? 'Block Weight (ton)' : 'Total Vehicle Weight (ton)'}</label>
                     <input type="number" name="total_weight_ton" value={common.total_weight_ton} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                 </div>
                 <div>
                     <label className="block text-sm font-medium text-highlight">Royalty Rate (/ton)</label>
                     <input type="number" name="royalty_rate_per_ton" value={common.royalty_rate_per_ton} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                 </div>
                 <div>
                     <label className="block text-sm font-medium text-highlight">Transport Rate (/ton)</label>
                     <input type="number" name="transport_rate_per_ton" value={common.transport_rate_per_ton} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                 </div>
                 <div>
                     <label className="block text-sm font-medium text-highlight">Block Rate (/ton)</label>
                     <input type="number" name="block_rate_per_ton" value={common.block_rate_per_ton} onChange={handleCommonChange} className="mt-1 block w-full bg-accent p-2 rounded-md" />
                 </div>
            </div>

            <div className="border-t border-accent pt-6">
                <h3 className="text-lg font-medium leading-6 text-text-primary mb-4">Block Details</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-accent text-left text-xs font-medium text-highlight uppercase">
                            <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">Block No</th>
                                <th className="p-2">Mines No</th>
                                <th className="p-2">Color</th>
                                <th className="p-2">L (cm)</th>
                                <th className="p-2">H (cm)</th>
                                <th className="p-2">W (cm)</th>
                                <th className="p-2">CBM</th>
                                <th className="p-2">Weight</th>
                                <th className="p-2">Total Amt</th>
                                {!isEditing && <th className="p-2"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {blocks.map((b, index) => (
                                <tr key={b.key} className="border-b border-accent">
                                    <td className="p-2">{index + 1}</td>
                                    <td><input type="text" value={b.block_no} onChange={(e) => handleBlockChange(b.key, 'block_no', e.target.value)} className="w-24 bg-gray-700 p-1 rounded-md" /></td>
                                    <td><input type="text" value={b.block_mines_no} onChange={(e) => handleBlockChange(b.key, 'block_mines_no', e.target.value)} className="w-24 bg-gray-700 p-1 rounded-md" /></td>
                                    <td><input type="text" value={b.color_name} onChange={(e) => handleBlockChange(b.key, 'color_name', e.target.value)} className="w-28 bg-gray-700 p-1 rounded-md" /></td>
                                    <td><input type="number" value={b.length_cm} onChange={(e) => handleBlockChange(b.key, 'length_cm', parseFloat(e.target.value) || 0)} className="w-20 bg-gray-700 p-1 rounded-md" /></td>
                                    <td><input type="number" value={b.height_cm} onChange={(e) => handleBlockChange(b.key, 'height_cm', parseFloat(e.target.value) || 0)} className="w-20 bg-gray-700 p-1 rounded-md" /></td>
                                    <td><input type="number" value={b.width_cm} onChange={(e) => handleBlockChange(b.key, 'width_cm', parseFloat(e.target.value) || 0)} className="w-20 bg-gray-700 p-1 rounded-md" /></td>
                                    <td className="p-2 font-mono text-sm">{b.cubic_m.toFixed(3)}</td>
                                    <td className="p-2 font-mono text-sm">{b.weight_ton.toFixed(3)}</td>
                                    <td className="p-2 font-mono text-sm font-bold text-text-primary">{b.block_total_amount.toLocaleString('en-IN')}</td>
                                    {!isEditing && <td className="p-2"><button type="button" onClick={() => removeBlock(b.key)} className="text-red-400 hover:text-red-300">✕</button></td>}
                                </tr>
                            ))}
                        </tbody>
                         <tfoot>
                            <tr className="bg-accent font-bold">
                                <td className="p-2 text-right" colSpan={7}>Totals</td>
                                <td className="p-2 font-mono text-sm">{totalCBM.toFixed(3)}</td>
                                <td className="p-2 font-mono text-sm">{totalWeight.toFixed(3)}</td>
                                <td className="p-2 font-mono text-sm">{totalAmount.toLocaleString('en-IN')}</td>
                                {!isEditing && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
                 {!isEditing && (
                    <button type="button" onClick={addBlock} className="mt-4 px-4 py-2 text-sm bg-accent text-white font-semibold rounded-md shadow-sm hover:bg-gray-600">
                        + Add Another Block
                    </button>
                )}
            </div>

            <div className="flex justify-end pt-6 border-t border-accent">
                <button type="submit" className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand focus:ring-offset-secondary">
                    {isEditing ? 'Update Block' : 'Save Consignment'}
                </button>
            </div>
        </form>
    );
};

export default BlockInwardForm;
