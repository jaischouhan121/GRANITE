import React, { useState, useMemo, useEffect } from 'react';
import { Block, CuttingEntry, PolishEntry } from '../types';

interface PolishRegisterProps {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    onSave: (entryData: Omit<PolishEntry, 'id'>) => void;
    onUpdate: (entryData: PolishEntry) => void;
    onEdit: (entryId: number) => void;
    polishEntryToEdit?: PolishEntry | null;
}

interface CutSlabSummary {
    block_id: number;
    block_no: string;
    total_pcs: number;
    total_sqft: number;
    cut_length_ft: number;
    cut_height_ft: number;
    thickness_mm: number;
    cutter_name: string;
}

const initialFormState = {
    polish_date: new Date().toISOString().split('T')[0],
    pcs: 0,
    polish_length_ft: 0,
    polish_height_ft: 0,
};

const PolishRegister: React.FC<PolishRegisterProps> = ({ blocks, cuttingHistory, polishHistory, onSave, onUpdate, onEdit, polishEntryToEdit }) => {
    const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
    const [formState, setFormState] = useState(initialFormState);
    const [entryStatus, setEntryStatus] = useState<'Polished' | 'Rejected'>('Polished');
    const [calculatedSqft, setCalculatedSqft] = useState(0);
    const [polishSearch, setPolishSearch] = useState('');

    const isEditing = !!polishEntryToEdit;

    const slabsForPolishing = useMemo(() => {
        const fullyCutBlocks = blocks.filter(b => b.status === 'OK');

        return fullyCutBlocks.map(block => {
            const relevantCuts = cuttingHistory.filter(c => c.block_id === block.id);
            if (relevantCuts.length === 0) return null;

            const totalCutPcs = relevantCuts.reduce((sum, cut) => sum + cut.pcs, 0);
            const processedPcs = polishHistory
                .filter(p => p.block_no === block.block_no)
                .reduce((sum, entry) => sum + entry.pcs, 0);

            if (totalCutPcs <= processedPcs) return null;

            const totalSqft = relevantCuts.reduce((sum, cut) => sum + cut.sqft_per_entry, 0);
            const firstCut = relevantCuts[0];

            return {
                block_id: block.id,
                block_no: block.block_no,
                total_pcs: totalCutPcs,
                total_sqft: parseFloat(totalSqft.toFixed(2)),
                cut_length_ft: firstCut.cut_length_ft,
                cut_height_ft: firstCut.cut_height_ft,
                thickness_mm: firstCut.thickness_mm,
                cutter_name: firstCut.cutter_name,
            };
        }).filter((item): item is CutSlabSummary => item !== null);
    }, [blocks, cuttingHistory, polishHistory]);
    
    const filteredSlabsForPolishing = slabsForPolishing.filter(s =>
        s.block_no.toLowerCase().includes(polishSearch.toLowerCase())
    );

    useEffect(() => {
        if (polishEntryToEdit) {
            const blockForEntry = blocks.find(b => b.block_no === polishEntryToEdit.block_no);
            setSelectedBlockId(blockForEntry?.id || null);
            setFormState({
                polish_date: polishEntryToEdit.polish_date,
                pcs: polishEntryToEdit.pcs,
                polish_length_ft: polishEntryToEdit.polish_length_ft,
                polish_height_ft: polishEntryToEdit.polish_height_ft,
            });
            setEntryStatus(polishEntryToEdit.status);
        } else {
            setSelectedBlockId(null);
            setFormState(initialFormState);
        }
    }, [polishEntryToEdit, blocks]);

    const selectedStock = useMemo(() => {
        if (!selectedBlockId) return null;
        // In edit mode, we might need to display a block that's already fully processed
        if (isEditing) {
            const blockDetails = blocks.find(b => b.id === selectedBlockId);
            if (!blockDetails) return null;
            const relevantCuts = cuttingHistory.filter(c => c.block_id === blockDetails.id);
            if (relevantCuts.length === 0) return null;
            const totalCutPcs = relevantCuts.reduce((sum, cut) => sum + cut.pcs, 0);
            const totalSqft = relevantCuts.reduce((sum, cut) => sum + cut.sqft_per_entry, 0);
            const firstCut = relevantCuts[0];

             return {
                block_id: blockDetails.id,
                block_no: blockDetails.block_no,
                total_pcs: totalCutPcs,
                total_sqft: parseFloat(totalSqft.toFixed(2)),
                cut_length_ft: firstCut.cut_length_ft,
                cut_height_ft: firstCut.cut_height_ft,
                thickness_mm: firstCut.thickness_mm,
                cutter_name: firstCut.cutter_name,
            };
        }
        return slabsForPolishing.find(s => s.block_id === selectedBlockId) || null;
    }, [selectedBlockId, slabsForPolishing, isEditing, blocks, cuttingHistory]);
    
    const totalProcessedPcs = useMemo(() => {
        if (!selectedStock) return 0;
        let history = polishHistory.filter(p => p.block_no === selectedStock.block_no);
        // When editing, exclude the current entry from the "processed" total
        if(isEditing) {
            history = history.filter(p => p.id !== polishEntryToEdit.id);
        }
        return history.reduce((sum, entry) => sum + entry.pcs, 0);
    }, [selectedStock, polishHistory, isEditing, polishEntryToEdit]);
    
    const remainingPcs = selectedStock ? selectedStock.total_pcs - totalProcessedPcs : 0;

    useEffect(() => {
        if (entryStatus === 'Rejected') {
            setCalculatedSqft(0);
            return;
        }
        const { pcs, polish_length_ft, polish_height_ft } = formState;
        setCalculatedSqft(parseFloat((pcs * polish_length_ft * polish_height_ft).toFixed(2)));
    }, [formState, entryStatus]);
    
    useEffect(() => {
        if (isEditing) return; // Don't auto-change dimensions when editing

        if (entryStatus === 'Rejected') {
            setFormState(prev => ({ ...prev, polish_length_ft: 0, polish_height_ft: 0 }));
        } else if (selectedStock) {
             setFormState(prev => ({ ...prev, polish_length_ft: selectedStock.cut_length_ft, polish_height_ft: selectedStock.cut_height_ft }));
        }
    }, [entryStatus, selectedStock, isEditing]);


    const handleStockSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const blockId = parseInt(e.target.value);
        const stockItem = slabsForPolishing.find(s => s.block_id === blockId) || null;
        setSelectedBlockId(blockId || null);
        
        if (stockItem) {
             const newlyRemaining = stockItem.total_pcs - (polishHistory.filter(p => p.block_no === stockItem.block_no).reduce((sum, entry) => sum + entry.pcs, 0));
            setFormState({
                polish_date: new Date().toISOString().split('T')[0],
                pcs: newlyRemaining > 0 ? newlyRemaining : 0,
                polish_length_ft: stockItem.cut_length_ft,
                polish_height_ft: stockItem.cut_height_ft,
            });
            setEntryStatus('Polished');
        } else {
            setFormState(initialFormState);
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormState(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStock || formState.pcs <= 0) {
            alert('Please select a block and enter a valid number of pieces.');
            return;
        }

        if(formState.pcs > remainingPcs && !isEditing) {
            alert(`Cannot process more pieces than available. Available: ${remainingPcs}`);
            return;
        }

        if (isEditing && formState.pcs > (remainingPcs + polishEntryToEdit.pcs)) {
            alert(`Cannot process more pieces than available. Total available for this entry: ${remainingPcs + polishEntryToEdit.pcs}`);
            return;
        }
        
        const entryData = {
            block_no: selectedStock.block_no,
            polish_date: formState.polish_date,
            pcs: formState.pcs,
            polish_length_ft: formState.polish_length_ft,
            polish_height_ft: formState.polish_height_ft,
            sqft: calculatedSqft,
            status: entryStatus,
        };

        if (isEditing) {
            onUpdate({ ...entryData, id: polishEntryToEdit.id });
             alert(`Entry for ${selectedStock.block_no} updated!`);
        } else {
            onSave(entryData);
            alert(`Entry for ${selectedStock.block_no} saved!`);
        }
        setSelectedBlockId(null);
        setFormState(initialFormState);
        setPolishSearch('');
    };

    const inputStyles = (isDisabled: boolean) => 
        `mt-1 block w-full bg-accent border-gray-600 rounded-md p-2 ${isDisabled ? 'bg-gray-700 cursor-not-allowed text-highlight' : ''}`;

    return (
        <div className="space-y-8">
            <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-4">
                    {isEditing ? `Modify Polish Entry for: ${polishEntryToEdit.block_no}` : 'New Polishing Entry'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                             <label className="block text-sm font-medium text-highlight">Find & Select Stock to Polish</label>
                              <input
                                type="text"
                                placeholder="Search by Block No..."
                                value={polishSearch}
                                onChange={(e) => setPolishSearch(e.target.value)}
                                className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2 mb-2"
                                disabled={isEditing}
                              />
                             <select 
                                 onChange={handleStockSelect} 
                                 value={selectedBlockId || ''}
                                 className={inputStyles(isEditing)}
                                 disabled={isEditing}
                             >
                                 <option value="">Select Fully Cut Stock...</option>
                                 {filteredSlabsForPolishing.map(item => (
                                     <option key={item.block_id} value={item.block_id}>
                                         {item.block_no} - {item.total_pcs - polishHistory.filter(p => p.block_no === item.block_no).reduce((s,i) => s + i.pcs, 0)} Pcs Pending
                                     </option>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-highlight">Entry Date</label>
                             <input 
                                type="date"
                                name="polish_date"
                                value={formState.polish_date}
                                onChange={handleFormChange}
                                className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2"
                             />
                         </div>
                    </div>
                     {selectedStock && (
                        <div className="border-t border-accent pt-6 space-y-4">
                            <div>
                                <h3 className="text-lg font-medium text-text-primary">Selected Block Summary</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                                    <p><span className="text-highlight font-semibold">Cutter:</span> {selectedStock.cutter_name}</p>
                                    <p><span className="text-highlight font-semibold">Cut Dims:</span> {selectedStock.cut_length_ft} x {selectedStock.cut_height_ft} ft</p>
                                    <p><span className="text-highlight font-semibold">Thickness:</span> {selectedStock.thickness_mm} mm</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-center p-4 bg-accent rounded-md">
                                    <div><span className="text-highlight font-semibold block text-xs uppercase">Total Pcs Cut</span><span className="text-2xl font-bold">{selectedStock.total_pcs}</span></div>
                                    <div><span className="text-highlight font-semibold block text-xs uppercase">Processed Pcs</span><span className="text-2xl font-bold">{totalProcessedPcs}</span></div>
                                    <div><span className="text-highlight font-semibold block text-xs uppercase">Difference</span><span className="text-2xl font-bold text-brand">{remainingPcs}</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 items-end pt-4 border-t border-gray-700">
                                <div>
                                    <label className="block text-sm font-medium text-highlight">Action</label>
                                    <select
                                        value={entryStatus}
                                        onChange={(e) => setEntryStatus(e.target.value as 'Polished' | 'Rejected')}
                                        className="mt-1 block w-full bg-accent border-gray-600 rounded-md p-2 h-10"
                                    >
                                        <option value="Polished">Mark as Polished</option>
                                        <option value="Rejected">Mark as Rejected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-highlight">Pcs to Process</label>
                                    <input
                                        type="number" name="pcs" value={formState.pcs}
                                        max={isEditing ? remainingPcs + polishEntryToEdit.pcs : remainingPcs} min="1"
                                        onChange={handleFormChange}
                                        className={inputStyles(false)} required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-highlight">Length (ft)</label>
                                    <input
                                        type="number" name="polish_length_ft" step="0.01"
                                        value={formState.polish_length_ft}
                                        onChange={handleFormChange}
                                        className={inputStyles(entryStatus === 'Rejected')}
                                        disabled={entryStatus === 'Rejected'} required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-highlight">Height (ft)</label>
                                    <input
                                        type="number" name="polish_height_ft" step="0.01"
                                        value={formState.polish_height_ft}
                                        onChange={handleFormChange}
                                        className={inputStyles(entryStatus === 'Rejected')}
                                        disabled={entryStatus === 'Rejected'} required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-highlight">Total Sqft</label>
                                    <div className="mt-1 p-2 h-10 flex items-center bg-gray-700 rounded-md font-bold">{calculatedSqft}</div>
                                </div>
                                <div className="md:col-span-3 lg:col-span-1">
                                     <button type="submit" className="w-full h-10 px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-indigo-500">
                                         {isEditing ? 'Update Entry' : 'Save Entry'}
                                     </button>
                                </div>
                            </div>
                        </div>
                     )}
                </form>
            </div>
             <div className="bg-secondary p-8 rounded-lg shadow-lg">
                <h2 className="text-xl font-semibold text-text-primary mb-4">Polishing History</h2>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-accent">
                        <thead className="bg-accent">
                           <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Block No</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Dimensions (ft)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Pcs</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Sqft</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">Status</th>
                           </tr>
                        </thead>
                         <tbody className="bg-secondary divide-y divide-accent">
                            {polishHistory.map(entry => (
                                <tr key={entry.id} className="hover:bg-accent">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.polish_date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand">
                                        <button onClick={() => onEdit(entry.id)} className="hover:underline">{entry.block_no}</button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">{entry.status === 'Polished' ? `${entry.polish_length_ft} x ${entry.polish_height_ft}` : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{entry.pcs}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-primary">{entry.sqft}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            entry.status === 'Polished' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                                        }`}>
                                            {entry.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {polishHistory.length === 0 && <p className="text-center py-8 text-highlight">No polishing history found.</p>}
                </div>
            </div>
        </div>
    );
};

export default PolishRegister;